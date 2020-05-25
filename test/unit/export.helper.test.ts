import proxyquire from "proxyquire";
import { IProject, IProjectMeta } from "../../interfaces";
import { RECORD_TYPES } from "../../types";
import moment from "moment";
import sinon from "sinon";
import { utils } from 'xlsx';
import { assert } from "chai";

describe("ExportHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should export projects", async function () {
    const writeFileStub = sinon.stub();

    const proxy: any = proxyquire("../../helper/export", {
      xlsx: {
        writeFile: writeFileStub,
        utils,
      }
    });
    const mockedProjects: IProject[] = [
      {
        meta: {
          host: "github.com",
          port: 22,
        } as IProjectMeta,
        name: "TestProject_1",
        records: [
          {
            amount: 1337,
            end: moment("2013-02-08 16:00:00.000").unix() * 1000,
            message: "Test message",
            type: RECORD_TYPES.Time,
          },
          {
            amount: 69,
            end: moment("2013-02-09 18:00:00.000").unix() * 1000,
            message: "Some other test message",
            type: RECORD_TYPES.Time,
          },
        ],
      } as IProject,
      {
        meta: {
          host: "github.com",
          port: 22,
        } as IProjectMeta,
        name: "TestProject_2",
        records: [
          {
            amount: 12,
            end: moment("2013-02-10 13:00:00.000").unix() * 1000,
            message: "git init awesome project",
            type: RECORD_TYPES.Time,
          },
        ],
      } as IProject
    ]

    const expectedWorksheet = { "SheetNames": ["TestProject_1", "TestProject_2"], "Sheets": { "TestProject_1": { "A1": { "v": "Date", "t": "s" }, "B1": { "v": "Type", "t": "s" }, "C1": { "v": "Amount", "t": "s" }, "D1": { "v": "Comment", "t": "s" }, "A2": { "v": 41313.666666666664, "z": "m/d/yy", "t": "n", "w": "2/8/13" }, "B2": { "v": "Time", "t": "s" }, "C2": { "v": 1337, "t": "n" }, "D2": { "v": "Test message", "t": "s" }, "A3": { "v": 41314.75, "z": "m/d/yy", "t": "n", "w": "2/9/13" }, "B3": { "v": "Time", "t": "s" }, "C3": { "v": 69, "t": "n" }, "D3": { "v": "Some other test message", "t": "s" }, "!ref": "A1:D3" }, "TestProject_2": { "A1": { "v": "Date", "t": "s" }, "B1": { "v": "Type", "t": "s" }, "C1": { "v": "Amount", "t": "s" }, "D1": { "v": "Comment", "t": "s" }, "A2": { "v": 41315.541666666664, "z": "m/d/yy", "t": "n", "w": "2/10/13" }, "B2": { "v": "Time", "t": "s" }, "C2": { "v": 12, "t": "n" }, "D2": { "v": "git init awesome project", "t": "s" }, "!ref": "A1:D2" } } }

    proxy.ExportHelper.export(undefined, undefined, undefined, mockedProjects);

    const filePath = `${process.cwd()}/gittt-export.ods`

    assert.isTrue(writeFileStub.calledWith(expectedWorksheet, filePath));
  });

  it("should export projects with parameters", async function () {
    const writeFileStub = sinon.stub();

    const proxy: any = proxyquire("../../helper/export", {
      xlsx: {
        writeFile: writeFileStub,
        utils,
      }
    });
    const mockedProjects: IProject[] = [
      {
        meta: {
          host: "github.com",
          port: 22,
        } as IProjectMeta,
        name: "TestProject_1",
        records: [
          {
            amount: 1337,
            end: moment("2013-02-08 16:00:00.000").unix() * 1000,
            message: "Test message",
            type: RECORD_TYPES.Time,
          },
          {
            amount: 69,
            end: moment("2013-02-09 18:00:00.000").unix() * 1000,
            message: "Some other test message",
            type: RECORD_TYPES.Time,
          },
        ],
      } as IProject,
      {
        meta: {
          host: "github.com",
          port: 22,
        } as IProjectMeta,
        name: "TestProject_2",
        records: [
          {
            amount: 12,
            end: moment("2013-02-10 13:00:00.000").unix() * 1000,
            message: "git init awesome project",
            type: RECORD_TYPES.Time,
          },
        ],
      } as IProject
    ]

    const expectedWorksheet = { "SheetNames": ["TestProject_1", "TestProject_2"], "Sheets": { "TestProject_1": { "A1": { "v": "Date", "t": "s" }, "B1": { "v": "Type", "t": "s" }, "C1": { "v": "Amount", "t": "s" }, "D1": { "v": "Comment", "t": "s" }, "A2": { "v": 41313.666666666664, "z": "m/d/yy", "t": "n", "w": "2/8/13" }, "B2": { "v": "Time", "t": "s" }, "C2": { "v": 1337, "t": "n" }, "D2": { "v": "Test message", "t": "s" }, "A3": { "v": 41314.75, "z": "m/d/yy", "t": "n", "w": "2/9/13" }, "B3": { "v": "Time", "t": "s" }, "C3": { "v": 69, "t": "n" }, "D3": { "v": "Some other test message", "t": "s" }, "!ref": "A1:D3" }, "TestProject_2": { "A1": { "v": "Date", "t": "s" }, "B1": { "v": "Type", "t": "s" }, "C1": { "v": "Amount", "t": "s" }, "D1": { "v": "Comment", "t": "s" }, "A2": { "v": 41315.541666666664, "z": "m/d/yy", "t": "n", "w": "2/10/13" }, "B2": { "v": "Time", "t": "s" }, "C2": { "v": 12, "t": "n" }, "D2": { "v": "git init awesome project", "t": "s" }, "!ref": "A1:D2" } } }

    proxy.ExportHelper.export("/tmp", "test", "xlsx", mockedProjects);

    const filePath = `/tmp/test.xlsx`

    assert.isTrue(writeFileStub.calledWith(expectedWorksheet, filePath));
  });
});
