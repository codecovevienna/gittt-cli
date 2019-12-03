export * from "./errors/gitNoOriginError";
export * from "./errors/gitNoUrlError";
export * from "./errors/gitNoRepoError";
export * from "./errors/gitRemoteError";

export enum RECORD_TYPES {
  Time = "Time",
}

export const ORDER_TYPE: string[] = ["name", "hours"];
export const ORDER_DIRECTION: string[] = ["asc", "desc"];
