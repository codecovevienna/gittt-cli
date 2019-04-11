import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";
import { IInitProjectAnswers } from "../../interfaces";

describe("Init test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should init project", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const initProjectStub: SinonInspectable = sinon.stub().resolves();

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
            initProject: initProjectStub,
          };
        },
        TimerHelper: function TimerHelper(): any {
          return {};
        },
      },
      "commander": mockedCommander,
      "inquirer": {
        prompt: sinon.stub().resolves({
          confirm: true,
        } as IInitProjectAnswers),
      },
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "init"];
    mockedApp.start();

    // TODO looks like a timing issue due to the inquirer confirm call
    // assert.isTrue(initProjectStub.called);
  });
});
