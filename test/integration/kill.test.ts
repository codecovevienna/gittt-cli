import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { IProject } from "../../interfaces";
import { emptyHelper } from "../helper";

describe("Kill test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should kill time tracking", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const killTimerStub = sinon.stub().resolves();


    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
    }

    mockedHelper.ConfigHelper = class {
      public isInitialized = sinon.stub().resolves(true);
    }

    mockedHelper.TimerHelper = class {
      public killTimer = killTimerStub;
    }

    mockedHelper.ProjectHelper = class {
      public getProjectByName = sinon.stub().resolves(
        {
          meta: {
            host: "",
            port: 0,
          },
          name: "mocked_project_1",
          records: [],
        } as IProject
      )
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });

    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "stop", "-k"];
    mockedApp.start();

    assert.isTrue(killTimerStub.calledOnce);
  });
});
