import proxyquire from "proxyquire"
import sinon from "sinon"
import commander from "commander";
import { assert } from "chai";
import { App } from "../../app";

describe("Help test", () => {
  it("should show help", async () => {
    const mockedCommander = commander;
    const helpStub = sinon.stub(mockedCommander, "help")

    const proxy = proxyquire("../../app", {
      os: {
        homedir: sinon.stub().returns("/home/test")
      },
      "./helper": {
        FileHelper: function FileHelper() {
          return {
            configDirExists: sinon.stub().resolves(true)
          }
        },
        GitHelper: function GitHelper() {
          return {}
        }
      },
      commander: mockedCommander
    })
    const mockedApp: App = new proxy.App();
    await mockedApp.setup()

    process.argv = ["mocked", "unknownOption"];
    await mockedApp.start()

    assert.isTrue(helpStub.called)
  })
})