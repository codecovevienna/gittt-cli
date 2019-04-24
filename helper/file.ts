import fs from "fs-extra";
import path from "path";
import { IConfigFile, IIntegrationLink, IJiraLink, IProject, IProjectMeta, ITimerFile } from "../interfaces";
import { LogHelper } from "./";

export class FileHelper {
  private configFilePath: string;
  private timerFilePath: string;
  private configDir: string;
  private projectDir: string;
  private configObject: IConfigFile | undefined; // Cache

  constructor(configDir: string, configFileName: string, timerFileName: string, projectDir: string) {
    this.configDir = configDir;
    this.projectDir = path.join(configDir, projectDir);
    this.configFilePath = path.join(configDir, configFileName);
    this.timerFilePath = path.join(configDir, timerFileName);
  }

  public createConfigDir = (): void => {
    fs.ensureDirSync(this.configDir);
    fs.ensureDirSync(this.projectDir);
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

  public addOrUpdateLink = async (link: IIntegrationLink | IJiraLink): Promise<IConfigFile> => {
    const configObject: IConfigFile = await this.getConfigObject();

    // TODO check if already exists
    const cleanLinks: IIntegrationLink[] = configObject.links.filter((li: IIntegrationLink) => {
      // TODO TBD: use different parameters as unique? e.g. more than one jira link per project?
      return li.projectName !== link.projectName;
    });

    cleanLinks.push(link);

    configObject.links = cleanLinks;

    await this.saveConfigObject(configObject);

    return configObject;
  }

  public initProject = async (project: IProject): Promise<IProject> => {
    try {
      const projectPath: string = this.projectMetaToPath(project.meta);
      LogHelper.debug(`Ensuring domain directory for ${project.meta.host}`);
      await fs.ensureDir(projectPath);

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
      await fs.writeJson(this.timerFilePath, initial);
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

  public getConfigObject = async (fromDisk: boolean = false): Promise<IConfigFile> => {
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

  public timerFileExists = (): boolean => {
    try {
      return fs.existsSync(this.timerFilePath);
    } catch (err) {
      LogHelper.error("Error checking timer file existence");
      return false;
    }
  }

  // TODO should maybe be private
  public saveProjectObject = async (project: IProject): Promise<void> => {
    try {
      const projectMetaString: string = this.projectMetaToPath(project.meta);
      const projectFilePath: string = path.join(projectMetaString, `${project.name}.json`);
      LogHelper.debug(`Saving project file to ${projectFilePath}`);
      await fs.writeJson(projectFilePath, project);
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
        const projectFiles: string[] = fs.readdirSync(path.join(this.projectDir, projectDomain));
        for (const projectFile of projectFiles) {
          const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain, projectFile));
          if (project.name === projectName) {
            allFoundProjects.push(project);
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
      await fs.writeJson(this.timerFilePath, timer);
    } catch (err) {
      LogHelper.debug("Error writing timer file", err);
      throw new Error("Error writing timer file");
    }
  }

  public findAllProjects = async (): Promise<IProject[]> => {
    const allProjects: IProject[] = [];
    const projectDomains: string[] = fs.readdirSync(this.projectDir);
    for (const projectDomain of projectDomains) {
      const projectFiles: string[] = fs.readdirSync(path.join(this.projectDir, projectDomain));
      for (const projectFile of projectFiles) {
        const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain, projectFile));
        allProjects.push(project);
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

  private setConfigObject = (config: IConfigFile): void => {
    this.configObject = config;
  }

  private projectMetaToPath = (projectMeta: IProjectMeta): string => {
    const { host, port } = projectMeta;
    return path.join(this.projectDir, `${host.replace(/\./gi, "_")}_${port}`);
  }

  private saveConfigObject = async (config: IConfigFile): Promise<void> => {
    try {
      await fs.writeJson(this.configFilePath, config);
      this.setConfigObject(config);
    } catch (err) {
      LogHelper.debug("Error writing config file", err);
      throw new Error("Error writing config file");
    }
  }
}
