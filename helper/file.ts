import fs from "fs";
import path from "path";
import { IConfigFile } from "../interfaces";
import { LogHelper } from "./";

export class FileHelper {
  private configFilePath: string;
  private configDir: string;
  private configObject: IConfigFile | undefined; // Cache

  constructor(configDir: string, configFileName: string) {
    this.configDir = configDir;
    this.configFilePath = path.join(configDir, configFileName);
  }

  public createConfigDir = (): void => {
    try {
      fs.mkdirSync(this.configDir);
    } catch (err) {
      LogHelper.error("Error creating config directory");
    }
  }

  public initConfigFile = async (gitRepo: string): Promise<void> => {
    try {
      const initial: IConfigFile = {
        created: Date.now(),
        gitRepo,
        projects: [],
      };
      fs.writeFileSync(this.configFilePath, JSON.stringify(initial));
      this.setConfigObject(initial);
    } catch (err) {
      LogHelper.error("Error initializing config file");
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

  public getConfigObject = (): IConfigFile => {
    if (!this.configObject) {
      return JSON.parse(fs.readFileSync(this.configFilePath).toString());
    } else {
      return this.configObject;
    }
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

  public invalidateCache = (): void => {
    this.configObject = undefined;
  }

  private setConfigObject = (config: IConfigFile): void => {
    this.configObject = config;
  }

}
