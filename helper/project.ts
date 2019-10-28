import fs, { WriteOptions } from "fs-extra";
import shelljs, { ExecOutputReturnValue } from "shelljs";
import { isNullOrUndefined } from "util";
import uuid from "uuid/v1";
import { IIntegrationLink, IJiraLink, IProject, IProjectMeta, IRecord } from "../interfaces";
import { FileHelper, GitHelper, LogHelper, parseProjectNameFromGitUrl } from "./index";
import { QuestionHelper } from "./question";

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
    let port: number = 0;
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
    uniqueOnly?: boolean,
    nonOverlappingOnly?: boolean,
  ): Promise<void> => {
    const project: IProject = await this.findOrInitProjectByName(this.getProjectFromGit().name);

    if (!project) {
      return;
    }

    records = records.filter((record: IRecord) => {
      let addRecord: boolean = true;

      if (uniqueOnly === true) {
        addRecord = this.findUnique(record, project.records);
      }
      if (nonOverlappingOnly === true) {
        addRecord = this.findOverlapping(record, project.records);
      }

      if (addRecord) {
        return record;
      }

      LogHelper.warn(
        `Could not add record (amount: ${record.amount}, end: ${record.end}, type: ${record.type}) to ${project.name}`,
      );
    });

    if (records.length === 1) {
      let record: IRecord = records[0];

      LogHelper.info(`Adding record (amount: ${record.amount}, type: ${record.type}) to ${project.name}`);

      record = this.setRecordDefaults(record);

      project.records.push(record);
      await this.fileHelper.saveProjectObject(project);

      // TODO differ between types
      const hourString: string = record.amount === 1 ? "hour" : "hours";
      if (record.message) {
        await this.gitHelper.commitChanges(
          `Added ${record.amount} ${hourString} to ${project.name}: "${record.message}"`,
        );
      } else {
        await this.gitHelper.commitChanges(`Added ${record.amount} ${hourString} to ${project.name}`);
      }
    } else if (records.length > 1) {
      if (records.length > 1) {
        records.forEach((record: IRecord) => {

          record = this.setRecordDefaults(record);
          project.records.push(record);
        });

        LogHelper.info(`Adding (${records.length}) records to ${project.name}`);
        await this.fileHelper.saveProjectObject(project);
        await this.gitHelper.commitChanges(`Added ${records.length} to ${project.name}`);
      }
    }
  }

  public addRecordToProject = async (
    record: IRecord,
    uniqueOnly?: boolean,
    nonOverlappingOnly?: boolean,
  ): Promise<void> => this.addRecordsToProject([record], uniqueOnly, nonOverlappingOnly)

  // TODO projectName optional? find it by .git folder
  public getTotalHours = async (projectName: string): Promise<number> => {
    const project: IProject | undefined = await this.fileHelper.findProjectByName(projectName);
    if (!project) {
      throw new Error(`Project "${projectName}" not found`);
    }

    return project.records.reduce((prev: number, curr: IRecord) => {
      if (curr.type === "Time") {
        return prev + curr.amount;
      } else {
        return prev;
      }
    }, 0);
  }

  public getProjectFromGit = (): IProject => {
    LogHelper.debug("Checking number of remote urls");
    const gitRemoteExec: ExecOutputReturnValue = shelljs.exec("git remote", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitRemoteExec.code !== 0) {
      LogHelper.debug("Error executing git remote", new Error(gitRemoteExec.stdout));
      throw new Error("Unable to get remotes from git config");
    }

    const remotes: string[] = gitRemoteExec.stdout.trim().split("\n");

    if (remotes.length > 1) {
      LogHelper.debug("Found more than one remotes, trying to find origin");
      const hasOrigin: boolean = remotes.indexOf("origin") !== -1;

      if (!hasOrigin) {
        LogHelper.error(`Unable to find any remote called "origin"`);
        throw new Error(`Unable to find any remote called "origin"`);
      }
    }

    LogHelper.debug("Trying to find project name from .git folder");
    const gitConfigExec: ExecOutputReturnValue = shelljs.exec("git config remote.origin.url", {
      silent: true,
    }) as ExecOutputReturnValue;

    if (gitConfigExec.code !== 0 || gitConfigExec.stdout.length < 4) {
      LogHelper.debug("Error executing git config remote.origin.url", new Error(gitConfigExec.stdout));
      throw new Error("Unable to get URL from git config");
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

  private findUnique = (record: IRecord, records: IRecord[]): boolean => {
    // check if amount, end, message and type is found in records
    return isNullOrUndefined(records.find((existingRecord: IRecord) =>
      existingRecord.amount === record.amount &&
      existingRecord.end === record.end &&
      existingRecord.message === record.message &&
      existingRecord.type === record.type));
  }

  private findOverlapping = (record: IRecord, records: IRecord[]): boolean => {
    // check if any overlapping records are present
    return isNullOrUndefined(records.find((existingRecord: IRecord) => {
      if (isNullOrUndefined(existingRecord.end)) {
        return false;
      }
      if (isNullOrUndefined(record.end)) {
        return false;
      }
      const startExisting: number = existingRecord.end - existingRecord.amount;
      const startAdd: number = record.end - record.amount;
      const endExisting: number = existingRecord.end;
      const endAdd: number = record.end;
      if ((startAdd < startExisting && endAdd <= endExisting) || (startAdd >= startExisting && endAdd > endExisting)) {
        return true;
      }
      return false;
    }));
  }

  private setRecordDefaults = (record: IRecord): IRecord => {
    // Add unique identifier to each record
    if (!record.guid) {
      record.guid = uuid();
    }

    if (!record.created) {
      const now: number = Date.now();
      record.created = now;
      record.updated = now;
    }

    return record;
  }
}
