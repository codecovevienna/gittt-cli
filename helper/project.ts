import shelljs, { ExecOutputReturnValue } from "shelljs";
import uuid from "uuid/v1";
import { IProject, IRecord } from "../interfaces";
import { FileHelper, GitHelper, LogHelper, parseProjectNameFromGitUrl } from "./index";

export class ProjectHelper {
  private fileHelper: FileHelper;
  private gitHelper: GitHelper;

  constructor(gitHelper: GitHelper, fileHelper: FileHelper) {
    this.gitHelper = gitHelper;
    this.fileHelper = fileHelper;
  }

  public initProject = async (): Promise<IProject> => {
    try {
      const project: IProject = this.getProjectFromGit();

      await this.fileHelper.initProject(project);

      await this.gitHelper.commitChanges(`Initialized project`);

      return project;
    } catch (err) {
      LogHelper.debug("Error writing project file", err);
      throw new Error("Error initializing project");
    }
  }

  public addRecordToProject = async (record: IRecord): Promise<void> => {
    let foundProject: IProject;

    const projectFromGit: IProject = this.getProjectFromGit();
    const projectName: string = projectFromGit.name;

    // Try to find project in projects directory
    const project: IProject | undefined = await this.fileHelper.findProjectByName(projectName);

    if (!project) {
      LogHelper.warn(`Project "${projectName}" not found`);
      try {

        // TODO ask user if he wants to create this project?
        LogHelper.warn("Maybe it would be a great idea to ask the user to do the next step, but never mind ;)");
        LogHelper.info(`Initializing project "${projectName}"`);
        foundProject = await this.fileHelper.initProject(this.getProjectFromGit());
      } catch (err) {
        LogHelper.error("Unable to initialize project, exiting...");
        return process.exit(1);
      }
    } else {
      foundProject = project;
    }

    LogHelper.info(`Adding record (amount: ${record.amount}, type: ${record.type}) to ${foundProject.name}`);

    // Add unique identifier to each record
    if (!record.guid) {
      record.guid = uuid();
    }

    if (!record.created) {
      record.created = Date.now();
    }

    foundProject.records.push(record);
    await this.fileHelper.saveProjectObject(foundProject);

    // TODO differ between types
    const hourString: string = record.amount === 1 ? "hour" : "hours";
    if (record.message) {
      await this.gitHelper.commitChanges(`Added ${record.amount} ${hourString} to ${projectName}: "${record.message}"`);
    } else {
      await this.gitHelper.commitChanges(`Added ${record.amount} ${hourString} to ${projectName}`);
    }
  }

  // TODO projectName optional? find it by .git folder
  public getTotalHours = async (projectName: string): Promise<number> => {
    const project: IProject | undefined = await this.fileHelper.findProjectByName(projectName);
    if (!project) {
      throw new Error(`Project "${projectName}" not found`);
    }

    return project.records.reduce((prev: number, curr: IRecord) => {
      if (curr.type === "Time") {
        return prev + curr.amount;
      } else {
        return prev;
      }
    }, 0);
  }

  public getProjectFromGit = (): IProject => {
    LogHelper.debug("Trying to find project name from .git folder");
    const gitConfigExec: ExecOutputReturnValue = shelljs.exec("git config remote.origin.url", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4) {
      LogHelper.debug("Error executing git config remote.origin.url", new Error(gitConfigExec.stdout));
      throw new Error("Unable to get URL from git config");
    }

    const originUrl: string = gitConfigExec.stdout.trim();

    return parseProjectNameFromGitUrl(originUrl);
  }
}
