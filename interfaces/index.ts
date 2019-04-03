export * from "./answers";

export interface IHour {
  created: number;
  count: number;
  message: string;
}

export interface IProject {
  meta: IProjectMeta;
  name: string;
  hours: IHour[];
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