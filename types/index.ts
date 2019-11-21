export enum RECORD_TYPES {
  Time = "Time",
}

export class GitRemoteError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class GitNoOriginError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class GitNoUrlError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const ORDER_TYPE: string[] = ["name", "hours"];
export const ORDER_DIRECTION: string[] = ["asc", "desc"];