import fs from "fs-extra";
import path from "path";
import { IConfigFile, IProject, IProjectMeta } from "../interfaces";
import { LogHelper } from "./";

export class FileHelper {
  public static decodeDomainDirectory = (domainDirectory: string): IProjectMeta => {
    const split = domainDirectory.split("_");
    const port = parseInt(split[split.length - 1], 10);

    const rawHost = domainDirectory.replace(`_${port}`, "");
    const host = rawHost.replace(/\_/gi, ".");

    return {
      host,
      port,
    }
  }

  private configFilePath: string;
  private configDir: string;
  private projectDir: string;
  private configObject: IConfigFile | undefined; // Cache

  constructor(configDir: string, configFileName: string, projectDir: string) {
    this.configDir = configDir;
    this.projectDir = path.join(configDir, projectDir);
    this.configFilePath = path.join(configDir, configFileName);
  }

  public createConfigDir = (): void => {
    fs.ensureDirSync(this.configDir);
    fs.ensureDirSync(this.projectDir);
  }

  public initConfigFile = async (gitRepo: string): Promise<void> => {
    const initial: IConfigFile = {
      created: Date.now(),
      gitRepo
    };

    return await this.saveConfigObject(initial);
  }

  // TODO refactor to use only IProject
  public initProject = async (project: IProject): Promise<IProject> => {
    try {
      const projectPath = this.projectMetaToPath(project.meta);
      LogHelper.debug(`Ensuring domain directory for ${project.meta.host}`)
      await fs.ensureDir(projectPath);

      await this.saveProjectObject(project);

      return project;
    } catch (err) {
      LogHelper.debug("Error writing project file", err);
      throw new Error("Error initializing project");
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

  public getConfigObject = async (fromDisk: boolean = false): Promise<IConfigFile | undefined> => {
    try {
      if (!this.configObject || fromDisk) {
        const configObj: IConfigFile = await fs.readJson(this.configFilePath);
        this.setConfigObject(configObj);
        return configObj;
      } else {
        return this.configObject;
      }
    } catch (err) {
      LogHelper.error("Error getting config object")
      return undefined
    }
  }

  public saveConfigObject = async (config: IConfigFile): Promise<void> => {
    try {
      await fs.writeJson(this.configFilePath, config);
      this.setConfigObject(config);
    } catch (err) {
      LogHelper.debug("Error writing config file", err);
      throw new Error("Error writing config file")
    }
  }

  public saveProjectObject = async (project: IProject /*, projectMeta: IProjectMeta*/): Promise<void> => {
    try {
      const projectMetaString = this.projectMetaToPath(project.meta);

      await fs.writeJson(path.join(projectMetaString, `${project.name}.json`), project);
      // TODO update cache
    } catch (err) {
      LogHelper.debug("Error writing project file", err);
      throw new Error("Error writing project file")
    }
  }

  public invalidateCache = (): void => {
    this.configObject = undefined;
  }

  public initReadme = async (): Promise<void> => {
    try {
      await fs.writeFile(path.join(this.configDir, "README.md"), "# Initially generated gittt README.md file");
    } catch (err) {
      LogHelper.error("Error initializing project file");
      throw new Error("Error initializing project file")
    }
  }

  public findProjectByName = async (projectName: string, projectMeta?: IProjectMeta): Promise<IProject | undefined> => {
    const allFoundProjects: IProject[] = [];

    if (projectMeta) {
      // Use specific domain
      const domainProjects = await this.findProjectsForDomain(projectMeta);
      for (const project of domainProjects) {
        if (project.name === projectName) {
          allFoundProjects.push(project);
        }
      }
    } else {
      // Search in all domains
      const projectDomains = fs.readdirSync(this.projectDir);
      for (const projectDomain of projectDomains) {
        const projectFiles = fs.readdirSync(path.join(this.projectDir, projectDomain))
        for (const projectFile of projectFiles) {
          const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain, projectFile))
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
        throw new Error(`Found more than 1 project named "${projectName}"`)
    }

  }

  public findAllProjects = async (): Promise<IProject[]> => {
    const allProjects: IProject[] = [];
    const projectDomains = fs.readdirSync(this.projectDir);
    for (const projectDomain of projectDomains) {
      const projectFiles = fs.readdirSync(path.join(this.projectDir, projectDomain))
      for (const projectFile of projectFiles) {
        const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain, projectFile))
        allProjects.push(project);
      }
    }
    return allProjects
  }

  public findProjectsForDomain = async (projectMeta: IProjectMeta): Promise<IProject[]> => {
    const projects: IProject[] = [];
    if (!await fs.pathExists(this.projectMetaToPath(projectMeta))) {
      return projects
    }

    const projectFiles = fs.readdirSync(this.projectMetaToPath(projectMeta))
    for (const projectFile of projectFiles) {
      const project: IProject = await fs.readJson(path.join(this.projectMetaToPath(projectMeta), projectFile))
      projects.push(project);
    }
    return projects
  }

  private setConfigObject = (config: IConfigFile): void => {
    this.configObject = config;
  }

  private projectMetaToPath = (projectMeta: IProjectMeta): string => {
    const { host, port } = projectMeta;
    return path.join(this.projectDir, `${host.replace(/\./gi, "_")}_${port}`);
  }
}
