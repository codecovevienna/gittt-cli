import shelljs, { ExecOutputReturnValue } from "shelljs";
import { IIntegrationLink, IJiraLink, IProject, IProjectMeta, IRecord } from "../interfaces";
import { GitNoOriginError, GitNoUrlError, GitRemoteError, GitNoRepoError, RECORD_TYPES } from "../types";
import {
  FileHelper,
  GitHelper,
  LogHelper,
  parseProjectNameFromGitUrl,
  QuestionHelper,
  RecordHelper,
} from "./";

export class ProjectHelper {
  /**
   * Extracts the domain from a IProjectMetaData object
   *
   * @param projectMeta - MetaData object
   * @returns Domain of the meta data as formatted string
   */
  public static projectMetaToDomain = (projectMeta: IProjectMeta): string => {
    const { host, port } = projectMeta;
    return `${host.replace(/\./gi, "_")}${port ? "_" + port : ""}`;
  }

  /**
   * Constructs a meta data object from a formatted domain string
   *
   * @param domain - formatted domain string
   * @returns Meta data object based on the formatted string
   */
  public static domainToProjectMeta = (domain: string): IProjectMeta => {
    const split: string[] = domain.split("_");
    const potentialPort: number = parseInt(split[split.length - 1], 10);
    let port = 0;
    let splitClean: string[] = [];

    if (!isNaN(potentialPort)) {
      port = potentialPort;
      splitClean = split.slice(0, split.length - 1);
    } else {
      splitClean = split;
    }

    return {
      host: splitClean.join("."),
      port,
    };
  }

  /**
   * @param project - IProject object
   * @returns Filename of the project file
   */
  public static projectToProjectFilename = (project: IProject): string => {
    return `${project.name}.json`;
  }

  /**
   * @param project - IProject object
   * @returns Path of the project file
   */
  public static getProjectPath = (project: IProject): string => {
    return `${ProjectHelper.projectMetaToDomain(project.meta)}/${ProjectHelper.projectToProjectFilename(project)}`;
  }

  private fileHelper: FileHelper;
  private gitHelper: GitHelper;

  constructor(gitHelper: GitHelper, fileHelper: FileHelper) {
    this.gitHelper = gitHelper;
    this.fileHelper = fileHelper;
  }

  public initProject = async (): Promise<IProject> => {
    try {
      const project: IProject = this.getProjectFromGit();

      await this.fileHelper.initProject(project);

      await this.gitHelper.commitChanges(`Initialized project`);

      return project;
    } catch (err) {
      LogHelper.debug("Error writing project file", err);
      throw new Error("Error initializing project");
    }
  }

  public findOrInitProjectByName = async (projectName: string): Promise<IProject> => {
    let foundProject: IProject;

    // Try to find project in projects directory
    const project: IProject | undefined = await this.fileHelper.findProjectByName(projectName);

    if (!project) {
      LogHelper.warn(`Project "${projectName}" not found`);
      try {

        const shouldMigrate: boolean = await QuestionHelper.confirmMigration();
        if (shouldMigrate) {
          const fromDomainProject: string = await QuestionHelper
            .chooseProjectFile(await this.fileHelper.findAllProjects());

          const [domain, name] = fromDomainProject.split("/");
          const fromProject: IProject | undefined = await this.fileHelper.findProjectByName(
            // TODO find a better way?
            name.replace(".json", ""),
            ProjectHelper.domainToProjectMeta(domain),
          );

          if (!fromProject) {
            throw new Error("Unable to find project on disk");
          }

          const toProject: IProject = this.getProjectFromGit();

          foundProject = await this.migrate(fromProject, toProject);
        } else {
          // TODO ask user if he wants to create this project?
          LogHelper.warn("Maybe it would be a great idea to ask the user to do the next step, but never mind ;)");
          LogHelper.info(`Initializing project "${projectName}"`);
          foundProject = await this.fileHelper.initProject(this.getProjectFromGit());
        }
      } catch (err) {
        LogHelper.error("Unable to initialize project, exiting...");
        return process.exit(1);
      }
    } else {
      foundProject = project;
    }

    return foundProject;
  }

