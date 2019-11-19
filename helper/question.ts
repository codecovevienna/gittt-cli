import inquirer, { ListQuestion, Question } from "inquirer";
import _ from "lodash";
import moment from "moment";
import { IJiraLink, IProject, IRecord } from "../interfaces";
import { RECORD_TYPES } from "../types";
import { ProjectHelper, ValidationHelper } from "./";

export class QuestionHelper {
  public static filterJiraEndpoint = (input: any): boolean | string | Promise<boolean | string> => {
    // Ensure trailing slash
    if (input[input.length - 1] !== "/") {
      return input + "/";
    } else {
      return input;
    }
  }

  public static askYear = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().year(),
        message: "Year",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateYear,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askMonth = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().month() + 1,
        message: "Month",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateMonth,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askDay = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().date(),
        message: "Day",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateDay,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askHour = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().hour(),
        message: "Hour",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateHour,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askMinute = async (defaultValue?: number): Promise<number> => {
    const choice: any = await inquirer.prompt([
      {
        default: _.isNumber(defaultValue) ? defaultValue : moment().minute(),
        message: "Minute",
        name: "choice",
        type: "number",
        validate: ValidationHelper.validateMinute,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askAmount = async (oldAmount?: number): Promise<number> => {
    const question: Question = {
      message: "Update amount",
      name: "choice",
      type: "number",
      validate: ValidationHelper.validateAmount,
    };

    if (oldAmount) {
      question.default = oldAmount;
    }

    const choice: any = await inquirer.prompt([question]) as {
      amount: number,
    };

    return parseFloat(choice.choice);
  }

  public static askMessage = async (defaultValue?: string): Promise<string> => {
    const choice: any = await inquirer.prompt([
      {
        default: defaultValue ? defaultValue : undefined,
        message: "Message",
        name: "choice",
        type: "input",
      },
    ]);

    return choice.choice;
  }

  public static askGitUrl = async (): Promise<string> => {
    const choice: any = await inquirer.prompt([
      {
        message: "Git Repository URL:",
        name: "choice",
        type: "input",
        validate: ValidationHelper.validateGitUrl,
      },
    ]);

    return choice.choice;
  }

  public static askJiraLink = async (project: IProject): Promise<IJiraLink> => {
    const jiraAnswers: any = await inquirer.prompt([
      {
        default: "https://jira.gittt.org",
        filter: QuestionHelper.filterJiraEndpoint,
        message: "Jira host",
        name: "host",
        type: "input",
        validate: ValidationHelper.validateJiraEndpoint,
      },
      {
        message: "Jira username",
        name: "username",
        type: "input",
        // TODO validate
      },
      {
        message: "Jira password",
        name: "password",
        type: "password",
        // TODO validate
      },
      {
        message: "Jira project key (e.g. GITTT)",
        name: "key",
        type: "input",
        validate: ValidationHelper.validateJiraKey,
      },
    ]);
    const { host, key, username, password } = jiraAnswers;
    const hash: string = Buffer
      .from(`${username}:${password}`)
      .toString("base64");

    const projectName: string = project.name;

    const link: IJiraLink = {
      // Tailing slash is ensured by the filter
      endpoint: `${host}rest/gittt/latest/`,
      hash,
      key,
      linkType: "Jira",
      projectName,
      username,
    };

    return link;
  }

  public static chooseRecord = async (records: IRecord[]): Promise<IRecord> => {
    const choice: any = await inquirer.prompt([
      {
        choices: records.map((rc: IRecord) => {
          return {
            name: `${moment(rc.end).format("DD.MM.YYYY, HH:mm:ss")}: ${rc.amount} ${rc.type} - "${_.
              truncate(rc.message)}"`,
            value: rc.guid,
          };
        }),
        message: "List of records",
        name: "choice",
        type: "list",
      },
    ]);

    const chosenRecords: IRecord[] = records.filter((rc: IRecord) => {
      return rc.guid === choice.choice;
    });

    const [chosenRecord] = chosenRecords;

    return chosenRecord;
  }

  public static chooseType = async (oldType?: RECORD_TYPES): Promise<RECORD_TYPES> => {
    const choices: Array<{ name: string, value: string }> = [
      {
        name: "Time",
        value: "Time",
      },
    ];

    const question: ListQuestion = {
      choices,
      message: "Type",
      name: "choice",
      type: "list",
    };

    if (oldType) {
      question.default = oldType;
    }

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseIntegration = async (): Promise<string> => {
    const choices: string[] = [
      "Jira",
    ];

    const question: ListQuestion = {
      choices,
      message: "What integration should be used?",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseDomain = async (domains: string[]): Promise<string> => {
    const question: ListQuestion = {
      choices: domains,
      message: "What domain should be used?",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseProjectFile = async (projects: IProject[]): Promise<string> => {
    const question: ListQuestion = {
      choices: projects.map((project: IProject) => {
        const { host, port } = project.meta;
        return {
          name: `${host}:${port} ${project.name}`,
          value: ProjectHelper.getProjectPath(project),
        };
      }),
      message: "Choose a project",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static confirmMigration = async (): Promise<boolean> => {
    const question: Question = {
      message: `Do you want to migrate from an existing project?`,
      name: "choice",
      type: "confirm",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }
}
