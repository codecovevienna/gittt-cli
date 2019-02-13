export * from "./ansers";

export interface IHour {
  created: number;
  count: number;
  message: string;
}

export interface IProject {
  name: string;
  hours: IHour[];
}

export interface  IConfigFile {
  created: number;
  gitRepo: string;
  projects: IProject[];
}
