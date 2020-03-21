import { RECORD_TYPES } from "../types";

export * from "./integrations";

export interface IRecord {
  guid?: string;
  created?: number;
  updated?: number;
  end: number;
  amount: number;
  message?: string;
  type: RECORD_TYPES;
}

export interface IProject {
  meta?: IProjectMeta;
  name: string;
  records: IRecord[];
}

export interface IIntegrationLink {
  projectName: string;
  linkType: string;
}

export interface IJiraLink extends IIntegrationLink {
  username: string;
  hash: string;
  host: string;
  endpoint: string;
  key: string;
  issue: string;
}

export interface IMultipieLink extends IIntegrationLink {
  username: string;
  host: string;
  endpoint: string;
}

export interface IGitttFile {
  name: string;
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

export interface ICsvRow {
  MESSAGE: string;
  END: number;
  AMOUNT: number;
  TYPE: string;
}

export interface IPublishSummaryItem {
  success: boolean;
  type: string;
  reason?: string;
}
