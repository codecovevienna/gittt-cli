import { RECORD_TYPES } from "../types";

export * from "./answers";

export interface IRecord {
  created: number;
  amount: number;
  message: string;
  type: RECORD_TYPES;
}

export interface IProject {
  meta: IProjectMeta;
  name: string;
  records: IRecord[];
}

export interface IConfigFile {
  created: number;
  gitRepo: string;
}

export interface IProjectMeta {
  host: string;
  port: number;
  raw?: string;
}
