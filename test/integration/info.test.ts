import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";
import { IProject, IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";

describe("Info test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should output project overview", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

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

    const proxy: any = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper(): any {
          return {
            configDirExists: sinon.stub().resolves(true),
            findAllProjects: findAllProjectsStub,
          };
        },
        GitHelper: function GitHelper(): any {
          return {};
        },
        ImportHelper: function ImportHelper(): any {
          return {};
        },
        LogHelper,
        ProjectHelper: function ProjectHelper(): any {
          return {
            getProjectFromGit: sinon.stub(),
            getTotalHours: sinon.stub(),
          };
        },
        TimerHelper: function TimerHelper(): any {
          return {};
        },
      },
      "commander": mockedCommander,
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "info"];
    mockedApp.start();
  });
});
