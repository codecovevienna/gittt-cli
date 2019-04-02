import fs from "fs-extra";
import path from "path";
import { IConfigFile, IProject, IProjectMeta } from "../interfaces";
import { LogHelper } from "./";

export class FileHelper {
  private configFilePath: string;
  private configDir: string;
  private projectDir: string;
  private configObject: IConfigFile | undefined; // Cache

  constructor(configDir: string, configFileName: string, projectDir: string) {
    this.configDir = configDir;
    this.projectDir = path.join(configDir, projectDir);
    this.configFilePath = path.join(configDir, configFileName);
    this.createConfigDir();
  }

  private createConfigDir = (): void => {
    fs.ensureDirSync(this.configDir);
    fs.ensureDirSync(this.projectDir);
  }

  public initConfigFile = async (gitRepo: string): Promise<boolean> => {
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

  public initProject = async (projectMeta: IProjectMeta): Promise<IProject | undefined> => {
    try {

      const projectPath = this.projectMetaToPath(projectMeta);
      LogHelper.debug(`Ensuring domain directory for ${projectMeta.host}`)
      await fs.ensureDir(projectPath);

      const initial: IProject = {
        hours: [],
        name: projectMeta.name,
      };

      const projectFilePath = path.join(projectPath, `${projectMeta.name}.json`);

      LogHelper.debug(`Creating project file ${projectFilePath}`)
      await fs.writeJson(projectFilePath, initial);
      return initial;
    } catch (err) {
      LogHelper.error("Error initializing project");
      return undefined;
    }
  }

  public configFileExists = async (): Promise<boolean> => {
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

  public saveConfigObject = async (config: IConfigFile): Promise<boolean> => {
    try {
      await fs.writeJson(this.configFilePath, config);
      this.setConfigObject(config);
      return true;
    } catch (err) {
      LogHelper.error("Error writing config file");
      return false;
    }
  }

  public saveProjectObject = async (project: IProject, projectDomain: IProjectMeta): Promise<boolean> => {
    try {

      const projectDomainString = this.projectMetaToPath(projectDomain);

      await fs.writeJson(path.join(projectDomainString, `${projectDomain.name}.json`), project);
      // TODO update cache
      return true;
    } catch (err) {
      LogHelper.error("Error writing config file");
      return false;
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

  public getProjects = async (): Promise<string[]> => {
    // const projectNames: string[] = [];
    // const projectDomains = fs.readdirSync(this.projectDir);
    // for (const projectDomain of projectDomains) {
    //   projectNames.pushAll = fs.readdirSync(projectDomain);
    // }
    return []
  }

  private setConfigObject = (config: IConfigFile): void => {
    this.configObject = config;
  }

  private projectMetaToPath = (projectDomain: IProjectMeta): string => {
    const { host, port } = projectDomain;
    return path.join(this.projectDir, `${host.replace(".", "_")}_${port}`);
  }
}
