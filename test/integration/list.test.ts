import { assert } from "chai";
import { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { RECORD_TYPES } from "../../types";
import { emptyHelper } from "../helper";

describe("List test", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should call list action", async function () {
    const mockedHelper: any = Object.assign({}, emptyHelper);
    const mockedCommander: CommanderStatic = proxyquire("commander", {});

    const findProjectByNameStub = sinon.stub().resolves(
      {
        meta: {
          host: "github.com",
          port: 443,
        },
        name: "mocked_project",
        records: [
          {
            amount: 2,
            created: 1572346125890,
            end: 1572346125745,
            guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb8",
            message: "A mocked message",
            type: RECORD_TYPES.Time,
            updated: 1572346125890,
          },
          {
            amount: 2.5,
            created: 1571323193712,
            end: 1571323193545,
            guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600290",
            message: "Some other mocked message",
            type: RECORD_TYPES.Time,
            updated: 1571323193712,
          },
        ],
      },
    );

    mockedHelper.FileHelper = class {
      public static getHomeDir = sinon.stub().returns("/home/test");
      public findProjectByName = findProjectByNameStub;
    }

    mockedHelper.ConfigHelper = class {
      public static instance: any;
      public static getInstance(): any { if (!this.instance) { this.instance = new this() } return this.instance }
      public isInitialized = sinon.stub().resolves(true);
    }

    const proxy: any = proxyquire("../../app", {
      "./helper": mockedHelper,
      "commander": mockedCommander,
    });

    const mockedApp: App = new proxy.App();

    const listActionStub = sinon.stub(mockedApp, "listAction").resolves();

    await mockedApp.setup();

    process.argv = ["namespace", "mocked", "list"];
    mockedApp.start();

    assert.isTrue(listActionStub.calledOnce);
  });
});
