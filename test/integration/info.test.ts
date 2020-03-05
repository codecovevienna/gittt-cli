import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
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

    const findAllProjectsStub = sinon.stub().resolves([
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
      public findAllProjects = findAllProjectsStub;
    }

    mockedHelper.ConfigHelper = class {
      public isInitialized = sinon.stub().resolves(true);
    }

    mockedHelper.ProjectHelper = class {
      public getProjectFromGit = sinon.stub();
      public getTotalHours = sinon.stub();
      public getOrAskForProjectFromGit = sinon.stub().resolves(
        {
          meta: {
            host: "",
            port: 0,
          },
          name: "mocked",
          records: [],
        } as IProject
      );
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
