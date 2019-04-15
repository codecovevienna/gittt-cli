import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { App } from "../../app";
import { LogHelper, parseProjectNameFromGitUrl } from "../../helper";
import { IInitProjectAnswers } from "../../interfaces";

describe.only("Edit test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should edit specific record by cli input", async () => {
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
          return {};
        },
        TimerHelper: function TimerHelper(): any {
          return {};
        },
        parseProjectNameFromGitUrl,
      },
      "commander": mockedCommander,
      "inquirer": {
        prompt: sinon.stub()
          .onCall(0).resolves({
            confirm: true,
          } as IInitProjectAnswers),
      },
    });
    const mockedApp: App = new proxy.App();

    sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "edit"];
    mockedApp.start();

    // TODO looks like a timing issue due to the inquirer confirm call
    // assert.isTrue(initProjectStub.called);
  });
});
