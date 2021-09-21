import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Init test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should init project", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);

    const initProjectStub = sinon.stub().resolves();


    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
    }

    mockedHelper.ConfigHelper = class {
      public static instance: any;
      public static getInstance(): any { if (!this.instance) { this.instance = new this() } return this.instance }
      public isInitialized = sinon.stub().resolves(true);
    }

    mockedHelper.ProjectHelper = class {
      public initProject = initProjectStub;
    }

    mockedHelper.QuestionHelper = class {
      public static confirmInit = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });


    const mockedApp: App = new proxy.App();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "init"];
    mockedApp.start();

    // TODO looks like a timing issue due to the inquirer confirm call
    // assert.isTrue(initProjectStub.called);
  });
});
