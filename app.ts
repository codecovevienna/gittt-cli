import axios, { AxiosResponse } from "axios";
import chalk from "chalk";
import commander, { Command, CommanderStatic } from "commander";
import inquirer from "inquirer";
import _ from "lodash";
import moment, { Moment } from "moment";
import path from "path";
import { DefaultLogFields } from "simple-git/typings/response";
import {
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
} from "./helper";
import {
  IConfigFile,
  IInitAnswers,
  IInitProjectAnswers,
  IIntegrationLink,
  IJiraLink,
  IJiraPublishResult,
  IProject,
  IRecord,
} from "./interfaces";
import { RECORD_TYPES } from "./types";

// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any
const packageJson: any = require("./package.json");
const APP_NAME: string = packageJson.name;
const APP_VERSION: string = packageJson.version;
const APP_CONFIG_DIR = ".gittt-cli";
const ORDER_TYPE: string[] = ["name", "hours"];
const ORDER_DIRECTION: string[] = ["asc", "desc"];

export class App {
  private homeDir: string;
  private configDir: string;
  private fileHelper: FileHelper;
  private timerHelper: TimerHelper;
  private gitHelper: GitHelper;
  private projectHelper: ProjectHelper;
  private importHelper: ImportHelper;

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

    // TODO correct place to ask this?
    if (!(await this.fileHelper.configDirExists()) || !(await this.fileHelper.isConfigFileValid())) {
      const initAnswers: IInitAnswers = await inquirer.prompt([
        {
          message: `Looks like you never used ${APP_NAME}, should it be set up?`,
          name: "setup",
          type: "confirm",
        },
      ]) as IInitAnswers;

      if (initAnswers.setup) {
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

    this.initCommander();
  }

  public async initConfigDir(): Promise<void> {
    if (!(await this.fileHelper.configDirExists())) {
      this.fileHelper.createConfigDir();
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

  public async exportAction(cmd: Command): Promise<void> {
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

  public async linkAction(): Promise<void> {
    const integration: string = await QuestionHelper.chooseIntegration();

    switch (integration) {
      case "Jira":
        const project: IProject = this.projectHelper.getProjectFromGit();

        if (!project) {
          return this.exit("Seems like you are not in a valid git directory", 1);
        }
        // TODO validate if record exists in projects dir(?)

        LogHelper.debug(`Trying to find links for "${project.name}"`)
        // Check for previous data
        const prevIntegrationLink: IIntegrationLink | undefined = await this.fileHelper.findLinkByProject(project);
        let prevJiraLink: IJiraLink | undefined;
        if (prevIntegrationLink) {
          LogHelper.info(`Found link for "${project.name}", enriching dialog with previous data`)
          prevJiraLink = prevIntegrationLink as IJiraLink;
        }

        const jiraLink: IJiraLink = await QuestionHelper.askJiraLink(project, prevJiraLink);

        try {
          await this.fileHelper.addOrUpdateLink(jiraLink);
        } catch (err) {
          LogHelper.debug(`Unable to add link to config file`, err);
          return this.exit(`Unable to add link to config file`, 1);
        }

        break;

      default:
        break;
    }
  }

  public async publishAction(cmd: Command): Promise<void> {
    const project: IProject = this.projectHelper.getProjectFromGit();

    if (!project) {
      return this.exit("Seems like you are not in a valid git directory", 1);
    }

    const configObject: IConfigFile = await this.fileHelper.getConfigObject();

    const link: any | undefined = configObject.links.find((li: IIntegrationLink) => {
      return li.projectName === project.name;
    });

    if (!link) {
      LogHelper.warn(`Unable to find a link for "${project.name}"`);
      const linkSetupAnswer: any = await inquirer.prompt([
        {
          message: `Do you want to setup a new link for this project?`,
          name: "confirm",
          type: "confirm",
        },
      ]);

      if (linkSetupAnswer.confirm) {
        await this.linkAction();

        return await this.publishAction(cmd);
      } else {
        return this.exit(`Unable to publish without link`, 1);
      }
    }

    const populatedProject: IProject | undefined = await this.fileHelper.findProjectByName(project.name);

    if (!populatedProject) {
      return this.exit("Unable to find project", 1);
    }

    const logs: ReadonlyArray<DefaultLogFields> = await this.gitHelper.logChanges();
    if (logs.length > 0) {
      const pushConfirm: any = await inquirer.prompt([
        {
          default: true,
          message: "Found local changes, they have to be pushed before publishing",
          name: "push",
          type: "confirm",
        },
      ]);

      if (pushConfirm.push) {
        await this.gitHelper.pushChanges();
      } else {
        return this.exit("Unable to publish with local changes", 1);
      }
    }

    switch (link.linkType) {
      case "Jira":
        // cast generic link to jira link
        const jiraLink: IJiraLink = link;

        // Map local project to jira key
        if (jiraLink.issue) {
          LogHelper.info(`Mapping "${populatedProject.name}" to Jira issue "${jiraLink.issue}" within project "${jiraLink.key}"`);
        } else {
          LogHelper.info(`Mapping "${populatedProject.name}" to Jira project "${jiraLink.key}"`);
        }
        populatedProject.name = jiraLink.key;

        let url: string;
        if (jiraLink.host) {
          url = `${jiraLink.host}${jiraLink.endpoint}`;
        } else {
          url = `${jiraLink.endpoint}`;
        }

        LogHelper.debug(`Publishing to ${url}`);

        try {
          const publishResult: AxiosResponse = await axios
            .post(url,
              // TODO send issue key to endpoint
              populatedProject,
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
            LogHelper.info("Successfully published data to Jira");
          } else {
            this.exit(`Unable to publish to Jira: ${data.message}`, 1);
          }
        } catch (err) {
          delete err.config;
          delete err.request;
          delete err.response;
          LogHelper.debug("Publish request failed", err);
          this.exit(`Publish request failed, please consider updating the link`, 1);
        }

        break;

      default:
        this.exit(`Link type "${link.linkType}" not implemented`, 1);
        break;
    }
  }

  public async filterRecordsByYear(records: IRecord[]): Promise<IRecord[]> {
    const allYears: string[] = [];

    for (const rc of records) {
      const currentYear: string = moment(rc.end).format("YYYY");
      if (allYears.indexOf(currentYear) === -1) {
        allYears.push(currentYear);
      }
    }

    // Check if records spanning over more than one year
    if (allYears.length > 1) {
      const choiceYear: any = await inquirer.prompt([
        {
          choices: allYears,
          message: "List of years",
          name: "year",
          type: "list",
        },
      ]) as {
        year: string;
      };

      return records.filter((rc: IRecord) => {
        const currentYear: string = moment(rc.end).format("YYYY");
        return currentYear === choiceYear.year;
      });

    } else {
      return records;
    }
  }

  public async filterRecordsByMonth(records: IRecord[]): Promise<IRecord[]> {
    // Check for month
    const allMonths: string[] = [];

    for (const rc of records) {
      const currentMonth: string = moment(rc.end).format("MMMM");
      if (allMonths.indexOf(currentMonth) === -1) {
        allMonths.push(currentMonth);
      }
    }

    // Check if records spanning over more than one month
    if (allMonths.length > 1) {
      const choiceMonth: any = await inquirer.prompt([
        {
          choices: allMonths,
          message: "List of Month",
          name: "month",
          type: "list",
        },
      ]) as {
        month: string;
      };

      return records.filter((rc: IRecord) => {
        const currentMonth: string = moment(rc.end).format("MMMM");
        return currentMonth === choiceMonth.month;
      });

    } else {
      return records;
    }
  }

  public async filterRecordsByDay(records: IRecord[]): Promise<IRecord[]> {
    // Check for days
    const allDays: string[] = [];

    for (const rc of records) {
      const currentDay: string = moment(rc.end).format("DD");
      if (allDays.indexOf(currentDay) === -1) {
        allDays.push(currentDay);
      }
    }

    // Check if records spanning over more than one day
    if (allDays.length > 1) {
      const choiceDay: any = await inquirer.prompt([
        {
          choices: allDays,
          message: "List of Days",
          name: "day",
          type: "list",
        },
      ]) as {
        day: string;
      };

      return records.filter((rc: IRecord) => {
        const currentDay: string = moment(rc.end).format("DD");
        return currentDay === choiceDay.day;
      });

    } else {
      return records;
    }
  }

  public async editAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    // TODO move to own function, is used multiple times
    let projectFromGit: IProject;
    try {
      projectFromGit = this.projectHelper.getProjectFromGit();
    } catch (err) {
      LogHelper.debug("Unable to get project name from git folder", err);
      return this.exit("Unable to get project name from git folder", 1);
    }

    const projectWithRecords: IProject | undefined = await this.fileHelper.findProjectByName(projectFromGit.name);
    if (!projectWithRecords) {
      return this.exit(`Unable to find project "${projectFromGit.name}"`, 1);
    }

    if (projectWithRecords.records.length === 0) {
      return this.exit(`No records found for "${projectFromGit.name}"`, 1);
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
      recordsToEdit = await this.filterRecordsByYear(records);
      recordsToEdit = await this.filterRecordsByMonth(recordsToEdit);
      recordsToEdit = await this.filterRecordsByDay(recordsToEdit);

      chosenRecord = await QuestionHelper.chooseRecord(recordsToEdit);
    }

    const updatedRecord: IRecord = Object.assign({}, chosenRecord);

    let year: number;
    let month: number;
    let day: number;
    let hour: number;
    let minute: number;
    let amount: number;
    let message: string | undefined;

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
    }

    updatedRecord.updated = Date.now();
    updatedRecord.message = message;
    updatedRecord.amount = amount;

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
    if (changes.length > 0) {
      changes = changes.slice(0, -2);
    }

    const commitMessage: string = changes.length > 0 ? `Updated record (${changes}) at ${updatedProject.name}` : `Updated record at ${updatedProject.name}`;

    await this.gitHelper.commitChanges(commitMessage);

    LogHelper.info(commitMessage);
  }

  // TODO pretty much the same as editAction, refactor?
  public async removeAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let projectFromGit: IProject;
    try {
      projectFromGit = this.projectHelper.getProjectFromGit();
    } catch (err) {
      LogHelper.debug("Unable to get project name from git folder", err);
      return this.exit("Unable to get project name from git folder", 1);
    }

    const projectWithRecords: IProject | undefined = await this.fileHelper.findProjectByName(projectFromGit.name);
    if (!projectWithRecords) {
      return this.exit(`Unable to find project "${projectFromGit.name}"`, 1);
    }

    if (projectWithRecords.records.length === 0) {
      return this.exit(`No records found for "${projectFromGit.name}"`, 1);
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
      recordsToDelete = await this.filterRecordsByYear(records);
      recordsToDelete = await this.filterRecordsByMonth(recordsToDelete);
      recordsToDelete = await this.filterRecordsByDay(recordsToDelete);

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

  public async addAction(cmd: Command): Promise<void> {
    const interactiveMode: boolean = process.argv.length === 3;

    let year: number;
    let month: number;
    let day: number;
    let hour: number;
    let minute: number;
    let amount: number;
    let message: string | undefined;
    let type: RECORD_TYPES;

    if (!interactiveMode) {
      if (!ValidationHelper.validateNumber(cmd.amount)) {
        LogHelper.error("No amount option found");
        return cmd.help();
      }
      if (!cmd.type) {
        LogHelper.error("No type option found");
        return cmd.help();
      }

      amount = parseInt(cmd.amount, 10);
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
    } else {
      year = await QuestionHelper.askYear();
      month = await QuestionHelper.askMonth();
      day = await QuestionHelper.askDay();
      hour = await QuestionHelper.askHour();
      minute = await QuestionHelper.askMinute();
      amount = await QuestionHelper.askAmount(1);
      message = await QuestionHelper.askMessage();
      type = await QuestionHelper.chooseType();
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
    };

    await this.projectHelper.addRecordToProject(newRecord);
  }

  public async importCsv(cmd: Command): Promise<void> {

    let filePath: string;

    if (cmd.file !== null) {
      filePath = (cmd.file && FileHelper.isFile(cmd.file)) ? cmd.file : null;
      if (filePath !== null) {
        const records: IRecord[] = await this.importHelper.importCsv(filePath);
        await this.projectHelper.addRecordsToProject(records, true, false);
      }
    }
  }

  public async infoAction(cmd: Command): Promise<void> {
    const project: IProject = this.projectHelper.getProjectFromGit();
    const projects: IProject[] = await this.fileHelper.findAllProjects();

    const order: string = ORDER_TYPE.indexOf(cmd.order) === -1 ? ORDER_TYPE[0] : cmd.order;
    const direction: string = ORDER_DIRECTION.indexOf(cmd.direction) === -1 ? ORDER_DIRECTION[0] : cmd.direction;

    // get current Gittt project
    LogHelper.info("Project in current folder:");
    if (!project) {
      LogHelper.error("No project in current folder.");
    } else {
      // check if the project is a gittt project
      const foundProject: IProject = projects.filter((p: IProject) => p.name === project.name)[0];
      if (foundProject) {
        const hours: number = await this.projectHelper.getTotalHours(foundProject.name);
        LogHelper.log(`Name:\t${foundProject.name}`);
        LogHelper.log(`Hours:\t${hours}h`);

        const link: IIntegrationLink | undefined = await this.fileHelper.findLinkByProject(project);
        if (link) {
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
          }
        }
      } else {
        LogHelper.error("No gittt project in current git project.");
      }
    }

    LogHelper.info("");
    LogHelper.info(`Projects:`);
    // add hours to projects
    const projectsWithHours: { hours: number; project: IProject }[] = [];
    for (const prj of projects) {
      const hours: number = await this.projectHelper.getTotalHours(prj.name);
      projectsWithHours.push({
        hours,
        project: prj,
      });
    }

    // order projects
    const orderedProjects: { hours: number; project: IProject }[] = projectsWithHours
      .sort((a: { hours: number; project: IProject }, b: { hours: number; project: IProject }) => {
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

    // print projects
    for (const prj of orderedProjects) {
      LogHelper.log(`- ${prj.project.name}: ${prj.hours || "-1"}h`);
    }
  }

  public async listAction(): Promise<void> {
    let projectFromGit: IProject;
    try {
      projectFromGit = this.projectHelper.getProjectFromGit();
    } catch (err) {
      LogHelper.debug("Unable to get project name from git folder", err);
      return this.exit("Unable to get project name from git folder", 1);
    }

    const projectWithRecords: IProject | undefined = await this.fileHelper.findProjectByName(projectFromGit.name);
    if (!projectWithRecords) {
      return this.exit(`Unable to find project "${projectFromGit.name}"`, 1);
    }

    if (projectWithRecords.records.length === 0) {
      return this.exit(`No records found for "${projectFromGit.name}"`, 1);
    }

    // sorting newest to latest
    const records: IRecord[] = projectWithRecords.records.sort((a: IRecord, b: IRecord) => {
      const aStartTime: moment.Moment = moment(a.end).subtract(a.amount, "hours");
      const bStartTime: moment.Moment = moment(b.end).subtract(b.amount, "hours");

      return bStartTime.diff(aStartTime);
    });

    LogHelper.info(`${projectWithRecords.name}`);
    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`TYPE\tAMOUNT\tTIME\t\t\tCOMMENT`);
    LogHelper.print(`--------------------------------------------------------------------------------`);

    let sumOfTime = 0;
    for (const record of records) {
      let line = "";
      line += `${record.type}\t`;
      line += chalk.yellow.bold(`${record.amount}h\t`);
      line += `${moment(record.end).subtract(record.amount, "hours").format("DD.MM.YYYY HH:mm:ss")}\t`;
      line += chalk.yellow.bold(`${record.message}`);
      sumOfTime += record.amount;
      LogHelper.print(line);
    }

    LogHelper.print(`--------------------------------------------------------------------------------`);
    LogHelper.info(`SUM:\t${sumOfTime}h`);
  }

  public async reportAction(cmd: Command): Promise<void> {
    const project: IProject = this.projectHelper.getProjectFromGit();
    const projectName: string = cmd.project ? cmd.project : (project ? project.name : "");

    const projects: IProject[] = await this.fileHelper.findAllProjects();

    const selectedProject: IProject | null = projects.find((p: IProject) => p.name === projectName) || null;

    if (!selectedProject) {
      LogHelper.error(`Project ${projectName} not found`);
      return;
    }

    const days: number = parseInt(cmd.days, 10) || 14; // default is 14 days (2 weeks sprint)
    const daysData: any = {};
    const weekdayData: any = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };

    // get tomorrow 00:00
    const now: moment.Moment = moment();
    now.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    now.add(1, "days");

    // get all records in time frame
    for (const record of selectedProject.records) {
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
    LogHelper.info(`Project: ${projectName}`);
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
    LogHelper.log("----------------------------------------------------------------------");
    LogHelper.log(ChartHelper.chart(weekdayData, true, 50, false, "h"));
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
      .command("commit <hours>")
      .description("Committing current hours to the project")
      .option("-m, --message <message>", "Description of the spent hours")
      .action(async (cmd: string, options: any): Promise<void> => {
        const hours: number = parseFloat(cmd);
        if (isNaN(hours)) {
          return this.exit("Unable to parse hours", 1);
        }

        await this.projectHelper.addRecordToProject({
          amount: hours,
          end: Date.now(),
          message: options.message,
          type: RECORD_TYPES.Time,
        });
      });

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
      .action(async (cmd: Command): Promise<void> => {
        await this.addAction(cmd);
      });

    // push command
    commander
      .command("push")
      .description("Pushing changes to repository")
      .action(async () => {
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
      .action((cmd: Command) => this.infoAction(cmd));

    // list command
    // will be changed in GITTT-85
    commander
      .command("list")
      .description("List of time tracks in project")
      .action(() => this.listAction());

    // report command
    // will be changed in GITTT-85
    commander
      .command("report")
      .description("Prints a small report")
      .option("-d, --days <number>", "Specify for how many days the report should be printed.")
      .option("-p, --project <project name>", "Specify the project the report should be printed for. Default is the project in the current directory.")
      .action((cmd: Command) => this.reportAction(cmd));

    // log command
    // not needed anymore
    // commander
    //   .command("log")
    //   .description("List of local changes")
    //   .action(async () => {
    //     const logs: ReadonlyArray<DefaultLogFields> = await this.gitHelper.logChanges();
    //     if (logs.length > 0) {
    //       LogHelper.warn("Local changes:");
    //       for (const log of logs) {
    //         console.log(`${log.date}\n  ${log.message.trim()}`);
    //       }
    //     } else {
    //       LogHelper.info("Everything is up to date");
    //     }
    //   });

    // status command
    // not needed anymore
    // commander
    //   .command("status")
    //   .description("Overview of all projects")
    //   .action(async () => {
    //     const projects: IProject[] = await this.fileHelper.findAllProjects();
    //     let totalHours: number = 0;

    //     LogHelper.info("Projects:");
    //     for (const pL of projects) {
    //       const hours: number = await this.projectHelper.getTotalHours(pL.name);
    //       LogHelper.info(`${pL.name}:\t${hours}`);
    //       totalHours += hours;
    //     }
    //     LogHelper.info("");

    //     LogHelper.info("Summery:");
    //     LogHelper.info(`Total projects:\t${projects.length}`);
    //     LogHelper.info(`Total hours:\t${totalHours}`);
    //   });

    commander
      .command("setup")
      .description("Initializes config directory and setup of gittt git project")
      .action(async () => {
        await this.initConfigDir();
      });

    // start command
    commander
      .command("start")
      .description("Start the timer")
      .action(async () => {
        await this.timerHelper.startTimer();
      });

    // stop command
    commander
      .command("stop")
      .description("Stop the timer and commit to a project")
      .option("-k, --kill", "Kill the timer for a project")
      .option("-m, --message <message>", "Commit message for the project")
      .action(async (cmd: any): Promise<void> => {
        if (cmd.kill) {
          await this.timerHelper.killTimer();
        } else {
          await this.timerHelper.stopTimer(cmd.message);
        }
      });

    // init command
    commander
      .command("init")
      .description("Initializes the project in current git directory")
      .action(async () => {
        const initProjectAnswers: IInitProjectAnswers = await inquirer.prompt([
          {
            message: "This will reset the project if it is already initialized, are you sure?",
            name: "confirm",
            type: "confirm",
          },
        ]);

        if (initProjectAnswers.confirm) {
          await this.projectHelper.initProject();
        }
      });

    // link command
    commander
      .command("link")
      .description("Initialize or edit link to third party applications")
      .action(async () => {
        await this.linkAction();
      });

    // publish command
    commander
      .command("publish")
      .description("Publishes stored records to external endpoint")
      .action(async (cmd: Command) => {
        await this.publishAction(cmd);
      });

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
      .action(async (cmd: Command): Promise<void> => {
        await this.editAction(cmd);
      });

    // remove command
    commander
      .command("remove")
      .description("Remove record of current project")
      .option("-g, --guid [guid]", "GUID of the record to remove")
      .action(async (cmd: Command): Promise<void> => {
        await this.removeAction(cmd);
      });

    // import command
    commander
      .command("import")
      .description("Import records from csv to current project")
      .option("-f, --file [file]", "CSV file with format (MESSAGE,END[int],AMOUNT[double])")
      .action(async (cmd: Command): Promise<void> => {
        await this.importCsv(cmd);
      });

    // export command
    commander
      .command("export")
      .description("Exports projects to ods file")
      .option("-f, --filename [filename]", "Filename of the output file (default: gittt-report)")
      .option("-d, --directory [directory]", "Directory where to store the export (default: current working dir)")
      .option("-t, --type [file type]", "File type of the export (default: ods) - supported types: https://github.com/SheetJS/sheetjs#supported-output-formats")
      .option("-p, --project [project to export]", "Name of the project")
      .action(async (cmd: Command): Promise<void> => {
        await this.exportAction(cmd);
      });

    return commander;
  }
}
