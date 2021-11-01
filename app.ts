import axios, { AxiosResponse } from "axios";
import chalk from "chalk";
import commander, { CommanderStatic } from "commander";
import _, { isString } from "lodash";
import moment, { Moment } from "moment";
import path from "path";

import {
  AuthHelper,
  ChartHelper,
  FileHelper,
  ExportHelper,
  GitHelper,
  ImportHelper,
  LogHelper,
  ProjectHelper,
  QuestionHelper,
  TimerHelper,
  ValidationHelper,
  RecordHelper,
  ConfigHelper,
  MultipieHelper,
  appendTicketNumber,
  toFixedLength,
} from "./helper";
import {
  IIntegrationLink,
  IJiraLink,
  IJiraPublishResult,
  IProject,
  IRecord,
  IMultipieInputLink,
  IPublishSummaryItem,
  IMultipieStoreLink,
  ISelectChoice,
  IMultipiePublishResult,
} from "./interfaces";
import { ORDER_DIRECTION, ORDER_TYPE, RECORD_TYPES } from "./types";
import { DefaultLogFields } from "simple-git/src/lib/tasks/log";
import { Token } from "client-oauth2";

// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any
const packageJson: any = require("./package.json");
const APP_NAME: string = packageJson.name;
const APP_VERSION: string = packageJson.version;
const APP_CONFIG_DIR = ".gittt-cli";
const JIRA_ENDPOINT_VERSION = "v2";

export class App {
  private configDir: string;
  private configHelper: ConfigHelper;
  private fileHelper: FileHelper;
  private timerHelper: TimerHelper;
  private gitHelper: GitHelper;
  private projectHelper: ProjectHelper;
  private importHelper: ImportHelper;
  private authHelper: AuthHelper;

  public start(): void {
    if (process.argv.length === 2) {
      commander.help();
    } else {
      commander.parse(process.argv);
    }
  }

  public exit(msg: string, code: number): void {
    if (code === 0) {
      LogHelper.warn(msg);
    } else {
      LogHelper.error(msg);
    }
    process.exit(code);
  }

  public async setup(): Promise<void> {
    this.configDir = path.join(FileHelper.getHomeDir(), `${APP_CONFIG_DIR}`);
    this.fileHelper = new FileHelper(this.configDir, "config.json", "timer.json", "projects");
    this.configHelper = ConfigHelper.getInstance(this.fileHelper);

    if (!(await this.configHelper.isInitialized())) {
      if (await QuestionHelper.confirmSetup()) {
        await this.initConfigDir();
        LogHelper.info("Initialized git-time-tracker (GITTT) you are good to go now ;)\n\n");
      } else {
        this.exit(`${APP_NAME} does not work without setup, bye!`, 0);
      }
    }

    this.gitHelper = new GitHelper(this.configDir, this.fileHelper);
    this.projectHelper = new ProjectHelper(this.gitHelper, this.fileHelper);
    this.timerHelper = new TimerHelper(this.fileHelper, this.projectHelper);
    this.importHelper = new ImportHelper();
    this.authHelper = new AuthHelper();

    this.initCommander();
  }

  // TODO should be moved to config helper, but gitHelper needs a valid config dir
  public async initConfigDir(): Promise<void> {
    if (!(await this.fileHelper.configDirExists())) {
      await this.fileHelper.createConfigDir();
      this.gitHelper = new GitHelper(this.configDir, this.fileHelper);

      if (!(await this.fileHelper.isConfigFileValid())) {
        const gitUrl: string = await QuestionHelper.askGitUrl();
        LogHelper.info("Initializing local repo");
        await this.gitHelper.initRepo(gitUrl);
        // TODO remove reset=true?
        LogHelper.info("Pulling repo...");
        await this.gitHelper.pullRepo();

        // Check if a valid config file is already in the repo
        if (!(await this.fileHelper.isConfigFileValid())) {
          LogHelper.info("Initializing gittt config file");
          await this.fileHelper.initConfigFile(gitUrl);
          LogHelper.info("Committing created config file");
          await this.gitHelper.commitChanges("Initialized config file");
          LogHelper.info("Pushing changes to remote repo");
          await this.gitHelper.pushChanges();
        }
      } else {
        await this.gitHelper.pullRepo();
      }

    } else {
      if (await this.fileHelper.isConfigFileValid()) {
        this.gitHelper = new GitHelper(this.configDir, this.fileHelper);
        await this.gitHelper.pullRepo();
        LogHelper.info(`Config directory ${this.configDir} already initialized`);
      } else {
        LogHelper.warn(`Config file exists, but is invalid`);
        this.exit("Invalid config file", 1);
        // TODO reinitialize?
      }
    }
  }

  public async exportAction(cmd: commander.Command): Promise<void> {
    LogHelper.print(`Gathering projects...`)
    let projectsToExport: IProject[] = [];
    if (cmd.project) {
      const projectToExport: IProject | undefined = await this.fileHelper.findProjectByName(cmd.project);
      if (!projectToExport) {
        this.exit(`✗ Project "${cmd.project}" not found`, 1)
      } else {
        projectsToExport.push(projectToExport);
      }
    } else {
      projectsToExport = await this.fileHelper.findAllProjects();
    }
    LogHelper.info(`✓ Got all ${projectsToExport.length} projects`);

    ExportHelper.export(cmd.directory, cmd.filename, cmd.type, projectsToExport);
    LogHelper.info(`✓ Export done`)
  }

  public async linkAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;

