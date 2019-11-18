import { parseProjectNameFromGitUrl } from ".";

export class ValidationHelper {
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
    if (ValidationHelper.validateNumber(input)) {
      return true;
    } else {
      return "The year has to be a number";
    }
  }
  public static validateMonth = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 1, 12)) {
      return true;
    } else {
      return "The month has to be a number between 1 and 12";
    }
  }
  public static validateDay = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 1, 31)) {
      return true;
    } else {
      return "The day has to be a number between 1 and 31";
    }
  }
  public static validateHour = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 0, 23)) {
      return true;
    } else {
      return "The hour has to be a number between 0 and 23";
    }
  }
  public static validateMinute = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input, 0, 59)) {
      return true;
    } else {
      return "The minute has to be a number between 0 and 59";
    }
  }

  public static validateAmount = (input: any): boolean | string | Promise<boolean | string> => {
    if (ValidationHelper.validateNumber(input)) {
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
}
