import { RECORD_TYPES } from "../types";

export * from "./answers";

export interface IRecord {
  created: number;
  amount: number;
  message?: string;
  type: RECORD_TYPES;
}

export interface IProject {
  meta: IProjectMeta;
  name: string;
  records: IRecord[];
}

export interface IIntegrationLink {
  project: string;
}

export interface IJiraLink extends IIntegrationLink {
  host: string;
  port: string;
  username: string;
  password: string;
  endpoint: string;
}

export interface IConfigFile {
  created: number;
  gitRepo: string;
  links: IIntegrationLink[];
}

export interface IProjectMeta {
  host: string;
  port: number;
  raw?: string;
}

export interface ITimerFile {
  start: number;
  stop: number;
  // TODO add projects as structure
}