    try {
      if (!interactiveMode) {
        project = await this.projectHelper.getProjectByName(cmd.project);
      } else {
        project = await this.projectHelper.getOrAskForProjectFromGit();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }
    const integration: string = await QuestionHelper.chooseIntegration();

    LogHelper.debug(`Trying to find links for "${project.name}"`)
    // Check for previous data
    const prevIntegrationLink: IIntegrationLink | undefined = (await this.configHelper
      .findLinksByProject(project, integration))[0];

    switch (integration) {
      case "Jira":
        let prevJiraLink: IJiraLink | undefined;
        if (prevIntegrationLink) {
          LogHelper.info(`Found link for "${project.name}", enriching dialog with previous data`)
          prevJiraLink = prevIntegrationLink as IJiraLink;
        }

        const jiraLink: IJiraLink = await QuestionHelper.askJiraLink(project, prevJiraLink, JIRA_ENDPOINT_VERSION);

        try {
          await this.configHelper.addOrUpdateLink(jiraLink);
        } catch (err: any) {
          LogHelper.debug(`Unable to add link to config file`, err);
          return this.exit(`Unable to add link to config file`, 1);
        }

        break;

      case "Multipie":
        let prevMultipieLink: IMultipieInputLink | undefined;
        if (prevIntegrationLink) {
          LogHelper.info(`Found link for "${project.name}", enriching dialog with previous data`)
          prevMultipieLink = prevIntegrationLink as IMultipieInputLink;
        }

        const multiPieInputLink: IMultipieInputLink = await QuestionHelper.askMultipieLink(project, prevMultipieLink);
        const multipieAuth = this.authHelper.getAuthClient(multiPieInputLink);
        try {
          const authResponse: Token = await multipieAuth.owner.getToken(multiPieInputLink.username, multiPieInputLink.password);
          LogHelper.debug(`Got offline access refresh token`);

          const offlineToken: IMultipieStoreLink = {
            projectName: multiPieInputLink.projectName,
            linkType: multiPieInputLink.linkType,
            host: multiPieInputLink.host,
            endpoint: multiPieInputLink.endpoint,
            clientSecret: multiPieInputLink.clientSecret,
            refreshToken: authResponse.refreshToken,
          }

          try {
            await this.configHelper.addOrUpdateLink(offlineToken);
          } catch (err: any) {
            LogHelper.debug(`Unable to add link to config file`, err);
            return this.exit(`Unable to add link to config file`, 1);
          }
        } catch (err: any) {
          LogHelper.debug(`Unable to authenticate user`, err);
          return this.exit(`Unable to authenticate user`, 1);
        }

        break;

      default:
        this.exit(`Integration "${integration}" not implemented`, 1);
        break;
    }
  }

  public async publishAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let projects: Array<IProject> = [];