  public addRecordsToProject = async (
    records: IRecord[],
    project?: IProject,
    uniqueOnly?: boolean,
    nonOverlappingOnly?: boolean,
  ): Promise<void> => {
    const selectedProject: IProject = project ?
      project :
      await this.findOrInitProjectByName(this.getProjectFromGit().name);

    if (!selectedProject) {
      return;
    }

    records = records.filter((record: IRecord) => {
      let shouldAddRecord = true;

      if (uniqueOnly === true) {
        shouldAddRecord = RecordHelper.isRecordUnique(record, selectedProject.records);
      }
      if (nonOverlappingOnly === true) {
        shouldAddRecord = RecordHelper.isRecordOverlapping(record, selectedProject.records);
      }

      if (shouldAddRecord) {
        return record;
      }

      LogHelper.warn(
        `Could not add record (amount: ${record.amount}, end: ${record.end}, type: ${record.type}) to ${selectedProject.name}`,
      );
    });

    if (records.length === 1) {
      let record: IRecord = records[0];

      LogHelper.info(`Adding record (amount: ${record.amount}, type: ${record.type}) to ${selectedProject.name}`);

      record = RecordHelper.setRecordDefaults(record);

      selectedProject.records.push(record);
      await this.fileHelper.saveProjectObject(selectedProject);

      // TODO differ between types
      const hourString: string = record.amount === 1 ? "hour" : "hours";
      if (record.message) {
        await this.gitHelper.commitChanges(
          `Added ${record.amount} ${hourString} to ${selectedProject.name}: "${record.message}"`,
        );
      } else {
        await this.gitHelper.commitChanges(`Added ${record.amount} ${hourString} to ${selectedProject.name}`);
      }
    } else if (records.length > 1) {
      if (records.length > 1) {
        records.forEach((record: IRecord) => {
          record = RecordHelper.setRecordDefaults(record);
          selectedProject.records.push(record);
        });

        LogHelper.info(`Adding (${records.length}) records to ${selectedProject.name}`);
        await this.fileHelper.saveProjectObject(selectedProject);
        await this.gitHelper.commitChanges(`Added ${records.length} records to ${selectedProject.name}`);
      }
    }
  }

  public addRecordToProject = async (
    record: IRecord,
    project?: IProject,
    uniqueOnly?: boolean,
    nonOverlappingOnly?: boolean,
  ): Promise<void> => this.addRecordsToProject([record], project, uniqueOnly, nonOverlappingOnly)

  // TODO projectName optional? find it by .git folder
  public getTotalHours = async (projectName: string): Promise<number> => {
    const project: IProject | undefined = await this.fileHelper.findProjectByName(projectName);
    if (!project) {
      throw new Error(`Project "${projectName}" not found`);
    }

    return project.records.reduce((prev: number, curr: IRecord) => {
      if (curr.type === RECORD_TYPES.Time) {
        return prev + curr.amount;
      } else {
        return prev;
      }
    }, 0);
  }

  public getProjectByName = async (name: string, tryGit = false): Promise<IProject | undefined> => {
    const projects: IProject[] = await this.fileHelper.findAllProjects();
    let foundProject: IProject | undefined = projects.find((p: IProject) => p.name === name);

    if (!foundProject && tryGit) {
      try {
        foundProject = this.getProjectFromGit();
        // Loads the records from the filesystem to avoid empty record array
        foundProject = await this.fileHelper.findProjectByName(
          foundProject.name,
        );
      } catch (err) {
        LogHelper.debug(`Unable to get project from git directory: ${err.message}`);
        // throw err;
      }
    }

    return foundProject;
  }

