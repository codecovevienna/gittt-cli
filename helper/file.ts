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
  }

  public createConfigDir = (): void => {
    fs.ensureDirSync(this.configDir);
    fs.ensureDirSync(this.projectDir);
  }

  public initConfigFile = async (gitRepo: string): Promise<void> => {
    try {
      const initial: IConfigFile = {
        created: Date.now(),
        gitRepo
      };
      await fs.writeJson(this.configFilePath, initial);
      this.setConfigObject(initial);
    } catch (err) {
      LogHelper.error("Error initializing config file");
    }
  }

  // TODO private?
  // public initHostPath = async (projectDomain: IProjectMeta): Promise<void> => {
  //   try {
  //     await fs.ensureDir(this.projectDomainToPath(projectDomain));
  //   } catch (err) {
  //     LogHelper.error("Error ....")
  //   }
  // }

  public initProject = async (projectDomain: IProjectMeta): Promise<IProject | undefined> => {
    try {

      const projectDomainString = this.projectDomainToPath(projectDomain);
      LogHelper.debug("Ensuring domain for project")
      await fs.ensureDir(projectDomainString);

      const initial: IProject = {
        hours: [],
        name: projectDomain.name,
      };

      const projectFilePath = path.join(projectDomainString, `${projectDomain.name}.json`);

      LogHelper.debug(`Creating project file ${projectFilePath}`)
      await fs.writeJson(projectFilePath, initial);
      return initial;
    } catch (err) {
      LogHelper.error("Error initializing project");
      return undefined;
    }
  }

  public configFileExists = (): boolean => {
    try {
      return fs.existsSync(this.configFilePath);
    } catch (err) {
      LogHelper.error("Error checking config file existence");
      return false;
    }
  }

  public getConfigObject = (force: boolean = false): IConfigFile => {
    if (!this.configObject || force) {
      const configObj: IConfigFile = JSON.parse(fs.readFileSync(this.configFilePath).toString());
      this.setConfigObject(configObj);
      return configObj;
    } else {
      return this.configObject;
    }
  }

  public getProjectObject = (projectDomain: IProjectMeta): Promise<IProject> => {
    // TODO add caching
    const projectDomainString = this.projectDomainToPath(projectDomain);

    return fs.readJson(path.join(this.projectDir, projectDomainString, `${projectDomain.name}.json`));
  }

  public saveConfigObject = async (config: IConfigFile): Promise<boolean> => {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(config));
      this.setConfigObject(config);
      return true;
    } catch (err) {
      LogHelper.error("Error writing config file");
      return false;
    }
  }

  public saveProjectObject = async (project: IProject, projectDomain: IProjectMeta): Promise<boolean> => {
    try {

      const projectDomainString = this.projectDomainToPath(projectDomain);

      await fs.writeJson(path.join(this.projectDir, projectDomainString, `${projectDomain.name}.json`), project);
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

  private projectDomainToPath = (projectDomain: IProjectMeta): string => {
    const { host, port } = projectDomain;
    return path.join(this.projectDir, `${host.replace(".", "_")}_${port}`);
  }
}