    try {
      if (!interactiveMode) {
        if (cmd.all) {
          projects = await this.projectHelper.getAllProjects();
        } else {
          const project: IProject | undefined = await this.projectHelper.getProjectByName(cmd.project);
          if (project) {
            projects = [project];
          }
        }
      } else {
        const project: IProject | undefined = await this.projectHelper.getOrAskForProjectFromGit();
        if (project) {
          projects = [project];
        }
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    if (projects.length < 1 || !projects) {
      return this.exit("No valid git project", 1);
    }

    const projectIntegrationLinks = await Promise.all(
      projects.map(async (project) => {
        const links = await this.configHelper.findLinksByProject(project);
        return {
          name: project.name,
          meta: project.meta,
          records: project.records,
          integrationLinks: links
        };
      })
    );

    if (projectIntegrationLinks.length === 1 && projectIntegrationLinks[0].integrationLinks.length === 0) {
      LogHelper.warn(`Unable to find a link for "${projectIntegrationLinks[0].name}"`);
      if (await QuestionHelper.confirmLinkCreation()) {
        await this.linkAction(cmd);

        return await this.publishAction(cmd);
      } else {
        return this.exit(`Unable to publish without link`, 1);
      }
    } else {
      for (const project of projectIntegrationLinks) {
        if (project.integrationLinks.length === 0) {
          LogHelper.warn(`Unable to find a link for "${project.name}"`);
        }
      }
    }

    const logs: ReadonlyArray<DefaultLogFields> = await this.gitHelper.logChanges();
    if (logs.length > 0) {
      if (await QuestionHelper.confirmPushLocalChanges()) {
        await this.gitHelper.pushChanges();
      } else {
        return this.exit("Unable to publish with local changes", 1);
      }
    }

    const publishSummary: IPublishSummaryItem[] = [];

    for (const project of projectIntegrationLinks) {
      for (const link of project.integrationLinks) {
        switch (link.linkType) {
          case "Jira":
            const jiraLink: IJiraLink = link as IJiraLink;

            // Map local project to jira key
            if (jiraLink.issue) {
              LogHelper.info(`Mapping "${project.name}" to Jira issue "${jiraLink.issue}" within project "${jiraLink.key}"`);
            } else {
              LogHelper.info(`Mapping "${project.name}" to Jira project "${jiraLink.key}"`);
            }

            if (!jiraLink.host) {
              // Handle deprecated config
              return this.exit('The configuration of this jira link is deprecated, please consider updating the link with "gittt link"', 1)
            }

            const jiraUrl = `${jiraLink.host}${jiraLink.endpoint}`;

            LogHelper.debug(`Publishing to ${jiraUrl}`);

            try {
              const publishResult: AxiosResponse = await axios
                .post(jiraUrl,
                  {
                    projectKey: jiraLink.key,
                    issueKey: jiraLink.issue,
                    project,
                  },
                  {
                    headers: {
                      "Authorization": `Basic ${jiraLink.hash}`,
                      "Cache-Control": "no-cache",
                      "Content-Type": "application/json",
                    },
                  },
                );

              const data: IJiraPublishResult = publishResult.data;

              if (data.success) {
                publishSummary.push({
                  success: true,
                  type: link.linkType,
                })
              } else {
                publishSummary.push({
                  success: false,
                  type: link.linkType,
                  reason: `Publishing failed [${publishResult.status}]`
                })
              }
            } catch (err: any) {
              delete err.config;
              delete err.request;
              delete err.response;
              LogHelper.debug("Publish request failed", err);
              publishSummary.push({
                success: false,
                type: link.linkType,
                reason: `Publish request failed, please consider updating the link`
              })
            }

            break;

          case "Multipie":
            const multipieLink: IMultipieStoreLink = link as IMultipieStoreLink;

            try {
              let authorizationHeader = "";

              if (multipieLink.username) {
                // Legacy flow
                LogHelper.debug("Found username parameter in link configuration, using legacy auth method")
                authorizationHeader = this.authHelper.getLegacyAuth(multipieLink);
              } else {
                const multipieAuth = this.authHelper.getAuthClient(multipieLink);

                const { refreshToken } = multipieLink;
                if (!refreshToken) {
                  this.exit(`Unable to find refresh token for this project, please login via 'gittt link'`, 1);
                  return;
                }

                const offlineToken: Token = await multipieAuth.createToken("", refreshToken, {});

                LogHelper.debug(`Refreshing token to get access token`);

                const refreshedToken: Token = await offlineToken.refresh();
                LogHelper.debug(`Got access token`);

                authorizationHeader = `Bearer ${refreshedToken.accessToken}`
              }

              const multipieUrl = `${multipieLink.host}${multipieLink.endpoint}`;

              LogHelper.debug(`Publishing to ${multipieUrl}`);

              const publishResult: AxiosResponse<IMultipiePublishResult> = await axios
                .post(multipieUrl,
                  project,
                  {
                    headers: {
                      "Authorization": authorizationHeader,
                      "Cache-Control": "no-cache",
                      "Content-Type": "application/json",
                    },
                  },
                );

              const data: IMultipiePublishResult = publishResult.data;

              if (data && (publishResult.status === 200 || publishResult.status === 201)) {
                publishSummary.push({
                  success: true,
                  type: link.linkType,
                })
              } else {
                publishSummary.push({
                  success: false,
                  type: link.linkType,
                  reason: `Publishing failed [${publishResult.status}]`
                })
              }
            } catch (err: any) {
              delete err.config;
              delete err.request;
              delete err.response;
              LogHelper.debug("Publish request failed", err);
              publishSummary.push({
                success: false,
                type: link.linkType,
                reason: `Publish request failed, please consider updating the link`
              })
            }

            break;

          default:
            publishSummary.push({
              success: false,
              type: "unknown",
              reason: `Link type "${link.linkType}" not implemented`
            })
            break;
        }
      }
    }

    for (const item of publishSummary) {
      if (item.success) {
        LogHelper.info(`✓ Successfully published to ${item.type}`)
      } else {
        LogHelper.warn(`✗ Unable to publish to ${item.type}: ${item.reason}`)
      }
    }

    if (publishSummary.filter(item => item.success === false).length > 0) {
      this.exit(`One or more errors occurred while publishing data`, 1);
    }
  }

  public async editAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;


    let project: IProject | undefined;

    // TODO move to own function, is used multiple times
    try {
      if (!interactiveMode) {
        project = await this.projectHelper.getProjectByName(cmd.project);
      } else {
        project = await this.projectHelper.getOrAskForProjectFromGit();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    const projectWithRecords: IProject | undefined = await this.fileHelper.findProjectByName(project.name);
    if (!projectWithRecords) {
      return this.exit(`Unable to find project "${project.name}"`, 1);
    }

    if (projectWithRecords.records.length === 0) {
      return this.exit(`No records found for "${project.name}"`, 1);
    }

    const { records } = projectWithRecords;
    let recordsToEdit: IRecord[];
    let chosenRecord: IRecord;

    if (!interactiveMode) {
      if (!cmd.guid) {
        LogHelper.error("No guid option found");
        return cmd.help();
      }

      const recordGuid: string = cmd.guid;

      const chosenRecords: IRecord[] = records.filter((rc: IRecord) => {
        return rc.guid === recordGuid;
      });

      chosenRecord = chosenRecords[0];

      if (!chosenRecord) {
        return this.exit(`No records found for guid "${recordGuid}"`, 1);
      }
    } else {
      recordsToEdit = await RecordHelper.filterRecordsByYear(records);
      recordsToEdit = await RecordHelper.filterRecordsByMonth(recordsToEdit);
      recordsToEdit = await RecordHelper.filterRecordsByDay(recordsToEdit);

      chosenRecord = await QuestionHelper.chooseRecord(recordsToEdit);
    }

    const updatedRecord: IRecord = Object.assign({}, chosenRecord);
    const multipieHelper = new MultipieHelper();

    let year: number;
    let month: number;
    let day: number;
    let hour: number;
    let minute: number;
    let amount: number;
    let message: string | undefined;
    let role: string | undefined;

    if (!interactiveMode) {
      if (cmd.type) {
        updatedRecord.type = cmd.type;
      } else {
        LogHelper.error("No type option found");
        return cmd.help();
      }

      if (!ValidationHelper.validateNumber(cmd.amount)) {
        LogHelper.error("No amount option found");
        return cmd.help();
      }

      if (!cmd.role && project.requiresRoles) {
        LogHelper.error("No role option found");
        return cmd.help();
      }

      amount = parseFloat(cmd.amount);

      year = ValidationHelper.validateNumber(cmd.year)
        ? parseInt(cmd.year, 10) : moment().year();
      month = ValidationHelper.validateNumber(cmd.month, 1, 12)
        ? parseInt(cmd.month, 10) : moment().month() + 1;
      day = ValidationHelper.validateNumber(cmd.day, 1, 31)
        ? parseInt(cmd.day, 10) : moment().date();
      hour = ValidationHelper.validateNumber(cmd.hour, 0, 23)
        ? parseInt(cmd.hour, 10) : moment().hour();
      minute = ValidationHelper.validateNumber(cmd.minute, 0, 59)
        ? parseInt(cmd.minute, 10) : moment().minute();

      if (cmd.role) {
        const allowedRoles = await multipieHelper.getValidRoles(project);

        // check if role is allowed
        if (!allowedRoles.find(choice => choice.name == cmd.role)) {
          LogHelper.debug(`Role ${cmd.role} not allowed for project ${project.name}`);
          return this.exit(`Role ${cmd.role} not allowed for project ${project.name}`, 1);
        }
        role = cmd.role;
      }

      message = (cmd.message && cmd.message.length > 0) ? cmd.message : undefined;
    } else {
      updatedRecord.type = await QuestionHelper.chooseType(chosenRecord.type);

      year = await QuestionHelper.askYear(moment(chosenRecord.end).year());
      month = await QuestionHelper.askMonth(moment(chosenRecord.end).month() + 1);
      day = await QuestionHelper.askDay(moment(chosenRecord.end).date());
      hour = await QuestionHelper.askHour(moment(chosenRecord.end).hour());
      minute = await QuestionHelper.askMinute(moment(chosenRecord.end).minute());
      amount = await QuestionHelper.askAmount(chosenRecord.amount);
      message = await QuestionHelper.askMessage(chosenRecord.message);
      if (project.requiresRoles) {
        role = await QuestionHelper.chooseRole(project, chosenRecord.role);
      }
    }

    updatedRecord.updated = Date.now();
    updatedRecord.message = message;
    updatedRecord.amount = amount;
    updatedRecord.role = role;

    const modifiedMoment: Moment = moment().set({
      date: day,
      hour,
      millisecond: 0,
      minute,
      month: month - 1,
      second: 0,
      year,
    });

    updatedRecord.end = modifiedMoment.unix() * 1000;

    const updatedRecords: IRecord[] = records.map((rc: IRecord) => {
      return rc.guid === updatedRecord.guid ? updatedRecord : rc;
    });

    const updatedProject: IProject = projectWithRecords;
    updatedProject.records = updatedRecords;

    await this.fileHelper.saveProjectObject(updatedProject);

    let changes = "";

    if (updatedRecord.amount !== chosenRecord.amount) {
      changes += `amount: ${updatedRecord.amount}, `;
    }
    if (updatedRecord.end !== chosenRecord.end) {
      changes += `end: ${updatedRecord.end}, `;
    }
    if (updatedRecord.message !== chosenRecord.message) {
      changes += `message: ${updatedRecord.message}, `;
    }
    if (updatedRecord.type !== chosenRecord.type) {
      changes += `type: ${updatedRecord.type}, `;
    }
    if (updatedRecord.role !== chosenRecord.role) {
      changes += `role: ${updatedRecord.role}, `;
    }
    if (changes.length > 0) {
      changes = changes.slice(0, -2);
    }

    const commitMessage: string = changes.length > 0 ? `Updated record(${changes}) at ${updatedProject.name} ` : `Updated record at ${updatedProject.name} `;

    await this.gitHelper.commitChanges(commitMessage);

    LogHelper.info(commitMessage);
  }

  // TODO pretty much the same as editAction, refactor?
  public async removeAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;
    try {
      try {
        if (!interactiveMode) {
          project = await this.projectHelper.getProjectByName(cmd.project);
        } else {
          project = await this.projectHelper.getOrAskForProjectFromGit();
        }
      } catch (err: any) {
        return this.exit(err.message, 1);
      }
    } catch (err: any) {
      LogHelper.debug("Unable to get project name from git folder", err);
      return this.exit("Unable to get project name from git folder", 1);
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    const projectWithRecords: IProject | undefined = await this.fileHelper.findProjectByName(project.name);
    if (!projectWithRecords) {
      return this.exit(`Unable to find project "${project.name}"`, 1);
    }

    if (projectWithRecords.records.length === 0) {
      return this.exit(`No records found for "${project.name}"`, 1);
    }

    const { records } = projectWithRecords;
    let recordsToDelete: IRecord[];
    let chosenRecord: IRecord;

    if (!interactiveMode) {
      if (!cmd.guid) {
        LogHelper.error("No guid option found");
        return cmd.help();
      }

      const recordGuid: string = cmd.guid;

      const chosenRecords: IRecord[] = records.filter((rc: IRecord) => {
        return rc.guid === recordGuid;
      });

      chosenRecord = chosenRecords[0];

      if (!chosenRecord) {
        return this.exit(`No records found for guid "${recordGuid}"`, 1);
      }
    } else {
      recordsToDelete = await RecordHelper.filterRecordsByYear(records);
      recordsToDelete = await RecordHelper.filterRecordsByMonth(recordsToDelete);
      recordsToDelete = await RecordHelper.filterRecordsByDay(recordsToDelete);

      chosenRecord = await QuestionHelper.chooseRecord(recordsToDelete);
    }

    // TODO confirm deletion?
    const updatedRecords: IRecord[] = records.filter((rc: IRecord) => {
      return rc.guid !== chosenRecord.guid;
    });

    const updatedProject: IProject = projectWithRecords;
    updatedProject.records = updatedRecords;

    await this.fileHelper.saveProjectObject(updatedProject);

    const commitMessage = `Removed record ${chosenRecord.guid} from project ${updatedProject.name}`;

    await this.gitHelper.commitChanges(commitMessage);

    LogHelper.info(`Removed record (${moment(chosenRecord.end).format("DD.MM.YYYY, HH:mm:ss")
      }: ${chosenRecord.amount} ${chosenRecord.type} - "${_.truncate(chosenRecord.message)}") from project ${updatedProject.name}`);
  }

  public async commitAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let amount: number;
    let message: string | undefined;
    let commitMessage: string;
    let project: IProject | undefined;

    try {
      if (!interactiveMode) {
        amount = parseFloat(cmd.amount);
        message = cmd.message;
        project = await this.projectHelper.getProjectByName(cmd.project);
      } else {
        amount = await QuestionHelper.askAmount(1);
        project = await this.projectHelper.getOrAskForProjectFromGit();
        message = await QuestionHelper.askMessage();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    if (isNaN(amount)) {
      return this.exit("No valid amount", 1);
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    if (message && message.length > 0) {
      commitMessage = message;
    } else {
      commitMessage = `Committed ${amount} hour${amount > 1 ? "s" : ""} to ${project.name}`
    }

    commitMessage = await appendTicketNumber(commitMessage, await this.gitHelper.getCurrentBranch())

    try {
      await this.projectHelper.addRecordToProject({
        amount,
        end: Date.now(),
        message: commitMessage,
        type: RECORD_TYPES.Time,
      }, project);
    } catch (err: any) {
      LogHelper.debug("Unable to add record to project", err);
      this.exit("Unable to add record to project", 1);
    }
  }

  public async addAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;
    const multipieHelper = new MultipieHelper();

    let year: number;
    let month: number;
    let day: number;
    let hour: number;
    let minute: number;
    let amount: number;
    let message: string | undefined;
    let type: RECORD_TYPES;
    let project: IProject;
    let role: string | undefined;

    try {
      if (!interactiveMode) {
        if (!ValidationHelper.validateNumber(cmd.amount)) {
          LogHelper.error("No amount option found");
          return cmd.help();
        }
        if (!cmd.type) {
          LogHelper.error("No type option found");
          return cmd.help();
        }

        amount = parseFloat(cmd.amount);
        type = cmd.type;

        year = ValidationHelper.validateNumber(cmd.year)
          ? parseInt(cmd.year, 10) : moment().year();
        month = ValidationHelper.validateNumber(cmd.month, 1, 12)
          ? parseInt(cmd.month, 10) : moment().month() + 1;
        day = ValidationHelper.validateNumber(cmd.day, 1, 31)
          ? parseInt(cmd.day, 10) : moment().date();
        hour = ValidationHelper.validateNumber(cmd.hour, 0, 23)
          ? parseInt(cmd.hour, 10) : moment().hour();
        minute = ValidationHelper.validateNumber(cmd.minute, 0, 59)
          ? parseInt(cmd.minute, 10) : moment().minute();

        message = (cmd.message && cmd.message.length > 0) ? cmd.message : undefined;

        project = await this.projectHelper.getProjectByName(cmd.project);

        if (!cmd.role && project.requiresRoles) {
          LogHelper.error("No role option found");
          return cmd.help();
        }

        // get roles
        if (project.requiresRoles) {
          const availableRoles = await multipieHelper.getValidRoles(project, cmd.role);
          role = availableRoles.find((role_: ISelectChoice) => role_ == cmd.role)?.value;
        }

      } else {
        project = await this.projectHelper.getOrAskForProjectFromGit();
        year = await QuestionHelper.askYear();
        month = await QuestionHelper.askMonth();
        day = await QuestionHelper.askDay();
        hour = await QuestionHelper.askHour();
        minute = await QuestionHelper.askMinute();
        amount = await QuestionHelper.askAmount(1);
        message = await QuestionHelper.askMessage();
        if (project.requiresRoles) {
          role = await QuestionHelper.chooseRole(project);
        }
        type = await QuestionHelper.chooseType();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    const modifiedMoment: Moment = moment().set({
      date: day,
      hour,
      millisecond: 0,
      minute,
      month: month - 1,
      second: 0,
      year,
    });

    const end: number = modifiedMoment.unix() * 1000;

    const newRecord: IRecord = {
      amount,
      end,
      message: message ? message : undefined,
      type,
      role,
    };

    if (newRecord.message) {
      newRecord.message = await appendTicketNumber(newRecord.message, await this.gitHelper.getCurrentBranch());
    }

    try {
      await this.projectHelper.addRecordToProject(newRecord, project);
    } catch (err: any) {
      LogHelper.debug("Unable to add record to project", err);
      this.exit("Unable to add record to project", 1);
    }
  }

  public async importCsv(cmd: string, options: any): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 4;

    const filePath: string = cmd;
    if (!isString(filePath) || !ValidationHelper.validateFile(filePath)) {
      return this.exit("Unable to get csv file path", 1);
    }

    let project: IProject | undefined;

    try {
      if (!interactiveMode) {
        project = await this.projectHelper.getProjectByName(options.project);
      } else {
        project = await this.projectHelper.getOrAskForProjectFromGit();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    try {
      const records: IRecord[] = await this.importHelper.importCsv(filePath);
      LogHelper.debug(`Parsed ${records.length} records from ${filePath}`);
      const uniqueRecords = _.uniqWith(records, _.isEqual);
      LogHelper.debug(`Filtered out ${records.length - uniqueRecords.length} duplicates`);
      await this.projectHelper.addRecordsToProject(uniqueRecords, project, true, false);
    } catch (err: any) {
      LogHelper.debug("Error importing records from csv", err);
      this.exit(err.message, 1);
    }
  }

  public async infoAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    const order: string = ORDER_TYPE.indexOf(cmd.order) === -1 ? ORDER_TYPE[0] : cmd.order;
    const direction: string = ORDER_DIRECTION.indexOf(cmd.direction) === -1 ? ORDER_DIRECTION[0] : cmd.direction;
    let project: IProject | undefined;

    try {
      if (!interactiveMode) {
        project = await this.projectHelper.getProjectByName(cmd.project);
      } else {
        project = await this.projectHelper.getOrAskForProjectFromGit();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    const projects: IProject[] = await this.fileHelper.findAllProjects();

    // get current Gittt project
    if (!project) {
      return this.exit("No valid git project", 1);
    } else {
      // check if the project is a gittt project
      const foundProject: IProject = projects.filter((p: IProject) => project && p.name === project.name)[0];
      if (foundProject) {
        LogHelper.info("");
        LogHelper.info(`Current project:`);

        const hours: number = await this.projectHelper.getTotalHours(foundProject.name);
        LogHelper.log(`Name:\t${foundProject.name}`);
        LogHelper.log(`Hours:\t${hours}h`);

        const links: IIntegrationLink[] = await this.configHelper.findLinksByProject(project);
        for (const link of links) {
          switch (link.linkType) {
            case "Jira":
              const jiraLink: IJiraLink = link as IJiraLink;
              LogHelper.log("");
              LogHelper.log("Jira link:");
              LogHelper.log(`> Host:\t\t${jiraLink.host}`);
              LogHelper.log(`> Project:\t${jiraLink.key}`);
              if (jiraLink.issue) {
                LogHelper.log(`> Issue:\t${jiraLink.issue}`);
              }
              break;
            case "Multipie":
              const multipieLink: IMultipieInputLink = link as IMultipieInputLink;
              LogHelper.log("");
              LogHelper.log("Multipie link:");
              LogHelper.log(`> Host:\t\t${multipieLink.host}`);
              LogHelper.log(`> Project:\t${multipieLink.projectName}`);
              break;
          }
        }
      } else {
        LogHelper.error("No gittt project in current git project.");
      }
    }

    LogHelper.info("");
    LogHelper.info(`Projects:`);
    // add hours to projects
    const projectsWithHours: { hours: number; project: IProject }[] = await Promise.all(projects.map(async prj => {
      return {
        hours: await this.projectHelper.getTotalHours(prj.name),
        project: prj,
      }
    }))

    // order projects
    // sort mutates the array so we cannot save it to orderedProjects directly
    projectsWithHours.sort((a: { hours: number; project: IProject }, b: { hours: number; project: IProject }) => {
      if (order === "hours") {
        if (direction === "desc") {
          return (a.hours - b.hours) * -1;
        }
        return (a.hours - b.hours);
      }

      if (a.project.name < b.project.name) {
        return (direction === "desc") ? 1 : -1;
      }
      if (a.project.name > b.project.name) {
        return (direction === "desc") ? -1 : 1;
      }

      return 0;
    });
    const orderedProjects = projectsWithHours;

    // print projects
    for (const prj of orderedProjects) {
      LogHelper.log(`- ${prj.project.name}: ${prj.hours}h`);
    }
  }

  public async listAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;

    try {
      if (!interactiveMode) {
        project = await this.projectHelper.getProjectByName(cmd.project);
      } else {
        project = await this.projectHelper.getOrAskForProjectFromGit();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    if (project.records.length === 0) {
      return this.exit(`No records found for "${project.name}"`, 1);
    }

    // sorting newest to latest
    // because sort mutates the array we cannot assign it to records directly
    project.records.sort((a: IRecord, b: IRecord) => {
      const aStartTime: moment.Moment = moment(a.end).subtract(a.amount, "hours");
      const bStartTime: moment.Moment = moment(b.end).subtract(b.amount, "hours");

      return aStartTime.diff(bStartTime);
    });
    const records: IRecord[] = project.records;

    LogHelper.info(`${project.name}`);
    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`TYPE\tAMOUNT\tTIME\t\t\tCOMMENT\t\t\t\tROLE`);
    LogHelper.print(`--------------------------------------------------------------------------------`);

    let sumOfTime = 0;
    for (const record of records) {
      let line = "";
      line += `${record.type}\t`;
      line += chalk.yellow.bold(`${record.amount.toFixed(2)}h\t`);
      line += `${moment(record.end).format("DD.MM.YYYY HH:mm:ss")}\t`;
      line += chalk.yellow.bold(`${toFixedLength(record.message, 24)}\t`);
      line += chalk.yellow.bold(`${record.role}`);
      sumOfTime += record.amount;
      LogHelper.print(line);
    }

    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`SUM:\t${sumOfTime}h`);
  }

  public async todayAction(): Promise<void> {
    const projects: IProject[] = await this.fileHelper.findAllProjects();

    const todaysRecords: {
      project: IProject;
      record: IRecord;
    }[] = projects.flatMap(project => {
      return project.records.filter(record => {
        const momentEnd = moment(record.end);
        const momentDayStart = moment().startOf('day');
        const momentDayEnd = moment().endOf('day');
        return momentEnd.isBetween(momentDayStart, momentDayEnd);
      }).map(record => {
        return {
          record,
          project
        }
      });
    });

    // because sort mutates the array we cannot assign it to sortedTodaysRecords directly
    todaysRecords.sort((a: {
      project: IProject;
      record: IRecord;
    }, b: {
      project: IProject;
      record: IRecord;
    }) => {
      return moment(a.record.end).diff(moment(b.record.end));
    });
    const sortedTodaysRecords = todaysRecords;

    LogHelper.info(`${moment().format("dddd, MMMM D, YYYY")}`);
    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`TYPE\tAMOUNT\tTIME\t\tPROJECT\t\t\t\tCOMMENT`);
    LogHelper.print(`--------------------------------------------------------------------------------`);

    let sumOfTime = 0;
    for (const todayRecord of sortedTodaysRecords) {
      const { record, project } = todayRecord;
      let line = "";
      // Type
      line += `${record.type}\t`;
      // Amount
      line += chalk.yellow.bold(`${record.amount.toFixed(2)}h\t`);
      // Time
      line += `${moment(record.end).format("HH:mm:ss")}\t`;
      // Project
      if (project.name.length > 24) {
        line += `${project.name.slice(0, 24)}\t`
      } else {
        line += `${project.name}\t`;
      }
      for (let i = 0; i < Math.ceil(3 - project.name.length / 8); i++) {
        line += "\t"
      }
      // Message
      line += chalk.yellow.bold(`${record.message}`);
      sumOfTime += record.amount;
      LogHelper.print(line);
    }

    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`SUM:\t${sumOfTime}h`);
  }

  public async reportAction(cmd: commander.Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let project: IProject | undefined;

    try {
      if (!interactiveMode) {
        project = await this.projectHelper.getProjectByName(cmd.project);
      } else {
        project = await this.projectHelper.getOrAskForProjectFromGit();
      }
    } catch (err: any) {
      return this.exit(err.message, 1);
    }

    if (!project) {
      return this.exit("No valid git project", 1);
    }

    const days: number = parseInt(cmd.days, 10) || 14; // default is 14 days (2 weeks sprint)
    const daysData: any = {};
    const weekdayData: any = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };

    // get tomorrow 00:00
    const now: moment.Moment = moment();
    now.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    now.add(1, "days");

    // get all records in timeframe
    for (const record of project.records) {
      const startTime: moment.Moment = moment(record.end).subtract(record.amount, "hours");

      // the difference will be positive for every day into the past
      const difference: moment.Duration = moment.duration(now.diff(startTime));

      // if difference is to great we skip the record
      if (difference.asDays() > days && days !== -1) {
        continue;
      }

      // add to daysData
      const dayString: string = startTime.format("MMM DD, YYYY (ddd)");
      daysData[dayString] = daysData[dayString] ? daysData[dayString] + record.amount : record.amount;

      // add to weeklyData
      const weekdayString: string = startTime.format("dddd");
      weekdayData[weekdayString] += record.amount;
    }

    LogHelper.info("----------------------------------------------------------------------");
    LogHelper.info(`Project: ${project.name}`);
    LogHelper.info(`for the last ${days} days`);
    LogHelper.info("----------------------------------------------------------------------");

    // separator
    LogHelper.log("");

    // print daysData
    if (Object.keys(daysData).length > 0) {
      LogHelper.info("Days report");
      LogHelper.log("----------------------------------------------------------------------");
      LogHelper.log(ChartHelper.chart(daysData, true, 50, false, "h"));
    }

    // separator
    LogHelper.log("");

    // print weeklyData
    LogHelper.info("Weekday report");
    LogHelper.log("---------------------------------------------------------------------");
    LogHelper.log(ChartHelper.chart(weekdayData, true, 50, false, "h"));
  }

  public async stopAction(cmd: commander.Command): Promise<void> {
    let project: IProject | undefined;

    if (cmd.kill) {
      await this.timerHelper.killTimer();
    } else {
      try {
        if (cmd.project) {
          project = await this.projectHelper.getProjectByName(cmd.project);
        } else {
          project = await this.projectHelper.getOrAskForProjectFromGit();
        }
      } catch (err: any) {
        return this.exit(err.message, 1);
      }

      if (!project) {
        return this.exit("No valid git project", 1);
      }

      await this.timerHelper.stopTimer(cmd.message, project);
    }
  }

  public async initAction(): Promise<void> {
    if (await QuestionHelper.confirmInit()) {
      try {
        await this.projectHelper.initProject();
      } catch (err: any) {
        LogHelper.debug("Error initializing project", err);
        this.exit("Error initializing project", 1);
      }
    } else {
      this.exit("Initialization canceled", 0)
    }
  }

  public initCommander(): CommanderStatic {
    // Only matters for tests to omit 'MaxListenersExceededWarning'
    commander.removeAllListeners();
    commander.on("command:*", () => {
      commander.help();
    });

    // add version command
    commander
      .version(APP_VERSION);

    // Commit action
    commander
      .command("commit")
      .description("Committing certain hours to a project")
      .option("-a, --amount <amount>", "Amount of hours spent")
      .option("-m, --message [message]", "Description of the spent hours")
      .option("-p, --project [project]", "Specify a project to commit to")
      .action(async (cmd: commander.Command): Promise<void> => this.commitAction(cmd));

    // add command
    commander
      .command("add")
      .description("Adding hours to the project in the past")
      .option("-a, --amount <amount>", "Specify the amount")
      .option("-y, --year [year]", "Specify the year, defaults to current year")
      .option("-m, --month [month]", "Specify the month, defaults to current month")
      .option("-d, --day [day]", "Specify the day, defaults to current day")
      .option("-h, --hour [hour]", "Specify the hour, defaults to current hour")
      .option("-M, --minute [minute]", "Specify the minute, defaults to current minute")
      .option("-w, --message [message]", "Specify the message of the record")
      .option("-t, --type [type]", "Specify the type of the record")
      .option("-r, --role [role]", "Specify the role of the record")
      .option("-p, --project [project]", "Specify the project to add the record")
      .action(async (cmd: commander.Command): Promise<void> => this.addAction(cmd));

    // push command
    commander
      .command("push")
      .description("Pushing changes to repository")
      .action(async (): Promise<void> => {
        LogHelper.info("Pushing changes...");
        await this.gitHelper.pushChanges();
        LogHelper.info("Done");
      });

    // info command
    commander
      .command("info")
      .description("Lists info about gittt for this users (projects and hours)")
      .option("-o, --order <type>", "Specify the ordering (hours or name) default is " + ORDER_TYPE[0])
      .option("-d, --direction <direction>", "Specify the ordering direction (asc, desc)" + ORDER_DIRECTION[0])
      .option("-p, --project [project]", "Specify the project to get the information")
      .action((cmd: commander.Command): Promise<void> => this.infoAction(cmd));

    // list command
    // will be changed in GITTT-85
    commander
      .command("list")
      .description("List of time tracks in project")
      .option("-p, --project [project]", "Specify the project to get the time tracks")
      .action((cmd: commander.Command): Promise<void> => this.listAction(cmd));

    commander
      .command("today")
      .description("List of time tracks of current day")
      .action((): Promise<void> => this.todayAction());

    // report command
    // will be changed in GITTT-85
    commander
      .command("report")
      .description("Prints a small report")
      .option("-d, --days [number]", "Specify for how many days the report should be printed.")
      .option("-p, --project [project]", "Specify the project the report should be printed for")
      .action((cmd: commander.Command): Promise<void> => this.reportAction(cmd));

    commander
      .command("setup")
      .description("Initializes config directory and setup of gittt git project")
      .action(async (): Promise<void> => this.initConfigDir());

    // start command
    commander
      .command("start")
      .description("Start the timer")
      .action(async (): Promise<void> => this.timerHelper.startTimer());

    // stop command
    commander
      .command("stop")
      .description("Stop the timer and commit to a project")
      .option("-k, --kill", "Kill the timer for a project")
      .option("-m, --message <message>", "Commit message for the project")
      .option("-p, --project [project]", "Specify the project to add your time to")
      .action(async (cmd: commander.Command): Promise<void> => this.stopAction(cmd));

    // init command
    commander
      .command("init")
      .description("Initializes the project in current git directory")
      .action(async (): Promise<void> => this.initAction());

    // link command
    commander
      .command("link")
      .description("Initialize or edit link to third party applications")
      .option("-p, --project [project]", "Specify the project to link")
      .action(async (cmd: commander.Command): Promise<void> => this.linkAction(cmd));

    // publish command
    commander
      .command("publish")
      .description("Publishes stored records to external endpoint")
      .option("-p, --project [project]", "Specify the project to publish")
      .option("-a, --all", "Publish all projects")
      .action(async (cmd: commander.Command): Promise<void> => this.publishAction(cmd));

    // edit command
    commander
      .command("edit")
      .description("Edit record of current project")
      .option("-g, --guid [guid]", "GUID of the record to edit")
      .option("-a, --amount <amount>", "Specify the amount")
      .option("-y, --year [year]", "Specify the year, defaults to current year")
      .option("-m, --month [month]", "Specify the month, defaults to current month")
      .option("-d, --day [day]", "Specify the day, defaults to current day")
      .option("-h, --hour [hour]", "Specify the hour, defaults to current hour")
      .option("-M, --minute [minute]", "Specify the minute, defaults to current minute")
      .option("-w, --message [message]", "Specify the message of the record")
      .option("-t, --type [type]", "Specify the type of the record")
      .option("-r, --role [role]", "Specify the role of the record")
      .option("-p, --project [project]", "Specify the project to edit")
      .action(async (cmd: commander.Command): Promise<void> => this.editAction(cmd));

    // remove command
    commander
      .command("remove")
      .description("Remove record from a project")
      .option("-g, --guid [guid]", "GUID of the record to remove")
      .option("-p, --project [project]", "Specify the project to remove a record")
      .action(async (cmd: commander.Command): Promise<void> => this.removeAction(cmd));

    // import command
    commander
      .command("import <file>")
      .description("Import records from csv file to current project")
      .option("-p, --project [project]", "Specify the project to import records to")
      .action(async (cmd: string, options: any): Promise<void> => this.importCsv(cmd, options));

    // export command
    commander
      .command("export")
      .description("Exports projects to ods file")
      .option("-f, --filename [filename]", "Filename of the output file (default: gittt-report)")
      .option("-d, --directory [directory]", "Directory where to store the export (default: current working dir)")
      .option("-t, --type [file type]", "File type of the export (default: ods) - supported types: https://github.com/SheetJS/sheetjs#supported-output-formats")
      .option("-p, --project [project to export]", "Name of the project")
      .action(async (cmd: commander.Command): Promise<void> => this.exportAction(cmd));

    return commander;
  }
}
