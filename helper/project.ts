import inquirer from "inquirer";
import shelljs, { ExecOutputReturnValue, exit } from "shelljs";
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

    return { host, port: parseInt(port, 10), name, raw: input };
  }
  private fileHelper: FileHelper;
  private gitHelper: GitHelper;

  constructor(gitHelper: GitHelper, fileHelper: FileHelper) {
    this.gitHelper = gitHelper;
    this.fileHelper = fileHelper;
  }

  public addHoursToProject = async (projectName: string, hour: IHour): Promise<void> => {
    const project: IProject | undefined = await this.fileHelper.getProjectByName(projectName);

    if (!project) {
      LogHelper.warn(`Project "${projectName}" not found`);
      // await this.fileHelper.initProject({

      // });
      // TODO ask user to init new project?
      // TODO remove
      return process.exit(1);
    }

    project.hours.push(hour);
    await this.fileHelper.saveProjectObject(project);

    const hourString = hour.count === 1 ? "hour" : "hours";
    await this.gitHelper.commitChanges(`Added ${hour.count} ${hourString} to ${projectName}: "${hour.message}"`);
  }

  public getTotalHours = async (projectName: string): Promise<number> => {
    const project: IProject | undefined = await this.fileHelper.getProjectByName(projectName);
    if (!project) {
      throw new Error(`Project "${projectName}" not found`);
    }

    return project.hours.reduce((prev: number, curr: IHour) => {
      return prev + curr.count;
    }, 0);
  }

  // TODO remove? is just a proxy for the file helper
  // TODO maybe move functionality from file helper here?
  public getProjectList = async (): Promise<IProject[]> => {
    return this.fileHelper.getAllProjects();
  }

  // public getProjectLinkByName = async (name: string): Promise<IProjectMeta | undefined> => {
  //   // get all hosts
  //   // get all projects


  //   const config = this.fileHelper.getConfigObject();

  //   // return config.projects.find((project: IProjectLink) => project.name === name);
  //   return
  // }

  public getProjectName = async (): Promise<string> => {
    let projectDomain: IProjectMeta | undefined = this.getProjectNameGit();

    if (!projectDomain) {
      projectDomain = await this.getProjectNameUser();
    }

    return projectDomain.name;
  }

  private getProjectNameUser = async (): Promise<IProjectMeta> => {
    LogHelper.info("Unable to determinate project, please add it manually");
    const projectNameAnswer = await inquirer.prompt([
      {
        message: "Project namespace:",
        name: "userProjectNamespace",
        type: "input",
        validate(input) {
          const valid = input.length > 0;

          if (valid) {
            return true;
          } else {
            return "The namespace must not be empty";
          }
        },
      },
      {
        message: "Project name:",
        name: "userProjectName",
        type: "input",
        validate(input) {
          const valid = input.length > 0;

          if (valid) {
            return true;
          } else {
            return "The name must not be empty";
          }
        },
      },
    ]) as IProjectNameAnswers;

    const { userProjectName, userProjectNamespace } = projectNameAnswer;

    // TODO find project in .git-time-tracker folder in HOME
    // TODO if not unique (on more than 1 host), ask user for host and port or ssh:// https:// URL
    // TODO create domain directory
    // TODO create project json

    const projectMeta = {
      // TODO using inquirer
      host: "TO_BE_ADDED",
      port: 1337,
      name: `${userProjectNamespace}/${userProjectName}`
    }

    this.fileHelper.initProject(`${userProjectNamespace}/${userProjectName}`, projectMeta)

    return projectMeta;
  }

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
