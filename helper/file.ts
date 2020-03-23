import fs, { WriteOptions } from "fs-extra";
import path from "path";
import YAML from 'yaml'
import { IConfigFile, IProject, IProjectMeta, ITimerFile, IGitttFile } from "../interfaces";
import { LogHelper, parseProjectNameFromGitUrl, ProjectHelper } from "./";
import { GitttFileError } from '../types/errors/gitttFileError';

export class FileHelper {
  public static getHomeDir = (): string => {
    const home: string | null = require("os").homedir()
      || process.env.HOME
      || process.env.HOMEPATH
      || process.env.USERPROFIL;

    if (!home) {
      throw new Error("Unable to determinate home directory");
    }

    return home;
  }

  private configFilePath: string;
  private timerFilePath: string;
  private configDir: string;
  private projectDir: string;
  private configObject: IConfigFile | undefined; // Cache
  private jsonWriteOptions: WriteOptions = {
    EOL: "\n",
    spaces: 4,
  };

  constructor(configDir: string, configFileName: string, timerFileName: string, projectDir: string) {
    this.configDir = configDir;
    this.projectDir = path.join(configDir, projectDir);
    this.configFilePath = path.join(configDir, configFileName);
    this.timerFilePath = path.join(configDir, timerFileName);
  }

  public createConfigDir = async (): Promise<void> => {
    await fs.mkdirs(this.configDir);
    await fs.mkdirs(this.projectDir);
  }

  public getProjectPath(project: IProject): string {
    if (!project.meta) {
      return path.join(this.projectDir);
    } else {
      return this.projectMetaToPath(project.meta);
    }
  }

  public initConfigFile = async (gitRepo: string): Promise<IConfigFile> => {
    const initial: IConfigFile = {
      created: Date.now(),
      gitRepo,
      links: [],
    };

    await this.saveConfigObject(initial);

    return initial;
  }

  public initProject = async (project: IProject): Promise<IProject> => {
    try {
      const projectPath: string = await this.getProjectPath(project);

      LogHelper.debug(`Ensuring domain directory for ${project.name}`);
      await fs.mkdirs(projectPath);

      await this.saveProjectObject(project);

      return project;
    } catch (err) {
      LogHelper.debug("Error writing project file", err);
      throw new Error("Error initializing project");
    }
  }

  public initTimerFile = async (): Promise<void> => {
    try {
      const initial: ITimerFile = {
        start: 0,
        stop: 0,
      };
      await fs.writeJson(this.timerFilePath, initial, this.jsonWriteOptions);
    } catch (err) {
      LogHelper.debug("Error initializing timer file", err);
      throw new Error("Error initializing timer file");
    }
  }

  public configDirExists = async (): Promise<boolean> => {
    try {
      return await fs.pathExists(this.configFilePath);
    } catch (err) {
      LogHelper.error("Error checking config file existence");
      return false;
    }
  }

  public getGitttFile = async (): Promise<IGitttFile> => {
    try {
      return YAML.parse((await fs
        .readFile(".gittt.yml"))
        .toString()) as IGitttFile;
    } catch (err) {
      LogHelper.debug("Unable to parse .gittt.yml file", err);
      throw new GitttFileError("Unable to parse .gittt.yml file")
    }
  }

  public getConfigObject = async (fromDisk = false): Promise<IConfigFile> => {
    try {
      if (!this.configObject || fromDisk) {
        const configObj: IConfigFile = await fs.readJson(this.configFilePath);
        this.setConfigObject(configObj);
        return configObj;
      } else {
        return this.configObject;
      }
    } catch (err) {
      LogHelper.debug("Error reading config file", err);
      throw new Error("Error getting config object");
    }
  }

  public async isConfigFileValid(): Promise<boolean> {
    let config: IConfigFile | undefined;

    try {
      config = await this.getConfigObject(true);
    } catch (err) {
      LogHelper.debug(`Unable to parse config file: ${err.message}`);
      return false;
    }

    try {
      parseProjectNameFromGitUrl(config.gitRepo);
      return true;
    } catch (err) {
      LogHelper.debug("Unable to get project name", err);
      return false;
    }
  }

  public timerFileExists = (): boolean => {
    try {
      return fs.existsSync(this.timerFilePath);
    } catch (err) {
      LogHelper.error("Error checking timer file existence");
      return false;
    }
  }

  public saveProjectObject = async (project: IProject): Promise<void> => {
    try {
      const projectPath: string = await this.getProjectPath(project);
      const projectFilePath: string = path.join(projectPath, `${project.name}.json`);
      LogHelper.debug(`Saving project file to ${projectFilePath}`);
      await fs.writeJson(projectFilePath, project, this.jsonWriteOptions);
      // TODO update cache
    } catch (err) {
      LogHelper.debug("Error writing project file", err);
      throw new Error("Error writing project file");
    }
  }

