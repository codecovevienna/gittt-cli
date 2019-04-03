import inquirer from "inquirer";
import shelljs, { ExecOutputReturnValue, exit } from "shelljs";
import { IHour, IProject, IProjectNameAnswers } from "../interfaces";
import { FileHelper, GitHelper, LogHelper } from "./index";

export class ProjectHelper {
  public static parseProjectNameFromGitUrl = (input: string): IProject | undefined => {
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

    const nameSplit = name.split("/")

    let parsedName;

    if (nameSplit.length === 2) {
      // Assuming namespace/project-name
      const [
        namespace,
        projectName
      ] = nameSplit
      parsedName = `${namespace}_${projectName}`
    } else {
      // No slash found, using raw name
      parsedName = name
    }

    return {
      meta: {
        host,
        port: parseInt(port.replace(":", ""), 10),
        raw: input
      },
      hours: [],
      name: parsedName,
    };
  }
  private fileHelper: FileHelper;
  private gitHelper: GitHelper;

  constructor(gitHelper: GitHelper, fileHelper: FileHelper) {
    this.gitHelper = gitHelper;
    this.fileHelper = fileHelper;
  }

  public addHoursToProject = async (projectName: string, hour: IHour): Promise<void> => {
    let foundProject: IProject;

    // Try to find project in projects directory
    const project = await this.fileHelper.getProjectByName(projectName);

    if (!project) {
      LogHelper.warn(`Project "${projectName}" not found`);
      try {
        const tmp: IProject = await this.getProject()
        // TODO ask user?
        foundProject = await this.fileHelper.initProject(projectName, tmp.meta);
      } catch (err) {
        LogHelper.error("Unable to initialize project, exiting...")
        return process.exit(1);
      }
    } else {
      foundProject = project
    }

    foundProject.hours.push(hour);
    await this.fileHelper.saveProjectObject(foundProject);

    const hourString = hour.count === 1 ? "hour" : "hours";
    if (hour.message) {
      await this.gitHelper.commitChanges(`Added ${hour.count} ${hourString} to ${projectName}: "${hour.message}"`);
    } else {
      await this.gitHelper.commitChanges(`Added ${hour.count} ${hourString} to ${projectName}`);
    }
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

  public getProject = async (): Promise<IProject> => {
    let project: IProject | undefined = this.getProjectNameGit();

    if (!project) {
      project = await this.getProjectNameUser();
    }

    console.log(project)

    return project;
  }

  private getProjectNameUser = async (): Promise<IProject> => {
    LogHelper.info("Unable to determinate project, please add it manually");
    // TODO ask if only local or ask for git url
    // TODO parse git url and create IProject
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

    const project: IProject = {
      meta: {
        // TODO using inquirer
        host: "TO_BE_ADDED",
        port: 1337,
      },
      name: `${userProjectNamespace}/${userProjectName}`,
      hours: []
    }

    this.fileHelper.initProject(`${userProjectNamespace}/${userProjectName}`, project.meta)

    return project;
  }

  private getProjectNameGit = (): IProject | undefined => {
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
