import fs, { WriteOptions } from "fs-extra";
import shelljs, { ExecOutputReturnValue } from "shelljs";
import uuid from "uuid/v1";
import { IIntegrationLink, IJiraLink, IProject, IProjectMeta, IRecord } from "../interfaces";
import { FileHelper, GitHelper, LogHelper, parseProjectNameFromGitUrl } from "./index";
import { QuestionHelper } from "./question";

export class ProjectHelper {
  public static projectMetaToDomain = (projectMeta: IProjectMeta): string => {
    const { host, port } = projectMeta;
    return `${host.replace(/\./gi, "_")}${port ? "_" + port : ""}`;
  }
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
  public static projectToProjectFilename = (project: IProject): string => {
    return `${project.name}.json`;
  }
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

  public addRecordToProject = async (record: IRecord): Promise<void> => {
    let foundProject: IProject;

    const projectFromGit: IProject = this.getProjectFromGit();
    const projectName: string = projectFromGit.name;

    // Try to find project in projects directory
    const project: IProject | undefined = await this.fileHelper.findProjectByName(projectName);

    if (!project) {
      LogHelper.warn(`Project "${projectName}" not found`);
      try {

        const migrate: boolean = await QuestionHelper.confirmMigration();
        if (migrate) {
          const fromDomainProject: string = await QuestionHelper.chooseProject(await this.fileHelper.findAllProjects());

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

    LogHelper.info(`Adding record (amount: ${record.amount}, type: ${record.type}) to ${foundProject.name}`);

    // Add unique identifier to each record
    if (!record.guid) {
      record.guid = uuid();
    }

    if (!record.created) {
      const now: number = Date.now();
      record.created = now;
      record.updated = now;
    }

    foundProject.records.push(record);
    await this.fileHelper.saveProjectObject(foundProject);

    // TODO differ between types
    const hourString: string = record.amount === 1 ? "hour" : "hours";
    if (record.message) {
      await this.gitHelper.commitChanges(`Added ${record.amount} ${hourString} to ${projectName}: "${record.message}"`);
    } else {
      await this.gitHelper.commitChanges(`Added ${record.amount} ${hourString} to ${projectName}`);
    }
  }

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

    const migratedProject: IProject = {
      meta: to.meta,
      name: to.name,
      records: populatedFrom.records,
    };

    await this.fileHelper.initProject(migratedProject);
    LogHelper.info(`✓ Migrated Project`);

    const fromDomainProjects: IProject[] = await this.fileHelper.findProjectsForDomain(from.meta);

    // TODO check if really the same project object?
    if (fromDomainProjects.length === 1) {
      // we know that it is not empty, force delete it
      await this.fileHelper.removeDomainDirectory(from.meta, true);
      LogHelper.info(`✓ Removed old domain directory`);
    } else {
      await this.fileHelper.removeProjectFile(from);
      LogHelper.info(`✓ Removed old project file`);
    }

    try {
      const link: IIntegrationLink = await this.fileHelper.findLinkByProject(from);

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
    } catch (err) {
      LogHelper.debug(`No link found for project "${from.name}"`);
    }

    return migratedProject;
  }
}
