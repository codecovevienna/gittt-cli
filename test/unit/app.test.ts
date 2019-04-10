import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import { CommanderStatic } from "commander";
import sinon, { SinonInspectable } from "sinon";
import { FileHelper, LogHelper } from "../../helper/index";
import { IConfigFile, IProject, IProjectMeta, IInitAnswers } from "../../interfaces";
import { App } from "../../app";

const configDir: string = path.join("mocked", ".git-time-tracker");
const configFileName: string = "config.json";
const projectsDir: string = "projects";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("App", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should create instance", async () => {
    const app: App = new App();
    expect(app).to.be.instanceOf(App);
  });

  it("should start app", async () => {
    const parseStub: SinonInspectable = sinon.spy()

    const proxy: any = proxyquire("../../app", {
      commander: {
        parse: parseStub
      }
    })

    process.argv = [
      "ts-node",
      "app.ts",
      "list"
    ]

    const app: App = new proxy.App();
    app.start();

    assert.isTrue(parseStub.calledOnce)
  });

  it("should start app and show help [unknown command]", async () => {
    const helpStub: SinonInspectable = sinon.spy()

    const proxy: any = proxyquire("../../app", {
      commander: {
        help: helpStub
      }
    })

    process.argv = [
      "mocked",
      "unknownCommand"
    ]

    const app: App = new proxy.App();
    app.start();

    assert.isTrue(helpStub.calledOnce)
  });

  it("should exit without error", async () => {
    const exitStub: SinonInspectable = sinon.stub(process, "exit");
    const warnStub: SinonInspectable = sinon.stub(LogHelper, "warn");

    const proxy: any = proxyquire("../../app", {})

    const app: App = new proxy.App();
    app.exit("Mock", 0);

    assert.isTrue(exitStub.calledWith(0))
    assert.isTrue(warnStub.calledWith("Mock"))

    exitStub.restore();
    warnStub.restore();
  });

  it("should exit with error", async () => {
    const exitStub: SinonInspectable = sinon.stub(process, "exit");
    const errorStub: SinonInspectable = sinon.stub(LogHelper, "error");

    const proxy: any = proxyquire("../../app", {})

    const app: App = new proxy.App();
    app.exit("Mock", 1337);

    assert.isTrue(exitStub.calledWith(1337))
    assert.isTrue(errorStub.calledWith("Mock"))

    exitStub.restore();
    errorStub.restore();
  });

  it("should get home directory [from os]", async () => {
    const proxy = proxyquire("../../app", {
      os: {
        homedir: sinon.stub().returns("/home/test")
      },
    })

    const app: App = new proxy.App();
    const homeDir = app.getHomeDir();

    expect(homeDir).to.eq("/home/test")
  })

  it("should get home directory [from process.env.HOME]", async () => {
    const proxy = proxyquire("../../app", {
      os: {
        homedir: sinon.stub().returns(undefined)
      },
    })

    process.env.HOME = "/home/test"

    const app: App = new proxy.App();
    const homeDir = app.getHomeDir();

    expect(homeDir).to.eq("/home/test")

    delete process.env.HOME
  })

  it("should get home directory [from process.env.HOMEPATH]", async () => {
    const proxy = proxyquire("../../app", {
      os: {
        homedir: sinon.stub().returns(undefined)
      },
    })

    process.env.HOMEPATH = "/home/test"

    const app: App = new proxy.App();
    const homeDir = app.getHomeDir();

    expect(homeDir).to.eq("/home/test")

    delete process.env.HOMEPATH
  })

  it("should get home directory [from process.env.USERPROFIL]", async () => {
    const proxy = proxyquire("../../app", {
      os: {
        homedir: sinon.stub().returns(undefined)
      },
    })

    process.env.USERPROFIL = "/home/test"

    const app: App = new proxy.App();
    const homeDir = app.getHomeDir();

    expect(homeDir).to.eq("/home/test")

    delete process.env.USERPROFIL
  })

  it("should fail to get home directory", async () => {
    const homedirStub = sinon.stub().returns(undefined);
    const proxy = proxyquire("../../app", {
      os: {
        homedir: homedirStub
      },
    })

    const app: App = new proxy.App();
    try {
      app.getHomeDir();
    } catch (err) {
      assert.isDefined(err);
    }

    assert.isTrue(homedirStub.calledOnce)
  })

  it("should setup app", async () => {
    const proxy = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper() {
          return {
            configDirExists: sinon.stub().resolves(true),
          }
        },
        GitHelper: function GitHelper() {
          return {}
        },
        ProjectHelper: function ProjectHelper() {
          return {}
        }
      },
    })

    const app: App = new proxy.App();

    sinon.stub(app, "getHomeDir").returns("/home/test");
    sinon.stub(app, "initCommander").resolves()
    sinon.stub(app, "isConfigFileValid").resolves(true)

    await app.setup()
  })

  it("should setup app without config directory", async () => {
    const proxy = proxyquire("../../app", {
      inquirer: {
        prompt: sinon.stub().resolves({
          setup: true,
        } as IInitAnswers),
      },
      "./helper": {
        FileHelper: function FileHelper() {
          return {
            configDirExists: sinon.stub().resolves(false),
          }
        },
        GitHelper: function GitHelper() {
          return {}
        },
        ProjectHelper: function ProjectHelper() {
          return {}
        },
        LogHelper: LogHelper
      },
    })

    const app: App = new proxy.App();

    sinon.stub(app, "getHomeDir").returns("/home/test");
    sinon.stub(app, "initCommander").resolves()
    const initConfigDirStub: SinonInspectable = sinon.stub(app, "initConfigDir").resolves()

    await app.setup()

    assert.isTrue(initConfigDirStub.calledOnce);
  })

  it("should exit app due to no setup config directory", async () => {
    const exitStub: SinonInspectable = sinon.stub(process, "exit");
    const proxy = proxyquire("../../app", {
      inquirer: {
        prompt: sinon.stub().resolves({
          setup: false,
        } as IInitAnswers),
      },
      "./helper": {
        FileHelper: function FileHelper() {
          return {
            configDirExists: sinon.stub().resolves(false),
          }
        },
        GitHelper: function GitHelper() {
          return {}
        },
        ProjectHelper: function ProjectHelper() {
          return {}
        },
        LogHelper: LogHelper
      },
    })

    const app: App = new proxy.App();

    sinon.stub(app, "getHomeDir").returns("/home/test");
    sinon.stub(app, "initCommander").resolves()

    await app.setup()

    assert.isTrue(exitStub.calledWith(0))
    exitStub.restore();
  })

  it("should pull repo due to already set up config directory", async () => {
    const pullStub: SinonInspectable = sinon.stub().resolves();
    const proxy = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper() {
          return {
            configDirExists: sinon.stub().resolves(true),
          }
        },
        GitHelper: function GitHelper() {
          return {
            pullRepo: pullStub
          }
        },
        ProjectHelper: function ProjectHelper() {
          return {}
        },
        LogHelper: LogHelper
      },
    })

    const app: App = new proxy.App();

    sinon.stub(app, "isConfigFileValid").resolves(true)

    // Has to be called to have all helper instantiated
    await app.setup()
    await app.initConfigDir()

    assert.isTrue(pullStub.calledOnce)
  })

  it("should exit app due to invalid config file", async () => {
    const exitStub: SinonInspectable = sinon.stub(process, "exit");
    const proxy = proxyquire("../../app", {
      "./helper": {
        FileHelper: function FileHelper() {
          return {
            configDirExists: sinon.stub().resolves(true),
          }
        },
        GitHelper: function GitHelper() {
          return {}
        },
        ProjectHelper: function ProjectHelper() {
          return {}
        },
        LogHelper: LogHelper
      },
    })

    const app: App = new proxy.App();

    sinon.stub(app, "isConfigFileValid").resolves(false)

    // Has to be called to have all helper instantiated
    await app.setup()
    await app.initConfigDir()

    assert.isTrue(exitStub.calledWith(1))
    exitStub.restore();
  })
});
