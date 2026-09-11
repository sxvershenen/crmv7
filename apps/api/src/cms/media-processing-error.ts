export class MediaPipelineError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message)
    this.name = "MediaPipelineError"
  }
}

export class MediaStorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = "MediaStorageError"
  }
}

export function mediaError(code: string, message: string, retryable = false) {
  return new MediaPipelineError(code, message, retryable)
}
