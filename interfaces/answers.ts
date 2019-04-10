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

export interface IGitCommitMessageAnswers {
  gitCommitMessage: string;
}

export interface IInitProjectAnswers {
  confirm: boolean;
}
