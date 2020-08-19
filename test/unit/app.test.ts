import { assert, expect } from "chai";
import commander, { Command, CommanderStatic } from "commander";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper/index";
import { IJiraLink, IJiraPublishResult, IProject, IRecord, IMultipieLink, IMultipiePublishResult } from "../../interfaces";
import { RECORD_TYPES } from "../../types";
import { emptyHelper } from "../helper";
import { DefaultLogFields } from "simple-git";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("App", function () {
  before(function () {
    proxyquire.noCallThru();
  });
  describe("General", function () {
    it("should create instance", async function () {
      const app: App = new App();
      expect(app).to.be.instanceOf(App);
    });

    it("should start app", async function () {
      const parseStub = sinon.spy();

      const proxy: any = proxyquire("../../app", {
        commander: {
          parse: parseStub,
        },
      });

      process.argv = [
        "ts-node",
        "app.ts",
        "list",
      ];

      const app: App = new proxy.App();
      app.start();

      assert.isTrue(parseStub.calledOnce);
    });

    it("should start app and show help [unknown command]", async function () {
      const helpStub = sinon.spy();

      const proxy: any = proxyquire("../../app", {
        commander: {
          help: helpStub,
        },
      });

      process.argv = [
        "mocked",
        "unknownCommand",
      ];

      const app: App = new proxy.App();
      app.start();

      assert.isTrue(helpStub.calledOnce);
    });

    it("should exit without error", async function () {
      const exitStub = sinon.stub(process, "exit");
      const warnStub = sinon.stub(LogHelper, "warn");

      const proxy: any = proxyquire("../../app", {});

      const app: App = new proxy.App();
      app.exit("Mock", 0);

      assert.isTrue(exitStub.calledWith(0));
      assert.isTrue(warnStub.calledWith("Mock"));

      exitStub.restore();
      warnStub.restore();
    });

    it("should exit with error", async function () {
      const exitStub = sinon.stub(process, "exit");
      const errorStub = sinon.stub(LogHelper, "error");

      const proxy: any = proxyquire("../../app", {});

      const app: App = new proxy.App();
      app.exit("Mock", 1337);

      assert.isTrue(exitStub.calledWith(1337));
      assert.isTrue(errorStub.calledWith("Mock"));

      exitStub.restore();
      errorStub.restore();
    });
  });

  describe("Setup", function () {
    it("should setup app", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper
      });


      const app: App = new proxy.App();

      sinon.stub(app, "initCommander").resolves();

      await app.setup();
    });

    it("should setup app without config directory", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(false);
      }

      mockedHelper.QuestionHelper = class {
        public static confirmSetup = sinon.stub().resolves(true)
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const app: App = new proxy.App();

      sinon.stub(app, "initCommander").resolves();
      const initConfigDirStub = sinon.stub(app, "initConfigDir").resolves();

      await app.setup();

      assert.isTrue(initConfigDirStub.calledOnce);
    });

    it("should exit app due to no setup config directory", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const exitStub = sinon.stub(process, "exit");

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(false);
      }

      mockedHelper.QuestionHelper = class {
        public static confirmSetup = sinon.stub().resolves(false)
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const app: App = new proxy.App();

      sinon.stub(app, "initCommander").resolves();

      await app.setup();

      assert.isTrue(exitStub.calledWith(0));

      exitStub.restore();
    });

    it("should pull repo due to already set up config directory", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const pullStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.QuestionHelper = class {
        public static confirmSetup = sinon.stub().resolves(false)
      }

      mockedHelper.GitHelper = class {
        public pullRepo = pullStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });


      const app: App = new proxy.App();

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(pullStub.calledOnce);
    });

    it("should exit app due to invalid config file", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const exitStub = sinon.stub(process, "exit");

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true)

        public isConfigFileValid = sinon.stub().resolves(false)
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const app: App = new proxy.App();

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(exitStub.calledWith(1));

      exitStub.restore();
    });

    it("should initialize config directory from scratch", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const initRepoStub = sinon.stub().resolves();
      const pullRepoStub = sinon.stub().resolves();
      const createDirStub = sinon.stub().resolves();
      const initConfigFileStub = sinon.stub().resolves();
      const commitChangesStub = sinon.stub().resolves();
      const pushChangesStub = sinon.stub().resolves();


      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(false)
        public isConfigFileValid = sinon.stub().resolves(false)
        public createConfigDir = createDirStub
        public initConfigFile = initConfigFileStub
      }

      mockedHelper.GitHelper = class {
        public commitChanges = commitChangesStub
        public initRepo = initRepoStub
        public pullRepo = pullRepoStub
        public pushChanges = pushChangesStub
      }
      mockedHelper.QuestionHelper = class {
        public static askGitUrl = sinon.stub().resolves("ssh://git@mocked.git.com/mock/test.git")
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const app: App = new proxy.App();

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(createDirStub.calledOnce);
      assert.isTrue(initRepoStub.calledOnce);
      assert.isTrue(pullRepoStub.calledOnce);
      assert.isTrue(initConfigFileStub.calledOnce);
      assert.isTrue(commitChangesStub.calledOnce);
      assert.isTrue(pushChangesStub.calledOnce);
    });

    it("should initialize config directory and pull", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const pullStub = sinon.stub().resolves();
      const createDirStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(false)
        public isConfigFileValid = sinon.stub().resolves(true);
        public createConfigDir = createDirStub
      }

      mockedHelper.GitHelper = class {
        public pullRepo = pullStub
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const app: App = new proxy.App();

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(createDirStub.calledOnce);
      assert.isTrue(pullStub.calledOnce);
    });
  });

  describe("Init", function () {
    it("should init current git repository", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const initProjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ProjectHelper = class {
        public initProject = initProjectStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.QuestionHelper = class {
        public static confirmInit = sinon.stub().resolves(true)
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      await mockedApp.initAction();

      assert.isTrue(initProjectStub.calledOnce);
    })

    it("should fail to init current git repository [canceled]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const initProjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public initProject = initProjectStub;
      }

      mockedHelper.QuestionHelper = class {
        public static confirmInit = sinon.stub().resolves(false)
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();
      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      await mockedApp.initAction();

      assert.isTrue(exitStub.calledOnce);
      exitStub.restore();
    })

    it("should fail to init current git repository [initProject throws]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const initProjectStub = sinon.stub().throws(new Error("mocked"));

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public initProject = initProjectStub;
      }

      mockedHelper.QuestionHelper = class {
        public static confirmInit = sinon.stub().resolves(true)
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();
      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      await mockedApp.initAction();

      assert.isTrue(exitStub.calledOnce);
      exitStub.restore();
    })
  })

  describe("Edit records", function () {
    it("should edit specific record", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getOrAskForProjectFromGitStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      } as IProject);
      const commitChangesStub = sinon.stub().resolves();
      const saveProjectObjectStub = sinon.stub().resolves();


      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.RecordHelper = class {
        public static filterRecordsByYear = sinon.stub().resolves(mockedRecords)
        public static filterRecordsByMonth = sinon.stub().resolves(mockedRecords)
        public static filterRecordsByDay = sinon.stub().resolves(mockedRecords)
      }

      mockedHelper.GitHelper = class {
        public commitChanges = commitChangesStub;
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.QuestionHelper = class {
        public static askAmount = sinon.stub().resolves(69);
        public static askDay = sinon.stub().resolves(24);
        public static askHour = sinon.stub().resolves(13);
        public static askMessage = sinon.stub().resolves("Mocked message");
        public static askMinute = sinon.stub().resolves(37);
        public static askMonth = sinon.stub().resolves(24);
        public static askYear = sinon.stub().resolves(2019);
        public static chooseRecord = sinon.stub().resolves(mockedRecords[0]);
        public static chooseType = sinon.stub().resolves("Time");
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 69;
      mockedCommand.guid = "mocked-guid";
      mockedCommand.type = RECORD_TYPES.Time;

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records[0].amount).to.eq(mockedCommand.amount);
      assert.isTrue(commitChangesStub.calledOnce);

      // getOrAskForProjectFromGitStub.restore();
    });

    it("should fail to edit specific record [unable to get project from git]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().resolves(undefined);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to edit specific record [unable to get project from filesystem]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves(undefined);


      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to edit specific record [no records]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: [],
      });


      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
        public getProjectFromGit = getProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should edit specific record with arguments", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });
      const commitChangesStub = sinon.stub().resolves();
      const saveProjectObjectStub = sinon.stub().resolves();


      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.GitHelper = class {
        public commitChanges = commitChangesStub;
      }
      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }
      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 69;
      mockedCommand.guid = "mocked-guid";
      mockedCommand.type = RECORD_TYPES.Time;

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records[0].amount).to.eq(mockedCommand.amount);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [unknown guid]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 69;
      mockedCommand.guid = "unknown-guid";
      mockedCommand.type = RECORD_TYPES.Time;

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to edit specific record with arguments [no guid]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 3;
      mockedCommand.type = RECORD_TYPES.Time;

      const helpStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [no amount]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }
      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(false);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.guid = "mocked-guid";
      mockedCommand.type = RECORD_TYPES.Time;

      const helpStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [no type]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 420;
      mockedCommand.guid = "mocked-guid";

      const helpStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [throws]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().throws(new Error("Mocked"));
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(exitStub.calledOnce);
    });
  });

  describe("Remove records", function () {
    it("should remove specific record", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getOrAskForProjectFromGitStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });
      const commitChangesStub = sinon.stub().resolves();
      const saveProjectObjectStub = sinon.stub().resolves();


      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.RecordHelper = class {
        public static filterRecordsByYear = sinon.stub().resolves(mockedRecords)
        public static filterRecordsByMonth = sinon.stub().resolves(mockedRecords)
        public static filterRecordsByDay = sinon.stub().resolves(mockedRecords)
      }

      mockedHelper.GitHelper = class {
        public commitChanges = commitChangesStub;
      }
      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.QuestionHelper = class {
        public static chooseRecord = sinon.stub().resolves(mockedRecords[0]);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records.length).to.eq(0);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to remove specific record [unable to get project from git]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub = sinon.stub().throws(new Error("Mocked Error"));

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });


      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to remove specific record [unable to get project from filesystem]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves(undefined);


      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to remove specific record [no records]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [];

      const getOrAskForProjectFromGitStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should remove specific record with arguments", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });
      const commitChangesStub = sinon.stub().resolves();
      const saveProjectObjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.GitHelper = class {
        public commitChanges = commitChangesStub;
      }
      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.guid = "mocked-guid";

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records.length).to.eq(0);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to remove specific record with arguments [no guid]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      const helpStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to remove specific record with arguments [unknown guid]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.guid = "unknown-guid";

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to remove specific record with arguments [throws]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().throws(new Error("Mocked"));
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(exitStub.calledOnce);
    });
  });

  describe("Commit", function () {
    it("should commit hours", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordStub = sinon.stub().resolves();

      const getProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public addRecordToProject = addRecordStub;
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const dateStub = sinon.stub(Date, "now").returns(123456789);

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 1337

      process.argv = ["namespace", "mocked", "commit", "-a", "1337"];

      await mockedApp.commitAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(addRecordStub.calledWith({
        amount: 1337,
        end: 123456789,
        message: `Committed 1337 hours to mocked`,
        type: RECORD_TYPES.Time,
      }));

      dateStub.restore();
    });

    it("should commit hours [interactive]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordStub = sinon.stub().resolves();

      const getOrAskForProjectFromGitStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public addRecordToProject = addRecordStub;
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.QuestionHelper = class {
        public static askAmount = sinon.stub().resolves(1337);
        public static askMessage = sinon.stub().resolves("");
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const dateStub = sinon.stub(Date, "now").returns(123456789);

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      process.argv = ["namespace", "mocked", "commit"];

      await mockedApp.commitAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(addRecordStub.calledWith({
        amount: 1337,
        end: 123456789,
        message: `Committed 1337 hours to mocked`,
        type: RECORD_TYPES.Time,
      }));

      dateStub.restore();
    });

    it("should commit hours [with custom message]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordStub = sinon.stub().resolves();

      const getProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public addRecordToProject = addRecordStub;
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const dateStub = sinon.stub(Date, "now").returns(123456789);

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 1337;
      mockedCommand.message = "custom";

      process.argv = ["namespace", "mocked", "commit", "-a", "1337", "-m", "custom"];

      await mockedApp.commitAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(addRecordStub.calledWith({
        amount: 1337,
        end: 123456789,
        message: "custom",
        type: RECORD_TYPES.Time,
      }));

      dateStub.restore();
    });

    it("should fail to commit hours [amount NaN]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const getProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = "noNumber";

      process.argv = ["namespace", "mocked", "commit", "-a", "noNumber"];

      await mockedApp.commitAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to commit hours [no project]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const getProjectByNameStub = sinon.stub().resolves(undefined);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 1337;
      mockedCommand.project = "unknown";

      process.argv = ["namespace", "mocked", "commit", "-a", "1337", "-p", "unknown"];

      await mockedApp.commitAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to commit hours [throws]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().throws(new Error("Mocked"));
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.commitAction(mockedCommand);

      assert.isTrue(exitStub.calledOnce);
    });
  })

  describe("Add records", function () {
    it("should not add record [no cmd amount]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(false);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      const helpStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should not add record [invalid number]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(false);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = "invalid";

      const helpStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should not add record [no cmd type]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 69;

      const helpStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should add record to project [message is null]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const addRecordToProjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public addRecordToProject = addRecordToProjectStub;
        public getProjectByName = getProjectByNameStub;
      }

      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.amount = 2;
      mockedCommand.type = RECORD_TYPES.Time;
      mockedCommand.year = 2019;
      mockedCommand.month = 5;
      mockedCommand.day = 12;
      mockedCommand.hour = 12;
      mockedCommand.minute = 0;
      mockedCommand.message = null;

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.called);
      assert.isTrue(addRecordToProjectStub.calledOnce);
    });

    it("should add record to the past", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordToProjectStub = sinon.stub().resolves();
      const getOrAskForProjectFromGitStub = sinon.stub().resolves(
        {
          meta: {
            host: "",
            port: 0,
          },
          name: "mocked",
          records: [],
        } as IProject,
      );

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public addRecordToProject = addRecordToProjectStub;
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.QuestionHelper = class {
        public static askAmount = sinon.stub().resolves(1.234);
        public static askDay = sinon.stub().resolves(24);
        public static askHour = sinon.stub().resolves(13);
        public static askMessage = sinon.stub().resolves("Mocked message");
        public static askMinute = sinon.stub().resolves(37);
        public static askMonth = sinon.stub().resolves(24);
        public static askYear = sinon.stub().resolves(2019);
        public static chooseType = sinon.stub().resolves("Time");
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(addRecordToProjectStub.calledOnce);
    });

  });

  describe("Import records from csv", function () {
    it("should add records from csv", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordsToProjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static isFile = sinon.stub().returns(true);
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ImportHelper = class {
        public importCsv = sinon.stub().resolves([
          {
            amount: 1337,
            end: Date.now(),
            guid: "g-u-i-d",
            message: "Mocked record",
            type: "Time",
          },
        ] as IRecord[]);
      }

      const getProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.ProjectHelper = class {
        public addRecordsToProject = addRecordsToProjectStub;
        public getProjectByName = getProjectByNameStub;
      }

      mockedHelper.ValidationHelper = class {
        public static validateFile = sinon.stub().returns(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.importCsv(mockedCommand.file, mockedCommand);

      assert.isTrue(addRecordsToProjectStub.calledOnce);
    });

    it("should filter duplicates and add records from csv", async function () {
      const now = Date.now();
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordsToProjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static isFile = sinon.stub().returns(true);
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ImportHelper = class {
        public importCsv = sinon.stub().resolves([
          {
            amount: 1337,
            end: now,
            message: "Mocked record",
            type: "Time",
          },
          {
            amount: 1337,
            end: now,
            message: "Mocked record",
            type: "Time",
          },
          {
            amount: 1337,
            end: now,
            message: "Mocked record",
            type: "Time",
          },
        ] as IRecord[]);
      }

      const getProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.ProjectHelper = class {
        public addRecordsToProject = addRecordsToProjectStub;
        public getProjectByName = getProjectByNameStub;
      }

      mockedHelper.ValidationHelper = class {
        public static validateFile = sinon.stub().returns(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.importCsv(mockedCommand.file, mockedCommand);

      assert.isTrue(addRecordsToProjectStub.calledOnceWithExactly([
        {
          amount: 1337,
          end: now,
          message: "Mocked record",
          type: "Time",
        }
      ],
        {
          meta: {
            host: "test.git.com",
            port: 443,
          },
          name: "mocked",
        },
        true,
        false
      ));
    });

    it("should add records from csv [interactive]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordsToProjectStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static isFile = sinon.stub().returns(true);
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ImportHelper = class {
        public importCsv = sinon.stub().resolves([
          {
            amount: 1337,
            end: Date.now(),
            guid: "g-u-i-d",
            message: "Mocked record",
            type: "Time",
          },
        ] as IRecord[]);
      }

      const getOrAskForProjectFromGitStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.ProjectHelper = class {
        public addRecordsToProject = addRecordsToProjectStub;
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.ValidationHelper = class {
        public static validateFile = sinon.stub().returns(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.importCsv(mockedCommand.file, mockedCommand);

      assert.isTrue(addRecordsToProjectStub.calledOnce);
    });

    it("should fail to add records from csv [file does not exist]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static isFile = sinon.stub().returns(true);
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateFile = sinon.stub().returns(false);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.importCsv(mockedCommand.file, mockedCommand);

      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to add records from csv [no valid git project]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static isFile = sinon.stub().returns(true);
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateFile = sinon.stub().returns(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = sinon.stub().returns(undefined);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.importCsv(mockedCommand.file, mockedCommand);

      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to add records from csv [getting git project throws]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.FileHelper = class {
        public static isFile = sinon.stub().returns(true);
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateFile = sinon.stub().returns(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = sinon.stub().throws(new Error("Mocked Error"));
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.importCsv(mockedCommand.file, mockedCommand);

      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to add records from csv [importCsv throws]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.FileHelper = class {
        public static isFile = sinon.stub().returns(true);
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateFile = sinon.stub().returns(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      mockedHelper.ImportHelper = class {
        public importCsv = sinon.stub().rejects(new Error("Mocked Error"));
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.importCsv(mockedCommand.file, mockedCommand);

      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });
  });

  describe("Links", function () {
    describe("General", function () {
      it("should fail to add new link [no git directory]", async function () {
        const mockedHelper: any = Object.assign({}, emptyHelper);
        const mockedCommander: CommanderStatic = proxyquire("commander", {});

        const getOrAskForProjectFromGitStub = sinon.stub().returns(undefined);

        mockedHelper.FileHelper = class {
          public static getHomeDir = sinon.stub().returns("/home/test");
        }

        mockedHelper.ConfigHelper = class {
          public isInitialized = sinon.stub().resolves(true);
        }

        mockedHelper.ProjectHelper = class {
          public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
        }

        const proxy: any = proxyquire("../../app", {
          "./helper": mockedHelper,
          "commander": mockedCommander,
        });

        const mockedApp: App = new proxy.App();

        const exitStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        const program = new commander.Command();
        const mockedCommand: commander.Command = program.createCommand();

        // Mock arguments array to enable interactive mode
        process.argv = ["1", "2", "3"];

        await mockedApp.linkAction(mockedCommand);

        assert.isTrue(exitStub.calledOnce);

        exitStub.restore();
      });

      it("should fail to add new link [unknown integration type]", async function () {
        const mockedHelper: any = Object.assign({}, emptyHelper);

        const getOrAskForProjectFromGitStub = sinon.stub().returns({
          meta: {
            host: "test.git.com",
            port: 443,
          },
          name: "mocked",
        } as IProject);

        mockedHelper.FileHelper = class {
          public static getHomeDir = sinon.stub().returns("/home/test");
        }

        mockedHelper.ConfigHelper = class {
          public isInitialized = sinon.stub().resolves(true);
          public findLinksByProject = sinon.stub().resolves([]);
        }

        mockedHelper.ProjectHelper = class {
          public addLink = sinon.stub().resolves();
        }

        mockedHelper.ProjectHelper = class {
          public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
        }

        mockedHelper.QuestionHelper = class {
          public static chooseIntegration = sinon.stub().resolves("UnknownIntegration");
        }

        const proxy: any = proxyquire("../../app", {
          "./helper": mockedHelper,
        });

        const mockedApp: App = new proxy.App();

        const exitStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        const program = new commander.Command();
        const mockedCommand: commander.Command = program.createCommand();

        // Mock arguments array to enable interactive mode
        process.argv = ["1", "2", "3"];

        await mockedApp.linkAction(mockedCommand);

        assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
        assert.isTrue(exitStub.calledOnce);

        exitStub.restore();
      });
    })
    describe("Jira", function () {
      describe("Add/Edit", function () {
        it("should add new JIRA link", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const addOrUpdateLinkStub = sinon.stub().resolves();

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked",
          } as IProject);
          const addRecordsToProjectStub = sinon.stub().resolves();

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = sinon.stub().resolves([]);
            public addOrUpdateLink = addOrUpdateLinkStub;
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
          }

          mockedHelper.ProjectHelper = class {
            public addRecordsToProject = addRecordsToProjectStub;
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.ValidationHelper = class {
            public static validateFile = sinon.stub().returns(true);
          }

          mockedHelper.QuestionHelper = class {
            public static askJiraLink = sinon.stub().resolves(
              {
                host: "http://mocked.com",
                endpoint: "/rest/gittt/latest/",
                hash: "shaHash",
                key: "MOCKED",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "mocked",
              } as IJiraLink
            );
            public static chooseIntegration = sinon.stub().resolves("Jira");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
        });

        it("should add new JIRA link [non interactive]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const addOrUpdateLinkStub = sinon.stub().resolves();

          const getProjectByNameStub = sinon.stub().returns({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addRecordsToProjectStub = sinon.stub().resolves();

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = sinon.stub().resolves([]);
            public addOrUpdateLink = addOrUpdateLinkStub;
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
          }

          mockedHelper.ProjectHelper = class {
            public addRecordsToProject = addRecordsToProjectStub;
            public getProjectByName = getProjectByNameStub;
          }

          mockedHelper.ValidationHelper = class {
            public static validateFile = sinon.stub().returns(true);
          }

          mockedHelper.QuestionHelper = class {
            public static askJiraLink = sinon.stub().resolves(
              {
                host: "http://mocked.com",
                endpoint: "/rest/gittt/latest/",
                hash: "shaHash",
                key: "MOCKED",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "mocked",
              } as IJiraLink
            );
            public static chooseIntegration = sinon.stub().resolves("Jira");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();
          mockedCommand.project = "mocked_project_1";

          // Mock arguments array to disable interactive mode
          process.argv = ["1", "2", "3", "4"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
        });

        it("should edit previous JIRA link", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const mockedCommander: CommanderStatic = proxyquire("commander", {});

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addOrUpdateLinkStub = sinon.stub().resolves();


          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public addOrUpdateLink = addOrUpdateLinkStub;
            public findLinksByProject = sinon.stub().resolves(
              [
                {
                  endpoint: "/rest/gittt/latest/",
                  hash: "bW9ja2VkOm1vY2tlZA==",
                  host: "http://github.com",
                  issue: "EPIC-1",
                  key: "MOCKED",
                  linkType: "Jira",
                  projectName: "mocked_project_1",
                  username: "mocked"
                } as IJiraLink
              ]
            );
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.QuestionHelper = class {
            public static askJiraLink = sinon.stub().resolves(
              {
                host: "http://mocked.com",
                endpoint: "/rest/gittt/latest/",
                hash: "shaHash",
                key: "MOCKED",
                linkType: "Jira",
                projectName: "mocked_,project_1",
                username: "mocked",
              } as IJiraLink
            );
            public static chooseIntegration = sinon.stub().resolves("Jira");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "commander": mockedCommander,
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
        });

        it("should fail to add new JIRA link [error while adding]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const mockedCommander: CommanderStatic = proxyquire("commander", {});

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addOrUpdateLinkStub = sinon.stub().throws(new Error("Mocked Error"));

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = sinon.stub().resolves([]);
            public addOrUpdateLink = addOrUpdateLinkStub;
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.QuestionHelper = class {
            public static askJiraLink = sinon.stub().resolves(
              {
                endpoint: "http://mocked.com/rest/gittt/latest/",
                hash: "shaHash",
                key: "MOCKED",
                linkType: "Jira",
                projectName: "mocked_,project_1",
                username: "mocked",
              } as IJiraLink
            );
            public static chooseIntegration = sinon.stub().resolves("Jira");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "commander": mockedCommander,
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });

        it("should fail to add new JIRA link [throws]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub = sinon.stub().throws(new Error("Mocked"));
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
          }

          mockedHelper.ProjectHelper = class {
            public getProjectByName = getProjectByNameStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit").resolves();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to disable interactive mode
          process.argv = ["1", "2", "3", "4"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(exitStub.calledOnce);
        });
      });
      describe("Publish", function () {
        it("should publish records to Jira endpoint", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns(
            [
              {
                host: "http://jira.mocked.com:2990",
                endpoint: "/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                issue: "",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          );
          const logChangesStub = sinon.stub().resolves([]);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should publish records to Jira endpoint [non interactive]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns(
            [
              {
                host: "http://jira.mocked.com:2990",
                endpoint: "/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                issue: "",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          );
          const logChangesStub = sinon.stub().resolves([]);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getProjectByName = getProjectByNameStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();
          mockedCommand.project = "mocked_project_1";

          // Mock arguments array to disable interactive mode
          process.argv = ["1", "2", "3", "4"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(getProjectByNameStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should publish records to Jira endpoint [with issue key]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns(
            [
              {
                host: "http://jira.mocked.com:2990",
                endpoint: "/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                issue: "ISSUE-1",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          );
          const logChangesStub = sinon.stub().resolves([]);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should publish records to Jira endpoint [create link beforehand]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub()
            .onCall(0).returns([])
            .onCall(1).returns([
              {
                host: "http://jira.mocked.com:2990",
                endpoint: "/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                issue: "",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ]);
          const confirmLinkCreationStub = sinon.stub().resolves(true);
          const logChangesStub = sinon.stub().resolves([]);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }
          mockedHelper.QuestionHelper = class {
            public static confirmLinkCreation = confirmLinkCreationStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();
          sinon.stub(mockedApp, "linkAction").resolves();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          // First: without link, second with link
          assert.isTrue(getOrAskForProjectFromGitStub.calledTwice);
          assert.isTrue(findLinksByProjectStub.calledTwice);

          assert.isTrue(logChangesStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should publish records to Jira endpoint [with local changes]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://jira.mocked.com:2990",
              endpoint: "/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "Jira",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]);
          const logChangesStub = sinon.stub().resolves([
            {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              author_email: "mockedEmail",
              // eslint-disable-next-line @typescript-eslint/naming-convention
              author_name: "mockedAuthor",
              body: "mockedBody",
              date: "mockedDate",
              hash: "mockedHash",
              message: "mockedMessage",
              refs: "mockedRefs",
            } as DefaultLogFields,
          ]);
          const confirmPushLocalChangesStub = sinon.stub().resolves(true);
          const pushChangesStub = sinon.stub().resolves();
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });


          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
            public pushChanges = pushChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.QuestionHelper = class {
            public static confirmPushLocalChanges = confirmPushLocalChangesStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(logChangesStub.calledOnce);
          assert.isTrue(confirmPushLocalChangesStub.calledOnce);
          assert.isTrue(pushChangesStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should fail to publish records to Jira endpoint [no pushing]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://jira.mocked.com:2990",
              endpoint: "/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "Jira",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]);
          const logChangesStub = sinon.stub().resolves([
            {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              author_email: "mockedEmail",
              // eslint-disable-next-line @typescript-eslint/naming-convention
              author_name: "mockedAuthor",
              body: "mockedBody",
              date: "mockedDate",
              hash: "mockedHash",
              message: "mockedMessage",
              refs: "mockedRefs",
            } as DefaultLogFields,
          ]);
          const confirmPushLocalChangesStub = sinon.stub().resolves(false);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.QuestionHelper = class {
            public static confirmPushLocalChanges = confirmPushLocalChangesStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit").resolves();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(logChangesStub.calledOnce);
          assert.isTrue(confirmPushLocalChangesStub.calledOnce);
          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [no git directory]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns(undefined);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [no project found]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().resolves(undefined);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://jira.mocked.com:2990",
              endpoint: "/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "Jira",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]
          );
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [no project found on disk]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().resolves(undefined);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://jira.mocked.com:2990",
              endpoint: "/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "Jira",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]
          );
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [request fails]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().resolves({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://jira.mocked.com:2990",
              endpoint: "/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "Jira",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]
          );
          const axiosPostStub = sinon.stub().throws(new Error("Mocked Error"));
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
          }
          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(axiosPostStub.calledOnce);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [unsuccessful response]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().resolves({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://jira.mocked.com:2990",
              endpoint: "/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "Jira",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: false,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
          }
          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(axiosPostStub.calledOnce);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [unknown link type]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().resolves({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://jira.mocked.com:2990",
              endpoint: "/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "UnknownType",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
          }
          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);
          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [link creation canceled]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([]);
          const confirmLinkCreationStub = sinon.stub().resolves(false);

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }
          mockedHelper.QuestionHelper = class {
            public static confirmLinkCreation = confirmLinkCreationStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
          });

          const mockedApp: App = new proxy.App();
          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [deprecated link config]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              endpoint: "http://jira.mocked.com:2990/rest/gittt/latest/",
              hash: "1234asdf",
              key: "TEST",
              issue: "",
              linkType: "Jira",
              projectName: "mocked_project_1",
              username: "test",
            } as IJiraLink,
          ]);
          const logChangesStub = sinon.stub().resolves([]);
          const axiosPostStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();
          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [throws]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub = sinon.stub().throws(new Error("Mocked"));
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
          }

          mockedHelper.ProjectHelper = class {
            public getProjectByName = getProjectByNameStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit").resolves();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to disable interactive mode
          process.argv = ["1", "2", "3", "4"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(exitStub.calledOnce);
        });
      });
    });

    describe("Multipie", function () {
      describe("Add/Edit", function () {
        it("should add new Multipie link", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const addOrUpdateLinkStub = sinon.stub().resolves();

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked",
          } as IProject);
          const addRecordsToProjectStub = sinon.stub().resolves();

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = sinon.stub().resolves([]);
            public addOrUpdateLink = addOrUpdateLinkStub;
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
          }

          mockedHelper.ProjectHelper = class {
            public addRecordsToProject = addRecordsToProjectStub;
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.ValidationHelper = class {
            public static validateFile = sinon.stub().returns(true);
          }

          mockedHelper.QuestionHelper = class {
            public static askMultipieLink = sinon.stub().resolves(
              {
                host: "http://mocked.com",
                endpoint: "/v1/publish",
                linkType: "Multipie",
                projectName: "mocked_project_1",
                username: "mocked",
              } as IJiraLink
            );
            public static chooseIntegration = sinon.stub().resolves("Multipie");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
        });

        it("should add new Multipie link [non interactive]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const addOrUpdateLinkStub = sinon.stub().resolves();

          const getProjectByNameStub = sinon.stub().returns({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addRecordsToProjectStub = sinon.stub().resolves();

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public addOrUpdateLink = addOrUpdateLinkStub;
            public findLinksByProject = sinon.stub().resolves([]);
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
            // public getProjectFromGit = getProjectFromGitStub;
          }

          mockedHelper.ProjectHelper = class {
            public addRecordsToProject = addRecordsToProjectStub;
            public getProjectByName = getProjectByNameStub;
          }

          mockedHelper.ValidationHelper = class {
            public static validateFile = sinon.stub().returns(true);
          }

          mockedHelper.QuestionHelper = class {
            public static askMultipieLink = sinon.stub().resolves(
              {
                host: "http://mocked.com",
                endpoint: "/v1/publish",
                linkType: "Multipie",
                projectName: "mocked_project_1",
                username: "mocked",
              } as IMultipieLink
            );
            public static chooseIntegration = sinon.stub().resolves("Multipie");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();
          mockedCommand.project = "mocked_project_1";

          // Mock arguments array to disable interactive mode
          process.argv = ["1", "2", "3", "4"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
        });

        it("should edit previous Multipie link", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const mockedCommander: CommanderStatic = proxyquire("commander", {});

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addOrUpdateLinkStub = sinon.stub().resolves();


          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public addOrUpdateLink = addOrUpdateLinkStub;
            public findLinksByProject = sinon.stub().resolves([
              {
                endpoint: "/v1/publish",
                host: "http://github.com",
                linkType: "Multipie",
                projectName: "mocked_project_1",
                username: "mocked"
              } as IMultipieLink
            ]
            );
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.QuestionHelper = class {
            public static askMultipieLink = sinon.stub().resolves(
              {
                host: "http://mocked.com",
                endpoint: "/v1/publish",
                linkType: "Multipie",
                projectName: "mocked_,project_1",
                username: "mocked",
              } as IMultipieLink
            );
            public static chooseIntegration = sinon.stub().resolves("Multipie");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "commander": mockedCommander,
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
        });

        it("should fail to add new Multipie link [error while adding]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const mockedCommander: CommanderStatic = proxyquire("commander", {});

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addOrUpdateLinkStub = sinon.stub().throws(new Error("Mocked Error"));

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public addOrUpdateLink = addOrUpdateLinkStub;
            public findLinksByProject = sinon.stub().resolves([]);
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          mockedHelper.QuestionHelper = class {
            public static askMultipieLink = sinon.stub().resolves(
              {
                host: "http://mocked.com",
                endpoint: "/v1/publish",
                linkType: "Multipie",
                projectName: "mocked_,project_1",
                username: "mocked",
              } as IMultipieLink
            );
            public static chooseIntegration = sinon.stub().resolves("Multipie");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "commander": mockedCommander,
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.linkAction(mockedCommand);

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });
      });

      describe("Publish", function () {
        it("should publish records to Multipie endpoint", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://multipie.mocked.com:2990",
              endpoint: "/v1/publish",
              linkType: "Multipie",
              projectName: "mocked_project_1",
              username: "test",
            } as IMultipieLink,
          ]);
          const logChangesStub = sinon.stub().resolves([]);
          const axiosPostStub = sinon.stub().resolves({
            status: 200,
            data: {
              success: true,
            } as IMultipiePublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should publish records to Multipie endpoint [non interactive]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://multipie.mocked.com:2990",
              endpoint: "/v1/publish",
              linkType: "Multipie",
              projectName: "mocked_project_1",
              username: "test",
            } as IMultipieLink,
          ]);
          const logChangesStub = sinon.stub().resolves([]);
          const axiosPostStub = sinon.stub().resolves({
            status: 201,
            data: {
              success: true,
            } as IMultipiePublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getProjectByName = getProjectByNameStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();
          mockedCommand.project = "mocked_project_1";

          // Mock arguments array to disable interactive mode
          process.argv = ["1", "2", "3", "4"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(findLinksByProjectStub.calledOnce);
          assert.isTrue(getProjectByNameStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });


        it("should fail to publish records to Multipie endpoint [request fails]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().resolves({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://multipie.mocked.com:2990",
              endpoint: "/v1/publish",
              linkType: "Multipie",
              projectName: "mocked_project_1",
              username: "test",
            } as IMultipieLink,
          ]);
          const findProjectByNameStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const axiosPostStub = sinon.stub().throws(new Error("Mocked Error"));
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
          }
          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(axiosPostStub.calledOnce);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Multipie endpoint [unsuccessful response]", async function () {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getOrAskForProjectFromGitStub = sinon.stub().resolves({
            meta: {
              host: "test.git.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const findLinksByProjectStub = sinon.stub().returns([
            {
              host: "http://multipie.mocked.com:2990",
              endpoint: "/v1/publish",
              linkType: "Multipie",
              projectName: "mocked_project_1",
              username: "test",
            } as IMultipieLink,
          ]);
          const findProjectByNameStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const axiosPostStub = sinon.stub().resolves({
            status: 500,
            data: {
              success: false,
            } as IMultipiePublishResult,
          });

          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
          }

          mockedHelper.ConfigHelper = class {
            public isInitialized = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public findLinksByProject = findLinksByProjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
          }
          mockedHelper.ProjectHelper = class {
            public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
          });

          const mockedApp: App = new proxy.App();

          const exitStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          const program = new commander.Command();
          const mockedCommand: commander.Command = program.createCommand();

          // Mock arguments array to enable interactive mode
          process.argv = ["1", "2", "3"];

          await mockedApp.publishAction(mockedCommand);

          assert.isTrue(axiosPostStub.calledOnce);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

      });
    });
  });

  describe("Report", function () {
    it("should show report of current project", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProjects: IProject[] = [
        {
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "mocked_project_1",
          records: [
            {
              amount: 1337,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
            {
              amount: 69,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
          ],
        } as IProject,
        {
          meta: {
            host: "gitlab.com",
            port: 443,
          },
          name: "mocked_project_2",
          records: [
            {
              amount: 1234,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
            {
              amount: 1970,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
          ],
        } as IProject,
      ];

      const getOrAskForProjectFromGitStub = sinon.stub().returns(mockedProjects[0]);
      const findAllProjectsStub = sinon.stub().resolves(mockedProjects);
      const chartStub = sinon.stub();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findAllProjects = findAllProjectsStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.ChartHelper = class {
        public static chart = chartStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.reportAction(new Command());

      // One for the day and one for the week report
      expect(chartStub.callCount).to.eq(2);
    });
    it("should not show report [project not found]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProjects: IProject[] = [
        {
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "mocked_project_1",
          records: [
            {
              amount: 1337,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
            {
              amount: 69,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
          ],
        } as IProject,
        {
          meta: {
            host: "gitlab.com",
            port: 443,
          },
          name: "mocked_project_2",
          records: [
            {
              amount: 1234,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
            {
              amount: 1970,
              created: Date.now(),
              message: "Mocked message",
              type: "Time",
            } as IRecord,
          ],
        } as IProject,
      ];

      const getOrAskForProjectFromGitStub = sinon.stub().resolves(undefined);
      const findAllProjectsStub = sinon.stub().resolves(mockedProjects);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findAllProjects = findAllProjectsStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();
      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.reportAction(new Command());

      // One for the day and one for the week report
      expect(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should not show report [throws]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub = sinon.stub().throws(new Error("Mocked"));
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      const exitStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const program = new commander.Command();
      const mockedCommand: commander.Command = program.createCommand();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.reportAction(mockedCommand);

      assert.isTrue(exitStub.calledOnce);
    });
  });

  describe("List", function () {
    it("should show list of records", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub = sinon.stub().resolves(
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
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.listAction(new Command());
    });

    it("should not show list of records [no git project]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub = sinon.stub().resolves(undefined);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();
      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.listAction(new Command());

      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should not show list of records [no project found]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub = sinon.stub().resolves();

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();
      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.listAction(new Command());

      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should not show list of records [no records found]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: [],
      } as IProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();
      const exitStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.listAction(new Command());

      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });
  });

  describe("Today", function () {
    it("should show list of records for today", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const findAllProjectsStub = sinon.stub().resolves(
        [
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked",
            records: [
              {
                amount: 2,
                created: 1572346125890,
                end: Date.now(),
                guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb8",
                message: "A mocked message",
                type: RECORD_TYPES.Time,
                updated: 1572346125890,
              },
              {
                amount: 2.5,
                created: 1571323193712,
                end: 0,
                guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600290",
                message: "Some other mocked message",
                type: RECORD_TYPES.Time,
                updated: 1571323193712,
              },
            ],
          },
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked2_project",
            records: [
              {
                amount: 2,
                created: 1572346125890,
                end: 0,
                guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb2",
                message: "A mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1572346125890,
              },
              {
                amount: 2.5,
                created: 1571323193712,
                end: Date.now(),
                guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600270",
                message: "Some other mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1571323193712,
              },
            ],
          },
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked2_project_long_long_long",
            records: [
              {
                amount: 2,
                created: 1572346125890,
                end: 0,
                guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb2",
                message: "A mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1572346125890,
              },
              {
                amount: 2.5,
                created: 1571323193712,
                end: Date.now(),
                guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600270",
                message: "Some other mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1571323193712,
              },
            ],
          },
        ]
      );
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findAllProjects = findAllProjectsStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.todayAction();
    });
  });

  describe("Info", function () {
    it("should show list of records for today", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub = sinon.stub().resolves(
        {
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "mocked",
          records: [
            {
              amount: 2,
              created: 1572346125890,
              end: Date.now(),
              guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb8",
              message: "A mocked message",
              type: RECORD_TYPES.Time,
              updated: 1572346125890,
            },
            {
              amount: 2.5,
              created: 1571323193712,
              end: 0,
              guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600290",
              message: "Some other mocked message",
              type: RECORD_TYPES.Time,
              updated: 1571323193712,
            },
          ],
        },
      )

      const findAllProjectsStub = sinon.stub().resolves(
        [
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked",
            records: [
              {
                amount: 2,
                created: 1572346125890,
                end: Date.now(),
                guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb8",
                message: "A mocked message",
                type: RECORD_TYPES.Time,
                updated: 1572346125890,
              },
              {
                amount: 2.5,
                created: 1571323193712,
                end: 0,
                guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600290",
                message: "Some other mocked message",
                type: RECORD_TYPES.Time,
                updated: 1571323193712,
              },
            ],
          },
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked2_project",
            records: [
              {
                amount: 2,
                created: 1572346125890,
                end: 0,
                guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb2",
                message: "A mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1572346125890,
              },
              {
                amount: 2.5,
                created: 1571323193712,
                end: Date.now(),
                guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600270",
                message: "Some other mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1571323193712,
              },
            ],
          },
          {
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked2_project_long_long_long",
            records: [
              {
                amount: 2,
                created: 1572346125890,
                end: 0,
                guid: "ae7b3220-fa39-11e9-88db-43b894e4ffb2",
                message: "A mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1572346125890,
              },
              {
                amount: 2.5,
                created: 1571323193712,
                end: Date.now(),
                guid: "fb63e700-f0eb-11e9-8ff9-cb2bf1600270",
                message: "Some other mocked message2",
                type: RECORD_TYPES.Time,
                updated: 1571323193712,
              },
            ],
          },
        ]
      );

      const findLinksByProjectStub = sinon.stub().resolves([
        {
          endpoint: "/endpoint",
          hash: "hash",
          host: "https://jira.com",
          issue: "MOCK",
          key: "mock",
          linkType: "Jira",
          projectName: "Name",
          username: "mock",
        } as IJiraLink,
        {
          endpoint: "/endpoint",
          host: "https://jira.com",
          username: "mock",
          linkType: "Multipie",
          projectName: "Name1",
        } as IMultipieLink,
      ]);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findAllProjects = findAllProjectsStub;
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub
        public getTotalHours = sinon.stub().resolves(69);
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
        public findLinksByProject = findLinksByProjectStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.infoAction(new Command());
    });
  });

  describe("Export", function () {
    it("should export records from all projects", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProjects: IProject[] = [
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
      ]

      const exportStub = sinon.stub().resolves();
      const findAllProjectsStub = sinon.stub().resolves(mockedProjects);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findAllProjects = findAllProjectsStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ExportHelper = class {
        public static export = exportStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.exportAction(new Command());

      assert.isTrue(exportStub.calledWith(undefined, undefined, undefined, mockedProjects))
    });

    it("should export records from a specific project", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProject: IProject = {
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
      }

      const exportStub = sinon.stub().resolves();
      const findProjectByNameStub = sinon.stub().resolves(mockedProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ExportHelper = class {
        public static export = exportStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      const cmd = new Command();
      cmd.project = "mocked_project"

      await mockedApp.exportAction(cmd);

      assert.isTrue(exportStub.calledWith(undefined, undefined, undefined, [mockedProject]))
    });

    it("should fail to export records from non existing project", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedProject = undefined;

      const exitStub = sinon.stub(process, "exit");
      const exportStub = sinon.stub().resolves();
      const findProjectByNameStub = sinon.stub().resolves(mockedProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ExportHelper = class {
        public static export = exportStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      // Mock arguments array to enable interactive mode
      // eslint-disable-next-line require-atomic-updates
      process.argv = ["1", "2", "3"];

      const cmd = new Command();
      cmd.project = "non_existing";

      await mockedApp.exportAction(cmd);

      assert.isTrue(exitStub.calledOnce)

      exitStub.restore();
    });
  });

  describe("Timer", function () {
    it("should stop time tracking", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const stopTimerStub = sinon.stub().resolves();

      const getOrAskForProjectFromGitStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
      }

      mockedHelper.ConfigHelper = class {
        public isInitialized = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.TimerHelper = class {
        public stopTimer = stopTimerStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      process.argv = ["namespace", "mocked", "stop", "-m", "mock"];

      await mockedApp.stopAction(new Command());

      assert.isTrue(stopTimerStub.calledOnce);
    });
  });
});
