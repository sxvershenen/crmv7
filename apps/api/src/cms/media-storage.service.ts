import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises"
import { dirname, resolve, sep } from "node:path"

import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { MediaStorageError } from "./media-processing-error.js"

export type MediaStorageObject = {
  key: string
  lastModified: Date
}

type MediaObjectScope = "private" | "public" | "staging"

/**
 * One storage port for local development and S3-compatible production object
 * storage. The database keeps logical keys; this adapter owns bucket prefixes,
 * CDN URLs and object cleanup so callers cannot escape the media namespace.
 */
@Injectable()
export class MediaStorageService {
  private readonly driver: "local" | "s3"
  private readonly root: string
  private readonly bucket: string | null
  private readonly cdnBaseUrl: string | null
  private readonly client: S3Client | null

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.driver = config.get<"local" | "s3">("MEDIA_STORAGE_DRIVER", "local")
    this.root = resolve(config.get<string>("MEDIA_STORAGE_ROOT", ".data/media"))
    this.bucket = config.get<string>("MEDIA_STORAGE_BUCKET") ?? null
    this.cdnBaseUrl = config.get<string>("MEDIA_CDN_BASE_URL")?.replace(/\/+$/, "") ?? null

    if (this.driver === "s3") {
      if (!this.bucket) throw new Error("MEDIA_STORAGE_BUCKET is required for the S3 media storage adapter")
      const accessKeyId = config.get<string>("MEDIA_STORAGE_ACCESS_KEY_ID")
      const secretAccessKey = config.get<string>("MEDIA_STORAGE_SECRET_ACCESS_KEY")
      const endpoint = config.get<string>("MEDIA_STORAGE_ENDPOINT")
      const credentials = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : null
      this.client = new S3Client({
        region: config.get<string>("MEDIA_STORAGE_REGION", "us-east-1"),
        forcePathStyle: Boolean(endpoint),
        ...(endpoint ? { endpoint } : {}),
        ...(credentials ? { credentials } : {}),
      })
    } else {
      this.client = null
    }
  }

  async writePrivate(key: string, value: Buffer, contentType = "application/octet-stream") {
    return this.write("private", key, value, contentType)
  }

  async writePublic(key: string, value: Buffer, contentType = "application/octet-stream") {
    return this.write("public", key, value, contentType, "public, max-age=31536000, immutable")
  }

  async writeStaging(key: string, value: Buffer, contentType = "application/octet-stream") {
    return this.write("staging", key, value, contentType, undefined, true)
  }

  async readStaging(key: string) {
    return this.read("staging", key)
  }

  async readPublic(key: string) {
    return this.read("public", key)
  }

  async deleteStaging(key: string) {
    return this.remove("staging", key)
  }

  async deleteObject(key: string) {
    this.validateKey(key)
    if (!/^(private|public|staging)\//.test(key)) throw new Error("Media object is outside the managed namespace")
    try {
      if (this.driver === "s3") {
        await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }))
        return
      }
      await this.removeLocal(this.path(key))
    } catch (error) {
      throw new MediaStorageError(`Unable to delete media object ${key}`, error)
    }
  }

  async listObjects(): Promise<MediaStorageObject[]> {
    try {
      if (this.driver === "s3") return await this.listS3Objects()
      return await this.listLocalObjects()
    } catch (error) {
      throw new MediaStorageError("Unable to list media objects", error)
    }
  }

  /** Return a CDN URL when configured; otherwise preserve the API delivery fallback. */
  publicUrl(key: string, fallback: string) {
    this.validateKey(key)
    if (!this.cdnBaseUrl) return fallback
    const suffix = key.split("/").map((part) => encodeURIComponent(part)).join("/")
    return `${this.cdnBaseUrl}/${suffix}`
  }

  private async write(scope: MediaObjectScope, key: string, value: Buffer, contentType: string, cacheControl?: string, noOverwrite = false) {
    const objectKey = this.objectKey(scope, key)
    try {
      if (this.driver === "s3") {
        await this.client!.send(new PutObjectCommand({
          Bucket: this.bucket!, Key: objectKey, Body: value, ContentType: contentType, CacheControl: cacheControl, ...(noOverwrite ? { IfNoneMatch: "*" } : {}),
        }))
        return
      }
      const path = this.path(objectKey)
      await mkdir(dirname(path), { recursive: true, mode: 0o750 })
      await writeFile(path, value, { flag: "wx", mode: 0o640 })
    } catch (error) {
      throw new MediaStorageError(`Unable to write media object ${objectKey}`, error)
    }
  }

  private async read(scope: MediaObjectScope, key: string) {
    const objectKey = this.objectKey(scope, key)
    try {
      if (this.driver === "s3") {
        const result = await this.client!.send(new GetObjectCommand({ Bucket: this.bucket!, Key: objectKey }))
        if (!result.Body) throw new Error(`Media object ${objectKey} has no body`)
        return Buffer.from(await result.Body.transformToByteArray())
      }
      return readFile(this.path(objectKey))
    } catch (error) {
      throw new MediaStorageError(`Unable to read media object ${objectKey}`, error)
    }
  }

  private async remove(scope: MediaObjectScope, key: string) {
    return this.deleteObject(this.objectKey(scope, key))
  }

  private async listS3Objects() {
    const result: MediaStorageObject[] = []
    for (const prefix of ["private/", "public/", "staging/"]) {
      let continuationToken: string | undefined
      do {
        const page = await this.client!.send(new ListObjectsV2Command({ Bucket: this.bucket!, Prefix: prefix, ContinuationToken: continuationToken }))
        for (const object of page.Contents ?? []) {
          if (object.Key) result.push({ key: object.Key, lastModified: object.LastModified ?? new Date() })
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (continuationToken)
    }
    return result
  }

  private async listLocalObjects() {
    const result: MediaStorageObject[] = []
    const visit = async (directory: string, prefix: string) => {
      let entries
      try {
        entries = await readdir(directory, { withFileTypes: true })
      } catch (error) {
        if (isNotFound(error)) return
        throw error
      }
      for (const entry of entries) {
        const absolute = resolve(directory, entry.name)
        const key = `${prefix}${entry.name}`
        if (entry.isDirectory()) await visit(absolute, `${key}/`)
        else if (entry.isFile()) {
          const details = await stat(absolute)
          result.push({ key, lastModified: details.mtime })
        }
      }
    }
    await visit(this.root, "")
    return result
  }

  private async removeLocal(path: string) {
    try {
      await unlink(path)
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
  }

  private objectKey(scope: MediaObjectScope, key: string) {
    this.validateKey(key)
    return `${scope}/${key}`
  }

  private path(key: string) {
    this.validateKey(key)
    const path = resolve(this.root, key)
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) throw new Error("Media storage key escaped its root")
    return path
  }

  private validateKey(key: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.includes("..")) throw new Error("Invalid media storage key")
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT")
}
