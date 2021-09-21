import shelljs, { ExecOutputReturnValue } from "shelljs";
import { IProject, IProjectMeta, IRecord, IGitttFile } from "../interfaces";
import { GitNoOriginError, GitNoUrlError, GitRemoteError, GitNoRepoError, GitttFileError, RECORD_TYPES } from "../types";
import {
  FileHelper,
  GitHelper,
  LogHelper,
  parseProjectNameFromGitUrl,
  QuestionHelper,
  RecordHelper,
} from "./";

export class ProjectHelper {
  /**
   * Extracts the domain from a IProjectMetaData object
   *
   * @param projectMeta - MetaData object
   * @returns Domain of the meta data as formatted string
   */
  public static projectMetaToDomain = (projectMeta: IProjectMeta): string => {
    const { host, port } = projectMeta;
    return `${host.replace(/\./gi, "_")}${port ? "_" + port : ""}`;
  }

  /**
   * Constructs a meta data object from a formatted domain string
   *
   * @param domain - formatted domain string
   * @returns Meta data object based on the formatted string
   */
  public static domainToProjectMeta = (domain: string): IProjectMeta => {
    const split: string[] = domain.split("_");
    const potentialPort: number = parseInt(split[split.length - 1], 10);
    let port = 0;
    let splitClean: string[] = [];

    if (!isNaN(potentialPort)) {
      port = potentialPort;
      splitClean = split.slice(0, split.length - 1);
    } else {
      splitClean = split;
    }

    return {
      host: splitClean.join("."),
      port,
    };
  }

  /**
   * @param project - IProject object
   * @returns Filename of the project file
   */
  public static projectToProjectFilename = (project: IProject): string => {
    return `${project.name}.json`;
  }

  /**
   * @param project - IProject object
   * @returns Path of the project file
   */
  public static getProjectPath = (project: IProject): string => {
    if (!project.meta) {
      return `${ProjectHelper.projectToProjectFilename(project)}`;
    } else {
      return `${ProjectHelper.projectMetaToDomain(project.meta)}/${ProjectHelper.projectToProjectFilename(project)}`;
    }
  }

  private fileHelper: FileHelper;
  private gitHelper: GitHelper;

  constructor(gitHelper: GitHelper, fileHelper: FileHelper) {
    this.gitHelper = gitHelper;
    this.fileHelper = fileHelper;
  }

  public getGitttProject = async (): Promise<IProject> => {
    let project: IProject | undefined = undefined;
    try {
      const gitttFile: IGitttFile = await this.fileHelper.getGitttFile();

      project = {
        name: gitttFile.name,
        records: []
      }

      LogHelper.debug("Got project from yaml file");

    } catch (err) {
      LogHelper.debug("Error getting project from .gittt.yml file, trying git config");
      try {
        project = this.getProjectFromGit();
      } catch (err) {
        LogHelper.debug("Unable to get project from git config", err);
        throw err;
      }
    }

    return project;
  }

  public initProject = async (): Promise<IProject> => {
    try {
      const project = await this.getGitttProject();
      await this.fileHelper.initProject(project);
      await this.gitHelper.commitChanges(`Initialized project`);

      return project;
    } catch (err) {
      LogHelper.debug("Error initializing project", err);
      throw new Error("Error initializing project");
    }
  }

  public addRecordsToProject = async (
    records: IRecord[],
    project?: IProject,
    uniqueOnly?: boolean,
    nonOverlappingOnly?: boolean,
  ): Promise<void> => {
    const selectedProject: IProject | undefined = project ?
      project :
      await this.getGitttProject();

    if (!selectedProject) {
      return;
    }

    records = records.filter((record: IRecord) => {
      let shouldAddRecord = true;

      // Checks uniqueness only against existing records, the provided records have to be unique in the first place!
      if (uniqueOnly === true) {
        shouldAddRecord = RecordHelper.isRecordUnique(record, selectedProject.records);
      }
      if (nonOverlappingOnly === true) {
        shouldAddRecord = RecordHelper.isRecordOverlapping(record, selectedProject.records);
      }

      if (shouldAddRecord) {
        return record;
      }

      LogHelper.warn(
        `Could not add record (amount: ${record.amount}, end: ${record.end}, type: ${record.type}) to ${selectedProject.name}`,
      );
    });

    if (records.length === 1) {
      let record: IRecord = records[0];

      LogHelper.info(`Adding record (amount: ${record.amount}, type: ${record.type}) to ${selectedProject.name}`);

      record = RecordHelper.setRecordDefaults(record);

      selectedProject.records.push(record);
      await this.fileHelper.saveProjectObject(selectedProject);

      // TODO differ between types
      const hourString: string = record.amount === 1 ? "hour" : "hours";
      if (record.message) {
        await this.gitHelper.commitChanges(
          `Added ${record.amount} ${hourString} to ${selectedProject.name}: "${record.message}"`,
        );
      } else {
        await this.gitHelper.commitChanges(`Added ${record.amount} ${hourString} to ${selectedProject.name}`);
      }
    } else if (records.length > 1) {
      if (records.length > 1) {
        records.forEach((record: IRecord) => {
          record = RecordHelper.setRecordDefaults(record);
          selectedProject.records.push(record);
        });

        LogHelper.info(`Adding (${records.length}) records to ${selectedProject.name}`);
        await this.fileHelper.saveProjectObject(selectedProject);
        await this.gitHelper.commitChanges(`Added ${records.length} records to ${selectedProject.name}`);
      }
    }
  }

