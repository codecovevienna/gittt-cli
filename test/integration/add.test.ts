import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";

describe("Add test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should add record", async () => {
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

    const editActionStub: SinonStub = sinon.stub(mockedApp, "addAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "add"];
    mockedApp.start();

    assert.isTrue(editActionStub.calledOnce);
  });
});
