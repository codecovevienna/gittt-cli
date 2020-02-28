import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { LogHelper } from "../../helper/index";
import { IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("RecordHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  describe("setRecordDefaults", function () {
    it("should set record default values", async function () {

      const proxy: any = proxyquire("../../helper/record", {});

      const now = Date.now();

      const twentyTwentyRecord: IRecord = {
        amount: 69,
        end: 1582813739983,
        type: RECORD_TYPES.Time,
      }

      const populatedRecord = await proxy.RecordHelper.setRecordDefaults(twentyTwentyRecord);

      expect(populatedRecord.guid).to.be.a('string');
      expect(populatedRecord.created).to.be.least(now);
      expect(populatedRecord.updated).to.be.least(now);
      expect(populatedRecord.amount).to.eq(twentyTwentyRecord.amount);
      expect(populatedRecord.end).to.eq(twentyTwentyRecord.end);
      expect(populatedRecord.type).to.eq(twentyTwentyRecord.type);
    });
  });

  describe("filterByYear", function () {
    it("should filter multiple years", async function () {
      const proxy: any = proxyquire("../../helper/record", {
        "inquirer": {
          prompt: sinon.stub().resolves({
            year: "2020",
          }),
        },
      });

      const twentyTwentyRecord: IRecord = {
        amount: 69,
        end: 1582813739983,
        type: RECORD_TYPES.Time,
      }
      const ancientRecord: IRecord = {
        amount: 69,
        end: 1382813739983,
        type: RECORD_TYPES.Time,
      }

      expect((await proxy.RecordHelper.filterRecordsByYear(
        [
          twentyTwentyRecord,
          ancientRecord
        ]
      ))[0]).to.eq(twentyTwentyRecord);
    });

    it("should filter one year", async function () {
      const proxy: any = proxyquire("../../helper/record", {});

      const twentyTwentyRecord: IRecord = {
        amount: 69,
        end: 1582813739983,
        type: RECORD_TYPES.Time,
      }

      expect((await proxy.RecordHelper.filterRecordsByYear(
        [
          twentyTwentyRecord,
        ]
      ))[0]).to.eq(twentyTwentyRecord);
    });
  });

  describe("filterRecordsByMonth", function () {
    it("should filter multiple months", async function () {
      const proxy: any = proxyquire("../../helper/record", {
        "inquirer": {
          prompt: sinon.stub().resolves({
            month: "February",
          }),
        },
      });

      const twentyTwentyRecord: IRecord = {
        amount: 69,
        end: 1582813739983,
        type: RECORD_TYPES.Time,
      }
      const ancientRecord: IRecord = {
        amount: 69,
        end: 1382813739983,
        type: RECORD_TYPES.Time,
      }

      expect((await proxy.RecordHelper.filterRecordsByMonth(
        [
          twentyTwentyRecord,
          ancientRecord
        ]
      ))[0]).to.eq(twentyTwentyRecord);
    });

    it("should filter one month", async function () {
      const proxy: any = proxyquire("../../helper/record", {});

      const twentyTwentyRecord: IRecord = {
        amount: 69,
        end: 1582813739983,
        type: RECORD_TYPES.Time,
      }

      expect((await proxy.RecordHelper.filterRecordsByMonth(
        [
          twentyTwentyRecord,
        ]
      ))[0]).to.eq(twentyTwentyRecord);
    });
  });

  describe("filterRecordsByDay", function () {
    it("should filter multiple days", async function () {
      const proxy: any = proxyquire("../../helper/record", {
        "inquirer": {
          prompt: sinon.stub().resolves({
            day: "27",
          }),
        },
      });

      const twentyTwentyRecord: IRecord = {
        amount: 69,
        end: 1582813739983,
        type: RECORD_TYPES.Time,
      }
      const ancientRecord: IRecord = {
        amount: 69,
        end: 1382813739983,
        type: RECORD_TYPES.Time,
      }

      expect((await proxy.RecordHelper.filterRecordsByDay(
        [
          twentyTwentyRecord,
          ancientRecord
        ]
      ))[0]).to.eq(twentyTwentyRecord);
    });

    it("should filter one day", async function () {
      const proxy: any = proxyquire("../../helper/record", {});

      const twentyTwentyRecord: IRecord = {
        amount: 69,
        end: 1582813739983,
        type: RECORD_TYPES.Time,
      }

      expect((await proxy.RecordHelper.filterRecordsByDay(
        [
          twentyTwentyRecord,
        ]
      ))[0]).to.eq(twentyTwentyRecord);
    });
  });
});
