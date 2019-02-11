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

export interface IInitAnswers {
  setup: boolean;
}

export interface IOverrideAnswers {
  override: number;
}

export interface IProjectNameAnswers {
  userProjectNamespace: string;
  userProjectName: string;
}

export interface IGitRepoAnswers {
  gitRepo: string;
}
