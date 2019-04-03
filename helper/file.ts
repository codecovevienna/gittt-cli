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
      name: "should be removed"
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

  // TODO private?
  // public initHostPath = async (projectDomain: IProjectMeta): Promise<void> => {
  //   try {
  //     await fs.ensureDir(this.projectDomainToPath(projectDomain));
  //   } catch (err) {
  //     LogHelper.error("Error ....")
  //   }
  // }

  public initProject = async (projectName: string, projectMeta: IProjectMeta): Promise<IProject> => {
    try {
      const projectPath = this.projectMetaToPath(projectMeta);
      LogHelper.debug(`Ensuring domain directory for ${projectMeta.host}`)
      await fs.ensureDir(projectPath);

      const initial: IProject = {
        hours: [],
        name: projectName,
      };

      const projectFilePath = path.join(projectPath, `${projectName}.json`);

      LogHelper.debug(`Creating project file ${projectFilePath}`)
      await fs.writeJson(projectFilePath, initial);
      return initial;
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

  public getProjectObject = async (projectMeta: IProjectMeta): Promise<IProject | undefined> => {
    try {
      // TODO add caching
      const projectDomainPath = this.projectMetaToPath(projectMeta);

      if (!await fs.pathExists(projectDomainPath)) {
        LogHelper.warn(`Unable to find project domain directory ${projectDomainPath}`)
        return undefined;
      }

      const projectFilePath = path.join(projectDomainPath, `${projectMeta.name}.json`)

      if (!await fs.pathExists(projectDomainPath)) {
        LogHelper.warn(`Unable to find project file ${projectFilePath}`)
        return undefined;
      }

      return await fs.readJson(projectFilePath) as IProject;
    } catch (err) {
      LogHelper.error("Error getting project object")
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

  public saveProjectObject = async (project: IProject, projectMeta: IProjectMeta): Promise<void> => {
    try {

      // let projectMetaFound: IProjectMeta | undefined;

      // if (!projectMeta) {
      //   projectMetaFound = await this.project(project.name)
      // } else {
      //   projectMetaFound = projectMeta;
      // }

      // if (!projectMetaFound) {
      //   throw new Error("Unable to find project meta data")
      // }

      const projectMetaString = this.projectMetaToPath(projectMeta);

      await fs.writeJson(path.join(projectMetaString, `${projectMeta.name}.json`), project);
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

  public getProjectByName = async (projectName: string, projectMeta?: IProjectMeta): Promise<IProject | undefined> => {
    const allFoundProjects: IProject[] = [];

    if (projectMeta) {
      // Use specific domain
      const domainProjects = await this.getProjectsForDomain(projectMeta);
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

  public getProjectMeta = async (projectName: string): Promise<IProjectMeta | undefined> => {
    const projectDomains = fs.readdirSync(this.projectDir);
    for (const projectDomain of projectDomains) {
      const projectFiles = fs.readdirSync(path.join(this.projectDir, projectDomain))
      for (const projectFile of projectFiles) {
        const project: IProject = await fs.readJson(path.join(this.projectDir, projectDomain, projectFile))
        if (project.name === projectName) {
          return FileHelper.decodeDomainDirectory(projectDomain)
        }
      }
    }
  }

  public getAllProjects = async (): Promise<IProject[]> => {
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

  public getProjectsForDomain = async (projectMeta: IProjectMeta): Promise<IProject[]> => {
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
