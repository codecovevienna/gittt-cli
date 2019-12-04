import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { emptyHelper } from "../helper";

describe("Add test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should add record", async function () {
    const mockedCommander: CommanderStatic = proxyquire("commander", {});
    const mockedHelper: any = Object.assign({}, emptyHelper);


    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public configDirExists = sinon.stub().resolves(true);
      public isConfigFileValid = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });


    const mockedApp: App = new proxy.App();

    const addActionStub = sinon.stub(mockedApp, "addAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "add"];
    mockedApp.start();

    assert.isTrue(addActionStub.calledOnce);
  });
});
