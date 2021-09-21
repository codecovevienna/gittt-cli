import { FileHelper } from './file';
import { IProject, IIntegrationLink, IConfigFile, IJiraLink, IMultipieInputLink, IMultipieStoreLink } from '../interfaces';

export class ConfigHelper {
  private static instance: ConfigHelper;

  private fileHelper: FileHelper;

  constructor(fileHelper: FileHelper) {
    this.fileHelper = fileHelper;
  }

  public static getInstance(fileHelper?: FileHelper): ConfigHelper {
    if (!ConfigHelper.instance) {
      if (!fileHelper) {
        throw new Error('ConfigHelper has to be initialized with a FileHelper');
      }
      ConfigHelper.instance = new ConfigHelper(fileHelper);
    }

    return ConfigHelper.instance;
  }

  public static getNewInstance(fileHelper?: FileHelper): ConfigHelper {
    if (!fileHelper) {
      throw new Error('ConfigHelper has to be initialized with a FileHelper');
    }
    ConfigHelper.instance = new ConfigHelper(fileHelper);
    return ConfigHelper.getInstance(fileHelper);
  }

  public isInitialized = async (): Promise<boolean> => {
    return (await this.fileHelper.configDirExists()) &&
      (await this.fileHelper.isConfigFileValid());
  }

  public findLinksByProject = async (project: IProject, linkType?: string): Promise<IIntegrationLink[]> => {
    const configObject: IConfigFile = await this.fileHelper.getConfigObject();

    const foundLinks: IIntegrationLink[] = configObject.links.filter((li: IIntegrationLink) => {
      // TODO TBD: use different parameters as unique? e.g. more than one jira link per project?
      if (linkType) {
        return li.projectName === project.name && li.linkType === linkType;
      }
      return li.projectName === project.name;
    });

    return foundLinks;
  }

  public addOrUpdateLink = async (link: IIntegrationLink | IJiraLink | IMultipieStoreLink): Promise<IConfigFile> => {
    const configObject: IConfigFile = await this.fileHelper.getConfigObject();

    // TODO check if already exists
    const cleanLinks: IIntegrationLink[] = configObject.links.filter((li: IIntegrationLink) => {
      // TODO linkType can be taken from class
      // TODO TBD: use different parameters as unique? e.g. more than one jira link per project?
      return !((li.projectName === link.projectName) && (li.linkType === link.linkType));
    });

    cleanLinks.push(link);

    configObject.links = cleanLinks;

    await this.fileHelper.saveConfigObject(configObject);

    return configObject;
  }
}