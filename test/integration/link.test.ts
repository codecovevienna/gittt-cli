import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper";
import { IInitProjectAnswers } from "../../interfaces";

describe.only("Link test", () => {
  before(() => {
    proxyquire.noCallThru();

    LogHelper.DEBUG = true;
    LogHelper.silence = false;
  });

  it("should setup new JIRA link", async () => {
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
          return {
            addLink: sinon.stub().resolves(),
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

    process.argv = ["namespace", "mocked", "link"];
    mockedApp.start();

  });
});
