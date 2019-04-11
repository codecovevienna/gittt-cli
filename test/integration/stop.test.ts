import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";

describe("Stop test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should stop time tracking", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const stopTimerStub: SinonInspectable = sinon.stub().resolves();

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
          return {
            stopTimer: stopTimerStub,
          };
        },
      },
      "commander": mockedCommander,
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "stop", "-m", "mock"];
    mockedApp.start();

    assert.isTrue(stopTimerStub.calledOnceWith("mock"));
  });
});
