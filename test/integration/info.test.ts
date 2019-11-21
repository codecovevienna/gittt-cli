import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { IProject, IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";
import { emptyHelper } from "../helper";

describe("Info test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should output project overview", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const findAllProjectsStub: SinonStub = sinon.stub().resolves([
      {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "mocked_project_1",
        records: [
          {
            amount: 1337,
            created: Date.now(),
            message: "Mocked message",
            type: RECORD_TYPES.Time,
          } as IRecord,
          {
            amount: 69,
            created: Date.now(),
            message: "Mocked message",
            type: RECORD_TYPES.Time,
          } as IRecord,
        ],
      } as IProject,
      {
        meta: {
          host: "gitlab.com",
          port: 443,
        },
        name: "mocked_project_2",
        records: [
          {
            amount: 1234,
            created: Date.now(),
            message: "Mocked message",
            type: RECORD_TYPES.Time,
          } as IRecord,
          {
            amount: 1970,
            created: Date.now(),
            message: "Mocked message",
            type: RECORD_TYPES.Time,
          } as IRecord,
        ],
      } as IProject,
    ]);


    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
      public findAllProjects = findAllProjectsStub;
    }

    mockedHelper.ProjectHelper = class {
      public getProjectFromGit = sinon.stub();
      public getTotalHours = sinon.stub();
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });


    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "info"];
    mockedApp.start();
  });
});
