import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";

describe("Commit test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should commit hours", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const addRecordStub: SinonStub = sinon.stub().resolves();

    const proxy: any = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper(): any {
          return {
            configDirExists: sinon.stub().resolves(true),
          };
        },
        GitHelper: function GitHelper(): any {
          return {};
        },
        LogHelper,
        ProjectHelper: function ProjectHelper(): any {
          return {
            addRecordToProject: addRecordStub,
          };
        },
        TimerHelper: function TimerHelper(): any {
          return {};
        },
        ImportHelper: function ImportHelper(): any {
          return {};
        },
      },
      "commander": mockedCommander,
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "commit", "1337"];
    mockedApp.start();

    assert.isTrue(addRecordStub.called);
  });

  it("should fail to commit hours", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

    const proxy: any = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper(): any {
          return {
            configDirExists: sinon.stub().resolves(true),
          };
        },
        GitHelper: function GitHelper(): any {
          return {};
        },
        LogHelper,
        ProjectHelper: function ProjectHelper(): any {
          return {};
        },
        TimerHelper: function TimerHelper(): any {
          return {};
        },
        ImportHelper: function ImportHelper(): any {
          return {};
        },
      },
      "commander": mockedCommander,
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "commit", "noNumber"];
    mockedApp.start();

    assert.isTrue(exitStub.calledOnce);
  });
});
