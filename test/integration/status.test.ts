import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { IProject, IRecord } from "../../interfaces";
import { emptyHelper } from "../helper";

describe("Status test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should output project overview", async () => {
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
            type: "Time",
          } as IRecord,
          {
            amount: 69,
            created: Date.now(),
            message: "Mocked message",
            type: "Time",
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
            type: "Time",
          } as IRecord,
          {
            amount: 1970,
            created: Date.now(),
            message: "Mocked message",
            type: "Time",
          } as IRecord,
        ],
      } as IProject,
    ]);

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
      public findAllProjects = findAllProjectsStub;
    }

    mockedHelper.ProjectHelper = class {
      public getTotalHours = sinon.stub();
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "status"];
    mockedApp.start();
  });
});
