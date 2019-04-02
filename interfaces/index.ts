export * from "./ansers";

export interface IHour {
  created: number;
  count: number;
  message: string;
}

export interface IProject {
  guid: string;
  name: string;
  hours: IHour[];
}

export interface IProjectLink {
  file: string;
  guid: string;
  name: string;
  created: number;
}

export interface  IConfigFile {
  created: number;
  gitRepo: string;
  projects: IProjectLink[];
}

export interface ITimerFile {
  start: number;
  stop: number;
  //TODO add projects as structure
}