  public getProjectFromGit = (): IProject => {
    LogHelper.debug("Checking number of remote urls");
    const gitRemoteExec: ExecOutputReturnValue = shelljs.exec("git remote", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitRemoteExec.code !== 0) {
      if (gitRemoteExec.code === 128) {
        LogHelper.debug(`"git remote" returned with exit code 128`);
        throw new GitNoRepoError("Current directory does not appear to be a valid git repository");
      }
      LogHelper.debug("Error executing git remote", new Error(gitRemoteExec.stdout));
      throw new GitRemoteError("Unable to get remotes from git config");
    }

    const remotes: string[] = gitRemoteExec.stdout.trim().split("\n");

    if (remotes.length > 1) {
      LogHelper.debug("Found more than one remotes, trying to find origin");
      const hasOrigin: boolean = remotes.indexOf("origin") !== -1;

      if (!hasOrigin) {
        LogHelper.error(`Unable to find any remote called "origin"`);
        throw new GitNoOriginError(`Unable to find any remote called "origin"`);
      }
    }

    LogHelper.debug("Trying to find project name from .git folder");
    const gitConfigExec: ExecOutputReturnValue = shelljs.exec("git config remote.origin.url", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4) {
      LogHelper.debug("Error executing git config remote.origin.url", new Error(gitConfigExec.stdout));
      throw new GitNoUrlError("Unable to get URL from git config");
    }

    const originUrl: string = gitConfigExec.stdout.trim();

    return parseProjectNameFromGitUrl(originUrl);
  }

  public migrate = async (from: IProject, to: IProject): Promise<IProject> => {
    LogHelper.info("Starting migrate procedure");
    LogHelper.info(`${from.name} -> ${to.name}`);

    // Ensure all records are present in the "from" project
    const populatedFrom: IProject | undefined = await this.fileHelper.findProjectByName(from.name, from.meta);
    if (!populatedFrom) {
      throw new Error(`Unable to get records from ${from.name}`);
    }

    // Create instance of new project with records from old project
    const migratedProject: IProject = {
      meta: to.meta,
      name: to.name,
      records: populatedFrom.records,
    };

    // Initialize new project
    await this.fileHelper.initProject(migratedProject);
    LogHelper.info(`✓ Migrated Project`);

    // Removing old project file
    await this.fileHelper.removeProjectFile(from);
    LogHelper.info(`✓ Removed old project file`);

    // Get all projects associated with the old meta information
    const fromDomainProjects: IProject[] = await this.fileHelper.findProjectsForDomain(from.meta);

    // Remove the domain directory if old project was the only one with this meta data
    // TODO check if really the same project object?
    if (fromDomainProjects.length === 0) {
      // we know that it is not empty, force delete it
      LogHelper.debug(`${from.name} is the only project on ${from.meta.host}, domain directory will be removed`);
      await this.fileHelper.removeDomainDirectory(from.meta, true);
      LogHelper.info(`✓ Removed old domain directory`);
    }

    const link: IIntegrationLink | undefined = await this.fileHelper.findLinkByProject(from);
    if (!link) {
      LogHelper.debug(`No link found for project "${from.name}"`);
    } else {
      switch (link.linkType) {
        case "Jira":
          const migratedLink: IJiraLink = link as IJiraLink;
          migratedLink.projectName = to.name;

          await this.fileHelper.addOrUpdateLink(migratedLink);
          LogHelper.info(`✓ Updated jira link`);
          break;

        default:
          LogHelper.error("✗ Invalid link type");
          break;
      }
    }

    return migratedProject;
  }

  public getOrAskForProjectFromGit = async (): Promise<IProject | undefined> => {
    let projectName: string;
    let projectMeta: IProjectMeta | undefined;

    try {
      const projectFromGit: IProject = this.getProjectFromGit();
      projectName = projectFromGit.name;
    } catch (e) {
      if (e instanceof GitRemoteError || e instanceof GitNoRepoError) {
        const selectedProjectName: string = await QuestionHelper.
          chooseProjectFile(await this.fileHelper.findAllProjects());
        const [domain, name] = selectedProjectName.split("/");
        // TODO find a better way?
        projectName = name.replace(".json", "");
        projectMeta = ProjectHelper.domainToProjectMeta(domain);
      } else {
        throw e;
      }
    }

    const project: IProject | undefined = await this.fileHelper.findProjectByName(
      projectName,
      projectMeta,
    );

    if (!project) {
      throw new Error("Unable to find project on disk");
    }

    return project;
  }
}
