import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve, sep } from "node:path"

import { Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class MediaStorageService {
  private readonly root: string

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.root = resolve(config.get<string>("MEDIA_STORAGE_ROOT", ".data/media"))
  }

  async writePrivate(key: string, value: Buffer) { await this.write(`private/${key}`, value) }
  async writePublic(key: string, value: Buffer) { await this.write(`public/${key}`, value) }
  async readPublic(key: string) { return readFile(this.path(`public/${key}`)) }

  private async write(key: string, value: Buffer) {
    const path = this.path(key)
    await mkdir(dirname(path), { recursive: true, mode: 0o750 })
    await writeFile(path, value, { flag: "wx", mode: 0o640 })
  }

  private path(key: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.includes("..")) throw new Error("Invalid media storage key")
    const path = resolve(this.root, key)
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) throw new Error("Media storage key escaped its root")
    return path
  }
}
