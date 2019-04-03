export * from "./answers";

export interface IHour {
  created: number;
  count: number;
  message: string;
}

export interface IProject {
  //  guid: string;
  name: string;
  hours: IHour[];
}

// export interface IProjectLink {
//   file: string;
//   guid: string;
//   name: string;
//   created: number;
// }

export interface IConfigFile {
  created: number;
  gitRepo: string;
  // projects: IProjectLink[];
}

export interface IProjectMeta {
  host: string;
  port: number;
  // TODO should only be part of the project
  name: string;
  raw?: string;
}