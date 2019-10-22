import shelljs, { ExecOutputReturnValue } from "shelljs";
import uuid from "uuid/v1";
import { IProject, IRecord } from "../interfaces";
import { FileHelper, GitHelper, LogHelper, parseProjectNameFromGitUrl } from "./index";

export class ProjectHelper {
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

        // TODO ask user if he wants to create this project?
        LogHelper.warn("Maybe it would be a great idea to ask the user to do the next step, but never mind ;)");
        LogHelper.info(`Initializing project "${projectName}"`);
        foundProject = await this.fileHelper.initProject(this.getProjectFromGit());
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
      let shouldAddRecord: boolean = true;

      if (uniqueOnly === true) {
        shouldAddRecord = this.isRecordUnique(record, project.records);
      }
      if (nonOverlappingOnly === true) {
        shouldAddRecord = this.isRecordOverlapping(record, project.records);
      }

      if (shouldAddRecord) {
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
        await this.gitHelper.commitChanges(`Added ${records.length} records to ${project.name}`);
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

  /*
   * returns {boolean} true if provided record is identical to any record in records
   */
  private isRecordUnique = (record: IRecord, records: IRecord[]): boolean => {
    // check if amount, end, message and type is found in records
    return records.find((existingRecord: IRecord) => {
      return existingRecord.amount === record.amount &&
        existingRecord.end === record.end &&
        existingRecord.message === record.message &&
        existingRecord.type === record.type;
    }) === undefined;
  }

  /*
   * returns {boolean} true if provided record is overlapping any record in records
   */
  private isRecordOverlapping = (record: IRecord, records: IRecord[]): boolean => {
    // check if any overlapping records are present
    return records.find((existingRecord: IRecord) => {
      const startExisting: number = existingRecord.end - existingRecord.amount;
      const startAdd: number = record.end - record.amount;
      const endExisting: number = existingRecord.end;
      const endAdd: number = record.end;
      if (
        (startAdd < startExisting && endAdd <= endExisting) ||
        (startAdd >= startExisting && endAdd > endExisting)
      ) {
        return false;
      }
      return true;
    }) === undefined;
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
