import proxyquire from "proxyquire";
import { IProject, IProjectMeta } from "../../interfaces";
import { RECORD_TYPES } from "../../types";
import moment from "moment";
import sinon from "sinon";
import { assert, expect } from "chai";
import { utils } from 'xlsx';

describe("ExportHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should export projects", async function () {
    const expectedFilePath = `${process.cwd()}/gittt-export.ods`
    const writeFileStub = sinon.stub().callsFake((expectedWorksheet: any, filePath: string) => {
      expect(filePath).equals(expectedFilePath);
      assert.isNotEmpty(expectedWorksheet);
      assert.isNotEmpty(expectedWorksheet["SheetNames"]);
      expect(expectedWorksheet["SheetNames"]).deep.equal(["TestProject_1", "TestProject_2"]);
    });

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

    proxy.ExportHelper.export(undefined, undefined, undefined, mockedProjects);
    assert.isTrue(writeFileStub.called);
  });

  it("should export projects with parameters", async function () {
    const expectedFilePath = `/tmp/test.xlsx`
    const writeFileStub = sinon.stub().callsFake((expectedWorksheet: any, filePath: string) => {
      expect(filePath).equals(expectedFilePath);
      assert.isNotEmpty(expectedWorksheet);
      assert.isNotEmpty(expectedWorksheet["SheetNames"]);
      expect(expectedWorksheet["SheetNames"]).deep.equal(["TestProject_1", "TestProject_2"]);
    });

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

    proxy.ExportHelper.export("/tmp", "test", "xlsx", mockedProjects);

    assert.isTrue(writeFileStub.called);
  });
});
