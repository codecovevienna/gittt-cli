import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Link test", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should link project to external tool", async () => {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

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

    const linkActionStub: SinonStub = sinon.stub(mockedApp, "linkAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "link"];
    mockedApp.start();

    assert.isTrue(linkActionStub.calledOnce);
  });
});
