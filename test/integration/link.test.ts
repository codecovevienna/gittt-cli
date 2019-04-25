import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";

describe("Link test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should link project to external tool", async () => {
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
      },
      "commander": mockedCommander,
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    const linkActionStub: SinonInspectable = sinon.stub(mockedApp, "linkAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "link"];
    mockedApp.start();

    assert.isTrue(linkActionStub.calledOnce);
  });
});
