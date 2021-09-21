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
  role?: string;
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

// Private per design to enforce one of the child interfaces
interface IMultipieLink extends IIntegrationLink {
  host: string;
  endpoint: string;
  clientSecret?: string;
  username?: string;
}

export interface IMultipieInputLink extends IMultipieLink {
  username: string;
  password: string;
}
export interface IMultipieStoreLink extends IMultipieLink {
  refreshToken?: string;
}

export interface IGitttFile {
  name: string;
  requires_roles?: boolean;
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

export interface ISelectChoice {
  name: string;
  value: string
}