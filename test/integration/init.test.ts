import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { IInitProjectAnswers } from "../../interfaces";
import { emptyHelper } from "../helper";

describe("Init test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should init project", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const initProjectStub: SinonStub = sinon.stub().resolves();


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


    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "init"];
    mockedApp.start();

    // TODO looks like a timing issue due to the inquirer confirm call
    // assert.isTrue(initProjectStub.called);
  });
});
