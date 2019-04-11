import { assert } from "chai";
import commander, { CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { App } from "../../app";

describe("Help test", () => {
  it("should show help", async () => {
    const mockedCommander: CommanderStatic = commander;
    const helpStub: SinonInspectable = sinon.stub(mockedCommander, "help");

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
      },
      "commander": mockedCommander,
      "os": {
        homedir: sinon.stub().returns("/home/test"),
      },
    });
    const mockedApp: App = new proxy.App();
    await mockedApp.setup();

    process.argv = ["mocked", "unknownOption"];
    mockedApp.start();

    assert.isTrue(helpStub.called);
  });
});
