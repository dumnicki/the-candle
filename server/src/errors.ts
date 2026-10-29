export class RequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestError";
  }
}

export class GhostNotFoundError extends Error {
  constructor(id: string) {
    super(`Unknown ghost "${id}"`);
    this.name = "GhostNotFoundError";
  }
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}
