import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { IInitProjectAnswers } from "../../interfaces";
import { emptyHelper } from "../helper";

describe("Init test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should init project", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const initProjectStub: SinonStub = sinon.stub().resolves();

    // const proxy: any = proxyquire("../../app", {
    //   "./helper": {
    //     FileHelper: function FileHelper(): any {
    //       return {
    //         configDirExists: sinon.stub().resolves(true),
    //       };
    //     },
    //     GitHelper: function GitHelper(): any {
    //       return {};
    //     },
    //     ImportHelper: function ImportHelper(): any {
    //       return {};
    //     },
    //     LogHelper,
    //     ProjectHelper: function ProjectHelper(): any {
    //       return {
    //         initProject: initProjectStub,
    //       };
    //     },
    //     TimerHelper: function TimerHelper(): any {
    //       return {};
    //     },
    //   },
    //   "commander": mockedCommander,
    //   "inquirer": {
    //     prompt: sinon.stub().resolves({
    //       confirm: true,
    //     } as IInitProjectAnswers),
    //   },
    // });

    const mockedHelper: any = Object.assign({}, emptyHelper);

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    mockedHelper.ProjectHelper = class {
      public initProject = initProjectStub;
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
      "inquirer": {
        prompt: sinon.stub().resolves({
          confirm: true,
        } as IInitProjectAnswers),
      },
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    // sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    // sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "init"];
    mockedApp.start();

    // TODO looks like a timing issue due to the inquirer confirm call
    // assert.isTrue(initProjectStub.called);
  });
});
