import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Unknown command test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should show help", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const helpStub: SinonStub = sinon.stub(mockedCommander, "help");

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
    //       return {};
    //     },
    //     TimerHelper: function TimerHelper(): any {
    //       return {};
    //     },
    //   },
    //   "commander": mockedCommander,
    // });

    const mockedHelper: any = Object.assign({}, emptyHelper);

    // tslint:disable
    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });
    // tslint:enable

    const mockedApp: App = new proxy.App();

    // sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    // sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "unknown"];
    mockedApp.start();

    assert.isTrue(helpStub.called);
  });
});
