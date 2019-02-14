import inquirer from "inquirer";
import shelljs, { ExecOutputReturnValue } from "shelljs";
import uuid from "uuid/v1"
import { IHour, IProjectLink, IProjectNameAnswers, IProject } from "../interfaces";
import { FileHelper, GitHelper, LogHelper } from "./index";

export class ProjectHelper {
  public static parseProjectNameFromGitUrl = (input: string): string | undefined => {
    const split = input
      .match(new RegExp("(\\w+:\/\/)(.+@)*([\\w\\d\.]+)(:[\\d]+){0,1}\/*(.*)\.git"));

    if (!split || split.length !== 6) {
      return;
    }

    const [,
      /*schema*/,
      /*user*/,
      /*domain*/,
      /*port*/,
      projectName] = split;

    return projectName;
  }
  private fileHelper: FileHelper;
  private gitHelper: GitHelper;

  constructor(gitHelper: GitHelper, fileHelper: FileHelper) {
    this.gitHelper = gitHelper;
    this.fileHelper = fileHelper;
  }

  public init = async (): Promise<void> => {
    const config = this.fileHelper.getConfigObject();
    const name = await this.getProjectName();
    const projectLink = await this.getProjectLinkByName(name);

    if(!projectLink){
      const pL: IProjectLink = {
        file: name.replace("/", "_") + ".json",
        guid: uuid(),
        name,
        created: Date.now(), 
      }

      config.projects.push(pL);

      await this.fileHelper.initProjectFile(pL)

      await this.fileHelper.saveConfigObject(config);
      await this.gitHelper.commitChanges(`Initiated ${name}`);
      await this.gitHelper.pushChanges();
    }
  };

  public addHoursToProject = async (projectName: string, hour: IHour): Promise<void> => {
    const projectLink = await this.getProjectLinkByName(projectName);
    if (!projectLink) {
      throw new Error(`Project "${projectName}" not found`);
    }

    const project = await this.fileHelper.getProjectObject(projectLink);
    project.hours.push(hour);
    await this.fileHelper.saveProjectObject(project, projectLink);

    const hourString = hour.count === 1 ? "hour" : "hours";
    await this.gitHelper.commitChanges(`Added ${hour.count} ${hourString} to ${projectName}: "${hour.message}"`);
  }

  public getProjectList = async (): Promise<IProjectLink[]> => {
    const config = this.fileHelper.getConfigObject();
    return config.projects;
  }

  public getProjectLinkByName = async (name: string): Promise<IProjectLink | undefined> => {
    const config = this.fileHelper.getConfigObject();

    // TODO foundProject is only the project object in the config file
    const foundProject = config.projects.find((project: IProjectLink) =>  project.name === name);

    return foundProject;
  }

  public getProjectName = async (): Promise<string> => {
    let projectName = this.getProjectNameGit();

    if (!projectName) {
      projectName = await this.getProjectNameUser();
    }

    return projectName;
  }

  private getProjectNameUser = async (): Promise<string> => {
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

    return `${userProjectNamespace}/${userProjectName}`;
  }

  private getProjectNameGit = (): string | undefined => {
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
