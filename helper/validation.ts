
import plainFs from "fs";
import fs from "fs-extra";
import { parseProjectNameFromGitUrl } from "./";

export class ValidationHelper {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateYear = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input)) {
      return true;
    } else {
      return "The year has to be a number";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateMonth = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 1, 12)) {
      return true;
    } else {
      return "The month has to be a number between 1 and 12";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateDay = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 1, 31)) {
      return true;
    } else {
      return "The day has to be a number between 1 and 31";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateHour = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 0, 23)) {
      return true;
    } else {
      return "The hour has to be a number between 0 and 23";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateMinute = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 0, 59)) {
      return true;
    } else {
      return "The minute has to be a number between 0 and 59";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateAmount = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input)) {
      return true;
    } else {
      return "The amount has to be a number";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateGitUrl = (input: any): boolean | string | Promise<boolean | string> => {
    try {
      // Will throw if parsing fails
      parseProjectNameFromGitUrl(input);
      return true;
    } catch (err: any) {
      return "The url has to look like ssh://git@github.com:22/gittt/project.git";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateUsername = (input: any): boolean | string | Promise<boolean | string> => {
    if (!input) {
      return "No input provided";
    }

    const inputString: string = input;
    if (new RegExp("^[a-z0-9_-]{3,64}$").test(inputString)) {
      return true;
    } else {
      return "The username has to be a 3 to 64 characters long";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validatePassword = (input: any): boolean | string | Promise<boolean | string> => {
    if (!input) {
      return "No input provided";
    }

    const inputString: string = input;
    if (new RegExp("^[a-z0-9_-]{3,64}$").test(inputString)) {
      return true;
    } else {
      return "The password has to be a 3 to 64 characters long";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateClientSecret = (input: any): boolean | string | Promise<boolean | string> => {
    if (!input) {
      return "No input provided";
    }

    const inputString: string = input;
    if (new RegExp("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").test(inputString)) {
      return true;
    } else {
      return "The provided string does not seem to be a valid client secret";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateJiraEndpoint = (input: any): boolean | string | Promise<boolean | string> => {
    // TODO improve
    const inputString: string = input;
    if (new RegExp("^(http://|https://).+").test(inputString)) {
      return true;
    } else {
      return "The endpoint has to be a valid url";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateJiraKey = (input: any): boolean | string | Promise<boolean | string> => {
    const inputString: string = input;
    if (inputString.length > 1) {
      return true;
    } else {
      return "The key has to be longer than one character";
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateJiraIssueKey = (input: any): boolean | string | Promise<boolean | string> => {
    const inputString: string = input;
    if (inputString.length > 0) {
      const issueRegex = new RegExp('[A-Z]+-[1-9]+');
      if (issueRegex.test(inputString)) {
        return true;
      }
      return "The issue key has to contain a dash ('-')";
    } else {
      return true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static validateFile = (input: any): boolean => {
    if (typeof input === 'string') {
      try {
        const inputFilePath: string = input;
        const stats: fs.Stats = fs.statSync(inputFilePath);
        if (stats.isFile()) {
          fs.accessSync(inputFilePath, plainFs.constants.R_OK | plainFs.constants.W_OK);
          return true;
        }
      } catch (err: any) {
        return false;
      }
    }
    return false;
  }
}
