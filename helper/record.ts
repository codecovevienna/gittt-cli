import { v1 as uuid } from "uuid";
import { IRecord } from "../interfaces";
import inquirer from "inquirer";
import moment from "moment";

export class RecordHelper {
  /*
   * returns {boolean} true if provided record is identical to any record in records
   */
  // FIXME could be covered by lodash, e.g. _.uniqWith(records, _.isEqual)
  public static isRecordUnique = (record: IRecord, records: IRecord[]): boolean => {
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
  public static isRecordOverlapping = (record: IRecord, records: IRecord[]): boolean => {
    // check if any overlapping records are present
    return records.find((existingRecord: IRecord) => {
      const startExisting: number = existingRecord.end - existingRecord.amount;
      const startAdd: number = record.end - record.amount;
      const endExisting: number = existingRecord.end;
      const endAdd: number = record.end;
      if (
        (startAdd >= startExisting && startAdd < endExisting) ||
        (endAdd > startAdd && endAdd <= endExisting) ||
        (startAdd <= startExisting && endAdd >= endExisting)
      ) {
        return true;
      }
      return false;
    }) === undefined;
  }

  /*
   * Sets guid and current timestamps to given record object
   */
  public static setRecordDefaults = (record: IRecord): IRecord => {
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

  public static async filterRecordsByYear(records: IRecord[]): Promise<IRecord[]> {
    const allYears: string[] = [];

    for (const rc of records) {
      const currentYear: string = moment(rc.end).format("YYYY");
      if (allYears.indexOf(currentYear) === -1) {
        allYears.push(currentYear);
      }
    }

    // Check if records spanning over more than one year
    if (allYears.length > 1) {
      const choiceYear = await inquirer.prompt([
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

  public static async filterRecordsByMonth(records: IRecord[]): Promise<IRecord[]> {
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
      const choiceMonth = await inquirer.prompt([
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

  public static async filterRecordsByDay(records: IRecord[]): Promise<IRecord[]> {
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
      const choiceDay = await inquirer.prompt([
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
}
