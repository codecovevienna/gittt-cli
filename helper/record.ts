import uuid from "uuid/v1";
import { IRecord } from "../interfaces";

export class RecordHelper {
  /*
   * returns {boolean} true if provided record is identical to any record in records
   */
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
}
