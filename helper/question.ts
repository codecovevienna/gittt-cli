import inquirer, { Question } from "inquirer";
import _ from "lodash";
import moment from "moment";
import { parseProjectNameFromGitUrl } from ".";
import { IJiraLink, IProject, IRecord } from "../interfaces";
import { RECORD_TYPES } from "../types";
import { FileHelper } from "./file";

export class QuestionHelper {
  public static validateNumber = (input: any, from?: number, to?: number): boolean => {
    if (!isNaN(input)) {
      const inputNumber: number = parseInt(input, 10);
      if (typeof from === "number" && typeof to === "number") {
        if (inputNumber >= from && inputNumber <= to) {
          return true;
        } else {
          return false;
        }
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  public static validateYear = (input: any): boolean | string | Promise<boolean | string> => {
    if (QuestionHelper.validateNumber(input)) {
      return true;
    } else {
      return "The year has to be a number";
    }
  }
  public static validateMonth = (input: any): boolean | string | Promise<boolean | string> => {
    if (QuestionHelper.validateNumber(input, 1, 12)) {
      return true;
    } else {
      return "The month has to be a number between 1 and 12";
    }
  }
  public static validateDay = (input: any): boolean | string | Promise<boolean | string> => {
    if (QuestionHelper.validateNumber(input, 1, 31)) {
      return true;
    } else {
      return "The day has to be a number between 1 and 31";
    }
  }
  public static validateHour = (input: any): boolean | string | Promise<boolean | string> => {
    if (QuestionHelper.validateNumber(input, 0, 23)) {
      return true;
    } else {
      return "The hour has to be a number between 0 and 23";
    }
  }
  public static validateMinute = (input: any): boolean | string | Promise<boolean | string> => {
    if (QuestionHelper.validateNumber(input, 0, 59)) {
      return true;
    } else {
      return "The minute has to be a number between 0 and 59";
    }
  }

  public static validateAmount = (input: any): boolean | string | Promise<boolean | string> => {
    if (QuestionHelper.validateNumber(input)) {
      return true;
    } else {
      return "The amount has to be a number";
    }
  }

  public static validateGitUrl = (input: any): boolean | string | Promise<boolean | string> => {
    try {
      // Will throw if parsing fails
      parseProjectNameFromGitUrl(input);
      return true;
    } catch (err) {
      return "The url has to look like ssh://git@github.com:22/gittt/project.git";
    }
  }

  public static validateJiraEndpoint = (input: any): boolean | string | Promise<boolean | string> => {
    // TODO improve
    const inputString: string = input;
    if (new RegExp("^(http://|https://).+").test(inputString)) {
      return true;
    } else {
      return "The endpoint has to be a valid url";
    }
  }

  public static validateJiraKey = (input: any): boolean | string | Promise<boolean | string> => {
    const inputString: string = input;
    if (inputString.length > 1) {
      return true;
    } else {
      return "The key has to be longer than one character";
    }
  }

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
        validate: QuestionHelper.validateYear,
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
        validate: QuestionHelper.validateMonth,
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
        validate: QuestionHelper.validateDay,
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
        validate: QuestionHelper.validateHour,
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
        validate: QuestionHelper.validateMinute,
      },
    ]);

    return parseInt(choice.choice, 10);
  }

  public static askAmount = async (oldAmount?: number): Promise<number> => {
    const question: Question = {
      message: "Update amount",
      name: "choice",
      type: "number",
      validate: QuestionHelper.validateAmount,
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
        validate: QuestionHelper.validateGitUrl,
      },
    ]);

    return choice.choice;
  }

  public static askJiraLink = async (project: IProject): Promise<IJiraLink> => {
    const jiraAnswers: any = await inquirer.prompt([
      {
        filter: QuestionHelper.filterJiraEndpoint,
        message: "Jira gittt plugin endpoint",
        name: "endpoint",
        type: "input",
        validate: QuestionHelper.validateJiraEndpoint,

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
        validate: QuestionHelper.validateJiraKey,
      },
    ]);
    const { endpoint, key, username, password } = jiraAnswers;
    const hash: string = Buffer
      .from(`${username}:${password}`)
      .toString("base64");

    const projectName: string = project.name;

    const link: IJiraLink = {
      endpoint,
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

    const question: Question = {
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

    const question: Question = {
      choices,
      message: "What integration should be used?",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseDomain = async (domains: string[]): Promise<string> => {
    const question: Question = {
      choices: domains,
      message: "What domain should be used?",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }

  public static chooseProject = async (projects: IProject[]): Promise<IProject> => {
    const question: Question = {
      choices: projects.map((project: IProject) => {
        return {
          name: `${project.meta.host} ${project.name}`,
          value: FileHelper.projectMetaToDomain(project.meta),
        };
      }),
      message: "What integration should be used?",
      name: "choice",
      type: "list",
    };

    const choice: any = await inquirer.prompt([question]);

    return choice.choice;
  }
}
