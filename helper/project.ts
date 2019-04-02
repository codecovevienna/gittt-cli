import inquirer from "inquirer";
import shelljs, { ExecOutputReturnValue } from "shelljs";
import uuid from "uuid/v1";
import { IHour, IProject, IProjectNameAnswers, IProjectMeta } from "../interfaces";
import { FileHelper, GitHelper, LogHelper } from "./index";

export class ProjectHelper {
  public static parseProjectNameFromGitUrl = (input: string): IProjectMeta | undefined => {
    const split = input
      .match(new RegExp("(\\w+:\/\/)(.+@)*([\\w\\d\.]+)(:[\\d]+){0,1}\/*(.*)\.git"));

    if (!split || split.length !== 6) {
      return;
    }

    const [,
      /*schema*/,
      /*user*/,
      host,
      port,
      name] = split;

    return { host, port: parseInt(port, 10), name, raw: split };
  }
  private fileHelper: FileHelper;
  private gitHelper: GitHelper;

  constructor(gitHelper: GitHelper, fileHelper: FileHelper) {
    this.gitHelper = gitHelper;
    this.fileHelper = fileHelper;
  }

  public init = async (): Promise<void> => {
    const config = this.fileHelper.getConfigObject();
    // const name = await this.getProjectName();
    // const projectLink = await this.getProjectLinkByName(name);

    // if (!projectLink) {
    //   const pL: IProjectLink = {
    //     created: Date.now(),
    //     file: name.replace("/", "_") + ".json",
    //     guid: uuid(),
    //     name,
    //   };

    //   config.projects.push(pL);

    //   await this.fileHelper.initProjectFile(pL);

    //   await this.fileHelper.saveConfigObject(config);
    //   await this.gitHelper.commitChanges(`Initiated ${name}`);
    //   await this.gitHelper.pushChanges();
    // }
  }

  public addHoursToProject = async (projectName: string, hour: IHour): Promise<void> => {
    let projectDomain: IProjectMeta | undefined = await this.getProjectLinkByName(projectName);
    if (!projectDomain) {
      LogHelper.warn(`Project "${projectName}" not found`);
      await this.init();
      projectDomain = await this.getProjectLinkByName(projectName);
    }

    if (!projectDomain) {
      throw new Error("Unable to initialize project");
    }

    // TODO reenable
    // const project = await this.fileHelper.getProjectObject(projectDomain);
    // project.hours.push(hour);
    // await this.fileHelper.saveProjectObject(project, projectDomain);

    const hourString = hour.count === 1 ? "hour" : "hours";
    await this.gitHelper.commitChanges(`Added ${hour.count} ${hourString} to ${projectName}: "${hour.message}"`);
  }

  public getTotalHours = async (projectName: string): Promise<number> => {
    const projectDomain = await this.getProjectLinkByName(projectName);
    if (!projectDomain) {
      throw new Error(`Project "${projectName}" not found`);
    }

    // TODO disable
    return 0

    // TODO reenable
    // const project = await this.fileHelper.getProjectObject(projectDomain);
    // return project.hours.reduce((prev: number, curr: IHour) => {
    //   return prev + curr.count;
    // }, 0);
  }

  // public getProjectList = async (): Promise<IProjectLink[]> => {
  //   const projects = this.fileHelper.getProjects()
  //   const config = this.fileHelper.getConfigObject();
  //   return config.projects;
  // }

  public getProjectLinkByName = async (name: string): Promise<IProjectMeta | undefined> => {
    // get all hosts
    // get all projects


    const config = this.fileHelper.getConfigObject();

    // return config.projects.find((project: IProjectLink) => project.name === name);
    return
  }

  // public getProjectName = async (): Promise<IProjectMeta> => {
  //   let projectDomain: IProjectMeta = this.getProjectNameGit();

  //   if (!projectDomain) {
  //     projectDomain = await this.getProjectNameUser();
  //   }

  //   return projectDomain;
  // }

  // private getProjectNameUser = async (): Promise<IProjectMeta> => {
  //   LogHelper.info("Unable to determinate project, please add it manually");
  //   const projectNameAnswer = await inquirer.prompt([
  //     {
  //       message: "Project namespace:",
  //       name: "userProjectNamespace",
  //       type: "input",
  //       validate(input) {
  //         const valid = input.length > 0;

  //         if (valid) {
  //           return true;
  //         } else {
  //           return "The namespace must not be empty";
  //         }
  //       },
  //     },
  //     {
  //       message: "Project name:",
  //       name: "userProjectName",
  //       type: "input",
  //       validate(input) {
  //         const valid = input.length > 0;

  //         if (valid) {
  //           return true;
  //         } else {
  //           return "The name must not be empty";
  //         }
  //       },
  //     },
  //   ]) as IProjectNameAnswers;

  //   const { userProjectName, userProjectNamespace } = projectNameAnswer;

  //   // TODO find project in .git-time-tracker folder in HOME
  //   // TODO if not unique (on more than 1 host), ask user for host and port or ssh:// https:// URL
  //   // TODO create domain directory
  //   // TODO create project json

  //   return `${userProjectNamespace}/${userProjectName}`;
  // }

  private getProjectNameGit = (): IProjectMeta | undefined => {
    LogHelper.debug("Trying to find project name from .git folder");
    const gitConfigExec: ExecOutputReturnValue = shelljs.exec("git config remote.origin.url", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4) {
      return;
    }

    const originUrl = gitConfigExec.stdout.trim();

    return ProjectHelper.parseProjectNameFromGitUrl(originUrl);
  }

  // TODO refactor
  // private saveProject = async (project: IProject, projectLink: IProjectLink): Promise<boolean> => {

  //   // remove project from config file
  //   const filteredProjects = config.projects.filter((p: IProjectLink) => p.name !== project.name);

  //   // add project to config file

  //   filteredProjects.push(project);
  //   // save config file

  //   config.projects = filteredProjects;

  //   return await this.fileHelper.saveConfigObject(config);
  // }
}