  public invalidateCache = (): void => {
    this.configObject = undefined;
  }

  public getTimerObject = async (): Promise<ITimerFile> => {
    try {
      const timerObj: ITimerFile = await fs.readJson(this.timerFilePath);
      return timerObj;
    } catch (err) {
      LogHelper.debug("Error reading timer object", err);
      throw new Error("Error getting timer object");
    }
  }

  public initReadme = async (): Promise<void> => {
    try {
      await fs.writeFile(path.join(this.configDir, "README.md"), "# Initially generated gittt README.md file");
    } catch (err) {
      LogHelper.debug("Error writing readme file", err);
      throw new Error("Error initializing readme file");
    }
  }

  public findProjectByName = async (projectName: string, projectMeta?: IProjectMeta): Promise<IProject | undefined> => {
    const allFoundProjects: IProject[] = [];

    if (projectMeta) {
      // Use specific domain
      const domainProjects: IProject[] = await this.findProjectsForDomain(projectMeta);
      for (const project of domainProjects) {
        if (project.name === projectName) {
          allFoundProjects.push(project);
        }
      }
    } else {
      // Search in all domains
      const projectDomains: string[] = fs.readdirSync(this.projectDir);
      for (const projectDomain of projectDomains) {
        const tmpStat = fs.lstatSync(path.join(this.projectDir, projectDomain))

        if (tmpStat.isFile()) {
          const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain));
          if (project.name === projectName) {
            allFoundProjects.push(project);
          }
        } else {
          const projectFiles: string[] = fs.readdirSync(path.join(this.projectDir, projectDomain));
          for (const projectFile of projectFiles) {
            const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain, projectFile));
            if (project.name === projectName) {
              allFoundProjects.push(project);
            }
          }
        }
      }
    }

    switch (allFoundProjects.length) {
      case 0:
        // No project found
        return undefined;
      case 1:
        // No project found
        return allFoundProjects[0];
      default:
        // If more than 1 project with the given name gets found, throw error
        throw new Error(`Found more than 1 project named "${projectName}"`);
    }

  }

  public saveTimerObject = async (timer: ITimerFile): Promise<void> => {
    try {
      await fs.writeJson(this.timerFilePath, timer, this.jsonWriteOptions);
    } catch (err) {
      LogHelper.debug("Error writing timer file", err);
      throw new Error("Error writing timer file");
    }
  }

  public findAllProjects = async (): Promise<IProject[]> => {
    const allProjects: IProject[] = [];
    const projectDomains: string[] = fs.readdirSync(this.projectDir);
    for (const projectDomain of projectDomains) {
      const tmpStat = fs.lstatSync(path.join(this.projectDir, projectDomain))

      if (tmpStat.isFile()) {
        const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain));
        allProjects.push(project);
      } else {
        const projectFiles: string[] = fs.readdirSync(path.join(this.projectDir, projectDomain));
        for (const projectFile of projectFiles) {
          const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain, projectFile));
          allProjects.push(project);
        }
      }
    }
    return allProjects;
  }

  public findProjectsForDomain = async (projectMeta: IProjectMeta): Promise<IProject[]> => {
    const projects: IProject[] = [];
    if (!await fs.pathExists(this.projectMetaToPath(projectMeta))) {
      return projects;
    }

    const projectFiles: string[] = fs.readdirSync(this.projectMetaToPath(projectMeta));
    for (const projectFile of projectFiles) {
      const project: IProject = await fs.readJson(path.join(this.projectMetaToPath(projectMeta), projectFile));
      projects.push(project);
    }
    return projects;
  }

  public removeDomainDirectory = async (projectMeta: IProjectMeta, force = false): Promise<void> => {
    const projectsInDomain: IProject[] = await this.findProjectsForDomain(projectMeta);
    if (projectsInDomain.length > 0) {
      if (force) {
        await fs.remove(this.projectMetaToPath(projectMeta));
      } else {
        throw new Error(`${this.projectMetaToPath(projectMeta)} is not empty`);
      }
    } else {
      await fs.remove(this.projectMetaToPath(projectMeta));
    }
  }

  public removeProjectFile = async (project: IProject): Promise<void> => {
    return fs.remove(ProjectHelper.projectToProjectFilename(project));
  }

  private setConfigObject = (config: IConfigFile): void => {
    this.configObject = config;
  }

  private projectMetaToPath = (projectMeta: IProjectMeta): string => {
    return path.join(this.projectDir, ProjectHelper.projectMetaToDomain(projectMeta));
  }

  public saveConfigObject = async (config: IConfigFile): Promise<void> => {
    try {
      await fs.writeJson(this.configFilePath, config, this.jsonWriteOptions);
      this.setConfigObject(config);
    } catch (err) {
      LogHelper.debug("Error writing config file", err);
      throw new Error("Error writing config file");
    }
  }
}
