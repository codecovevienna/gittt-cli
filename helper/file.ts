import fs from "fs-extra";
import path from "path";
import { IConfigFile, IProject, IProjectLink, ITimerFile } from "../interfaces";
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

  public initConfigFile = async (gitRepo: string): Promise<void> => {
    try {
      const initial: IConfigFile = {
        created: Date.now(),
        gitRepo,
        projects: [],
      };
      await fs.writeJson(this.configFilePath, initial);
      this.setConfigObject(initial);
    } catch (err) {
      LogHelper.error("Error initializing config file");
    }
  }

  public initTimerFile = async (start: Date): Promise<void> => {
    try {
      const initial: ITimerFile = {
        start: 0,
        stop: 0
      };
      await fs.writeJson(this.timerFilePath, initial);
    } catch (err) {
      LogHelper.error("Error initializing project file");
    }
  }

  public initProjectFile = async (projectLink: IProjectLink): Promise<void> => {
    try {
      const initial: IProject = {
        guid: projectLink.guid,
        hours: [],
        name: projectLink.name,
      };
      await fs.writeJson(path.join(this.projectDir, projectLink.file), initial);
    } catch (err) {
      LogHelper.error("Error initializing project file");
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

  public timerFileExists = (): boolean => {
    try {
      return fs.existsSync(this.timerFilePath);
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

  public getProjectObject = (link: IProjectLink): IProject => {
    // TODO add caching
    return JSON.parse(fs.readFileSync(path.join(this.projectDir, link.file)).toString());
  }

  public getTimerObject = (): ITimerFile => {
    return fs.readJSONSync(this.timerFilePath);
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

  public saveProjectObject = async (project: IProject, link: IProjectLink): Promise<boolean> => {
    try {
      fs.writeFileSync(path.join(this.projectDir, link.file), JSON.stringify(project));
      // TODO update cache
      return true;
    } catch (err) {
      LogHelper.error("Error writing config file");
      return false;
    }
  }

  public saveTimerObject = async (timer: ITimerFile): Promise<boolean> => {
    try {
      fs.writeJSONSync(this.configFilePath, timer);
      return true;
    } catch (err) {
      LogHelper.error("Error writing config file");
      return false;
    }
  }

  public invalidateCache = (): void => {
    this.configObject = undefined;
  }

  private setConfigObject = (config: IConfigFile): void => {
    this.configObject = config;
  }

}
