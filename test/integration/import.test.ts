import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";

describe("Import test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should import from csv", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

    const proxy: any = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper(): any {
          return {
            configDirExists: sinon.stub().resolves(true),
            isFile: sinon.stub().resolves("/path"),
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

    const importActionStub: SinonStub = sinon.stub(mockedApp, "importCsv").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "import"];
    mockedApp.start();

    assert.isTrue(importActionStub.calledOnce);
  });
});