  public addRecordToProject = async (
    record: IRecord,
    project?: IProject,
    uniqueOnly?: boolean,
    nonOverlappingOnly?: boolean,
  ): Promise<void> => this.addRecordsToProject([record], project, uniqueOnly, nonOverlappingOnly)

  // TODO projectName optional? find it by .git folder
  public getTotalHours = async (projectName: string): Promise<number> => {
    const project: IProject | undefined = await this.fileHelper.findProjectByName(projectName);
    if (!project) {
      throw new Error(`Project "${projectName}" not found`);
    }

    return project.records.reduce((prev: number, curr: IRecord) => {
      if (curr.type === RECORD_TYPES.Time) {
        return prev + curr.amount;
      } else {
        return prev;
      }
    }, 0);
  }

  public getProjectByName = async (name: string): Promise<IProject> => {
    const projects: IProject[] = await this.fileHelper.findAllProjects();
    let foundProject: IProject | undefined = projects.find((p: IProject) => p.name === name);

    if (!foundProject || !name) {
      try {
        foundProject = await this.getGitttProject();

        if (foundProject) {
          // Loads the records from the filesystem to avoid empty record array
          foundProject = await this.fileHelper.findProjectByName(
            foundProject.name,
          );
        } else {
          throw new Error("Unable to get gittt project")
        }
      } catch (err) {
        LogHelper.debug(`Unable to get project from git directory: ${err.message}`);
        throw err;
      }
    }

    if (!foundProject) {
      throw new Error("Unable to get gittt project")
    }

    return foundProject;
  }

  public getAllProjects = async (): Promise<IProject[]> => {
    return this.fileHelper.findAllProjects();
  }

  public getProjectFromGit = (): IProject => {
    LogHelper.debug("Checking number of remote urls");
    const gitRemoteExec: ExecOutputReturnValue = shelljs.exec("git remote", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitRemoteExec.code !== 0) {
      if (gitRemoteExec.code === 128) {
        LogHelper.debug(`"git remote" returned with exit code 128`);
        throw new GitNoRepoError("Current directory does not appear to be a valid git repository");
      }
      LogHelper.debug("Error executing git remote", new Error(gitRemoteExec.stdout));
      throw new GitRemoteError("Unable to get remotes from git config");
    }

    const remotes: string[] = gitRemoteExec.stdout.trim().split("\n");

    if (remotes.length > 1) {
      LogHelper.debug("Found more than one remotes, trying to find origin");
      const hasOrigin: boolean = remotes.indexOf("origin") !== -1;

      if (!hasOrigin) {
        LogHelper.error(`Unable to find any remote called "origin"`);
        throw new GitNoOriginError(`Unable to find any remote called "origin"`);
      }
    }

    LogHelper.debug("Trying to find project name from .git folder");
    const gitConfigExec: ExecOutputReturnValue = shelljs.exec("git config remote.origin.url", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4) {
      LogHelper.debug("Error executing git config remote.origin.url", new Error(gitConfigExec.stdout));
      throw new GitNoUrlError("Unable to get URL from git config");
    }

    const originUrl: string = gitConfigExec.stdout.trim();

    return parseProjectNameFromGitUrl(originUrl);
  }

  public getOrAskForProjectFromGit = async (): Promise<IProject> => {
    let projectName: string;
    let projectMeta: IProjectMeta | undefined;

    try {
      const gitttProject: IProject = await this.getGitttProject();
      projectName = gitttProject.name;
    } catch (e) {
      if (e instanceof GitRemoteError ||
        e instanceof GitNoRepoError ||
        e instanceof GitttFileError) {
        const selectedProjectName: string = await QuestionHelper.
          chooseProjectFile(await this.fileHelper.findAllProjects());
        const split = selectedProjectName.split("/");
        // TODO find a better way?
        if (split.length == 2) {
          const [domain, name] = split;
          projectName = name.replace(".json", "");
          projectMeta = ProjectHelper.domainToProjectMeta(domain);
        } else {
          // Handles projects with no domain information
          projectName = split[0].replace(".json", "");
          projectMeta = undefined;
        }
      } else {
        throw e;
      }
    }

    const project: IProject | undefined = await this.fileHelper.findProjectByName(
      projectName,
      projectMeta,
    );

    if (!project) {
      throw new Error(`Unable to find project "${projectName}" on disk`);
    }

    return project;
  }
}
