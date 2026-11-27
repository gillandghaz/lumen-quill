export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "HttpError";
  }
}
