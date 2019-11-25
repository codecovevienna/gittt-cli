import { assert, expect } from "chai";
import { Command, CommanderStatic } from "commander";
import moment from "moment";
import proxyquire from "proxyquire";
import { DefaultLogFields } from "simple-git/typings/response";
import sinon, { SinonSpy, SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper/index";
import { IConfigFile, IInitAnswers, IJiraLink, IJiraPublishResult, IProject, IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";
import { emptyHelper } from "../helper";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("App", () => {
  before(() => {
    proxyquire.noCallThru();
  });
  describe("General", () => {
    it("should create instance", async () => {
      const app: App = new App();
      expect(app).to.be.instanceOf(App);
    });

    it("should start app", async () => {
      const parseStub: SinonSpy = sinon.spy();

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

    it("should start app and show help [unknown command]", async () => {
      const helpStub: SinonSpy = sinon.spy();

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

    it("should exit without error", async () => {
      const exitStub: SinonStub = sinon.stub(process, "exit");
      const warnStub: SinonStub = sinon.stub(LogHelper, "warn");

      const proxy: any = proxyquire("../../app", {});

      const app: App = new proxy.App();
      app.exit("Mock", 0);

      assert.isTrue(exitStub.calledWith(0));
      assert.isTrue(warnStub.calledWith("Mock"));

      exitStub.restore();
      warnStub.restore();
    });

    it("should exit with error", async () => {
      const exitStub: SinonStub = sinon.stub(process, "exit");
      const errorStub: SinonStub = sinon.stub(LogHelper, "error");

      const proxy: any = proxyquire("../../app", {});

      const app: App = new proxy.App();
      app.exit("Mock", 1337);

      assert.isTrue(exitStub.calledWith(1337));
      assert.isTrue(errorStub.calledWith("Mock"));

      exitStub.restore();
      errorStub.restore();
    });
  });

  describe("Setup", () => {
    it("should setup app", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = async (): Promise<boolean> => {
          return true;
        }
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper
      });
      // tslint:enable

      const app: App = new proxy.App();

      sinon.stub(app, "initCommander").resolves();

      await app.setup();
    });

    it("should setup app without config directory", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = async (): Promise<boolean> => {
          return false;
        }
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: true,
          } as IInitAnswers),
        },
      });
      // tslint:enable

      const app: App = new proxy.App();

      sinon.stub(app, "initCommander").resolves();
      const initConfigDirStub: SinonStub = sinon.stub(app, "initConfigDir").resolves();

      await app.setup();

      assert.isTrue(initConfigDirStub.calledOnce);
    });

    it("should exit app due to no setup config directory", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const exitStub: SinonStub = sinon.stub(process, "exit");

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = async (): Promise<boolean> => {
          return false;
        }
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: false,
          } as IInitAnswers),
        },
      });
      // tslint:enable

      const app: App = new proxy.App();

      sinon.stub(app, "initCommander").resolves();

      await app.setup();

      assert.isTrue(exitStub.calledWith(0));

      exitStub.restore();
    });

    it("should pull repo due to already set up config directory", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const pullStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = async (): Promise<boolean> => {
          return true;
        }
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      mockedHelper.GitHelper = class {
        public pullRepo = pullStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: false,
          } as IInitAnswers),
        },
      });
      // tslint:enable

      const app: App = new proxy.App();

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(pullStub.calledOnce);
    });

    it("should exit app due to invalid config file", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const exitStub: SinonStub = sinon.stub(process, "exit");

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub()
          .onCall(0).resolves(true)
          .onCall(1).resolves(true)

        public isConfigFileValid = sinon.stub()
          // Hack to overcome setup call
          .onCall(0).resolves(true)
          .onCall(1).resolves(false);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: false,
          } as IInitAnswers),
        },
      });
      // tslint:enable

      const app: App = new proxy.App();

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(exitStub.calledWith(1));

      exitStub.restore();
    });

    it("should initialize config directory from scratch", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const initRepoStub: SinonStub = sinon.stub().resolves();
      const pullRepoStub: SinonStub = sinon.stub().resolves();
      const createDirStub: SinonStub = sinon.stub().resolves();
      const initConfigFileStub: SinonStub = sinon.stub().resolves();
      const commitChangesStub: SinonStub = sinon.stub().resolves();
      const pushChangesStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub()
          .onCall(0).resolves(true)
          .onCall(1).resolves(false)
        public isConfigFileValid = sinon.stub()
          // Hack to overcome setup call
          .onCall(0).resolves(true)
          .onCall(1).resolves(false);
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

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: false,
          } as IInitAnswers),
        },
      });
      // tslint:enable

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

    it("should initialize config directory and pull", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const pullStub: SinonStub = sinon.stub().resolves();
      const createDirStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().onCall(0)
          .resolves(true)
          .resolves(false)
        public isConfigFileValid = sinon.stub().resolves(true);
        public createConfigDir = createDirStub
      }

      mockedHelper.GitHelper = class {
        public pullRepo = pullStub
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: false,
          } as IInitAnswers),
        },
      });
      // tslint:enable

      const app: App = new proxy.App();

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(createDirStub.calledOnce);
      assert.isTrue(pullStub.calledOnce);
    });
  });

  describe("Filter records", () => {
    it("should filter records by year", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2012).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            year: "2012",
          }),
        },
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByYear(mockedRecords);

      expect(filtered.length).to.eq(1);
      expect(filtered[0]).to.deep.eq(mockedRecords[0]);
    });

    it("should filter records by year [same year]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByYear(mockedRecords);

      expect(filtered).to.deep.eq(mockedRecords);
    });

    it("should filter records by month", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            month: "January",
          }),
        },
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByMonth(mockedRecords);

      expect(filtered.length).to.eq(1);
      expect(filtered[0]).to.deep.eq(mockedRecords[0]);
    });

    it("should filter records by month [same month]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(0).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByMonth(mockedRecords);

      expect(filtered).to.deep.eq(mockedRecords);
    });

    it("should filter records by day", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).date(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(0).date(2).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "inquirer": {
          prompt: sinon.stub().resolves({
            day: "01",
          }),
        },
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByDay(mockedRecords);

      expect(filtered.length).to.eq(1);
      expect(filtered[0]).to.deep.eq(mockedRecords[0]);
    });

    it("should filter records by day [same day]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).date(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(0).date(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByDay(mockedRecords);

      expect(filtered).to.deep.eq(mockedRecords);
    });
  });

  describe("Edit records", () => {
    it("should edit specific record", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      } as IProject);
      const commitChangesStub: SinonStub = sinon.stub().resolves();
      const saveProjectObjectStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
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
      // tslint:enable

      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "filterRecordsByYear").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByMonth").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByDay").resolves(mockedRecords);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
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

    it("should fail to edit specific record [unable to get project by name]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub: SinonStub = sinon.stub().resolves(undefined);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to edit specific record [unable to get project from filesystem]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves(undefined);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to edit specific record [no records]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: [],
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
        public getProjectFromGit = getProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should edit specific record with arguments", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });
      const commitChangesStub: SinonStub = sinon.stub().resolves();
      const saveProjectObjectStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
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
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
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

    it("should fail to edit specific record with arguments [unknown guid]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443, repo
        },
        name: "mocked",
        records: mockedRecords,
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
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

    it("should fail to edit specific record with arguments [no guid]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 3;
      mockedCommand.type = RECORD_TYPES.Time;

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [no amount]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
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
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.guid = "mocked-guid";
      mockedCommand.type = RECORD_TYPES.Time;

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [no type]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 420;
      mockedCommand.guid = "mocked-guid";

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to disable interactive mode
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });
  });

  describe("Remove records", () => {
    it("should remove specific record", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });
      const commitChangesStub: SinonStub = sinon.stub().resolves();
      const saveProjectObjectStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
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
      // tslint:enable

      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "filterRecordsByYear").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByMonth").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByDay").resolves(mockedRecords);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records.length).to.eq(0);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to remove specific record [unable to get project from git]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().throws(new Error("Mocked Error"));

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to remove specific record [unable to get project from filesystem]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves(undefined);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should fail to remove specific record [no records]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [];

      const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getOrAskForProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });

    it("should remove specific record with arguments", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });
      const commitChangesStub: SinonStub = sinon.stub().resolves();
      const saveProjectObjectStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
        public saveProjectObject = saveProjectObjectStub;
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
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
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

    it("should fail to remove specific record with arguments [no guid]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to remove specific record with arguments [unknown guid]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
        records: mockedRecords,
      });

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectByName = getProjectByNameStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.guid = "unknown-guid";

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectByNameStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);

      exitStub.restore();
    });
  });

  describe("Add records", () => {
    it("should not add record [no cmd amount]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(false);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should not add record [invalid number]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(false);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = "invalid";

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should not add record [no cmd type]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
      }

      mockedHelper.ValidationHelper = class {
        public static validateNumber = sinon.stub().returns(true);
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 69;

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should add record to project [message is null]", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const getProjectByNameStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);
      const addRecordToProjectStub: SinonStub = sinon.stub().resolves();

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
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
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
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

    it("should add record to the past", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      const addRecordToProjectStub: SinonStub = sinon.stub().resolves();
      const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().resolves(
        {
          meta: {
            host: "",
            port: 0,
          },
          name: "mocked",
          records: [],
        } as IProject
      );

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
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
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(addRecordToProjectStub.calledOnce);
    });

    describe("Import records from csv", () => {
      it("should add records from csv", async () => {
        const mockedHelper: any = Object.assign({}, emptyHelper);

        const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().returns({
          meta: {
            host: "test.git.com",
            port: 443,
          },
          name: "mocked",
        } as IProject);
        const addRecordsToProjectStub: SinonStub = sinon.stub().resolves();

        // tslint:disable
        mockedHelper.FileHelper = class {
          public static isFile = sinon.stub().returns(true);
          public static getHomeDir = sinon.stub().returns("/home/test");
          public configDirExists = sinon.stub().resolves(true);
          public isConfigFileValid = sinon.stub().resolves(true);
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
        // tslint:enable

        const mockedApp: App = new proxy.App();

        await mockedApp.setup();

        const mockedCommand: string = "mockedFile.csv";
        const mockedOptions: any[] = [{ project: "not existing" }];

        // Mock arguments array to enable interactive mode
        process.argv = ["1", "2", "3", "4"];

        await mockedApp.importCsv(mockedCommand, mockedOptions);

        assert.isTrue(addRecordsToProjectStub.calledOnce);
      });
    });

    describe("Links", () => {
      describe("Jira", () => {
        it("should add new JIRA link", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const mockedCommander: CommanderStatic = proxyquire("commander", {});

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addOrUpdateLinkStub: SinonStub = sinon.stub().resolves();

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public addOrUpdateLink = addOrUpdateLinkStub;
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
            public getProjectByName = getProjectByNameStub;
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          await mockedApp.linkAction(new Command());

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
        });

        it("should fail to add new JIRA link [no git directory]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const mockedCommander: CommanderStatic = proxyquire("commander", {});

          const getProjectByNameStub: SinonStub = sinon.stub().returns(undefined);

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
            public getProjectByName = getProjectByNameStub;
          }

          mockedHelper.QuestionHelper = class {
            public static chooseIntegration = sinon.stub().resolves("Jira");
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "commander": mockedCommander,
          });
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.linkAction(new Command());

          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });

        it("should fail to add new JIRA link [error while adding]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);
          const mockedCommander: CommanderStatic = proxyquire("commander", {});

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const addOrUpdateLinkStub: SinonStub = sinon.stub().throws(new Error("Mocked Error"));

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public addOrUpdateLink = addOrUpdateLinkStub;
          }

          mockedHelper.ProjectHelper = class {
            public addLink = sinon.stub().resolves();
            public getProjectByName = getProjectByNameStub;
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.linkAction(new Command());

          assert.isTrue(addOrUpdateLinkStub.calledOnce);
          assert.isTrue(exitStub.calledOnce);

          exitStub.restore();
        });

        it("should publish records to Jira endpoint", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [
              {
                endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should publish records to Jira endpoint [create link beforehand]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub()
            .onCall(0).returns({
              created: 1234,
              gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
              links: [],
            } as IConfigFile)
            .onCall(1).returns({
              created: 1234,
              gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
              links: [
                {
                  endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                  hash: "1234asdf",
                  key: "TEST",
                  linkType: "Jira",
                  projectName: "mocked_project_1",
                  username: "test",
                } as IJiraLink,
              ],
            } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
          }

          mockedHelper.ProjectHelper = class {
            public getProjectByName = getProjectByNameStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
            "inquirer": {
              prompt: sinon.stub().resolves({
                confirm: true,
              }),
            },
          });
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const linkActionStub: SinonStub = sinon.stub(mockedApp, "linkAction");

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(linkActionStub.calledOnce);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should publish records to Jira endpoint [with local changes]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [
              {
                endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const logChangesStub: SinonStub = sinon.stub().resolves([
            {
              author_email: "mockedEmail",
              author_name: "mockedAuthor",
              body: "mockedBody",
              date: "mockedDate",
              hash: "mockedHash",
              message: "mockedMessage",
              refs: "mockedRefs",
            } as DefaultLogFields,
          ]);
          const pushChangesStub: SinonStub = sinon.stub().resolves();
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = logChangesStub;
            public pushChanges = pushChangesStub;
          }

          mockedHelper.ProjectHelper = class {
            public getProjectByName = getProjectByNameStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
            "inquirer": {
              prompt: sinon.stub().resolves({
                push: true,
              }),
            },
          });
          // tslint:enable

          const mockedApp: App = new proxy.App();

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(pushChangesStub.called);
          assert.isTrue(axiosPostStub.calledOnce);
        });

        it("should fail to publish records to Jira endpoint [no pushing]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [
              {
                endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const logChangesStub: SinonStub = sinon.stub().resolves([
            {
              author_email: "mockedEmail",
              author_name: "mockedAuthor",
              body: "mockedBody",
              date: "mockedDate",
              hash: "mockedHash",
              message: "mockedMessage",
              refs: "mockedRefs",
            } as DefaultLogFields,
          ]);
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
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
            "inquirer": {
              prompt: sinon.stub().resolves({
                push: false,
              }),
            },
          });
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit").resolves();

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [no git directory]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns(undefined);
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [no link found]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [],
          } as IConfigFile);
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public getConfigObject = getConfigObjectStub;
          }

          mockedHelper.ProjectHelper = class {
            public getProjectByName = getProjectByNameStub;
          }

          const proxy: any = proxyquire("../../app", {
            "./helper": mockedHelper,
            "axios": {
              post: axiosPostStub,
            },
            "inquirer": {
              prompt: sinon.stub().resolves({
                confirm: false,
              }),
            },
          });
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [no project found]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [
              {
                endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves(undefined);
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [request fails]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [
              {
                endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const axiosPostStub: SinonStub = sinon.stub().throws(new Error("Mocked Error"));

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.calledOnce);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [unsuccessful response]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [
              {
                endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                linkType: "Jira",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: false,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.calledOnce);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });

        it("should fail to publish records to Jira endpoint [unknown link type]", async () => {
          const mockedHelper: any = Object.assign({}, emptyHelper);

          const getProjectByNameStub: SinonStub = sinon.stub().returns({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
          } as IProject);
          const getConfigObjectStub: SinonStub = sinon.stub().returns({
            created: 1234,
            gitRepo: "ssh://git@mocked.com:1337/mocked/test.git",
            links: [
              {
                endpoint: "http://jira.mocked.com:2990/jira/rest/gittt/latest/",
                hash: "1234asdf",
                key: "TEST",
                linkType: "UnknownType",
                projectName: "mocked_project_1",
                username: "test",
              } as IJiraLink,
            ],
          } as IConfigFile);
          const findProjectByNameStub: SinonStub = sinon.stub().resolves({
            meta: {
              host: "github.com",
              port: 443,
            },
            name: "mocked_project_1",
            records: [],
          });
          const axiosPostStub: SinonStub = sinon.stub().resolves({
            data: {
              success: true,
            } as IJiraPublishResult,
          });

          // tslint:disable
          mockedHelper.FileHelper = class {
            public static getHomeDir = sinon.stub().returns("/home/test");
            public configDirExists = sinon.stub().resolves(true);
            public isConfigFileValid = sinon.stub().resolves(true);
            public findProjectByName = findProjectByNameStub;
            public getConfigObject = getConfigObjectStub;
          }

          mockedHelper.GitHelper = class {
            public logChanges = sinon.stub().resolves([]);
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
          // tslint:enable

          const mockedApp: App = new proxy.App();

          const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

          await mockedApp.setup();

          await mockedApp.publishAction(new Command());

          assert.isTrue(axiosPostStub.notCalled);
          assert.isTrue(exitStub.called);

          exitStub.restore();
        });
      });
    });
  });
  describe("Report", () => {
    it.only("should output project overview", async () => {
      const mockedHelper: any = Object.assign({}, emptyHelper);
      const mockedCommander: CommanderStatic = proxyquire("commander", {});
      const mockedChartStub: SinonStub = sinon.stub();

      const getOrAskForProjectFromGitStub: SinonStub = sinon.stub().resolves({
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
      } as IProject);
      const findProjectByNameStub: SinonStub = sinon.stub().resolves(
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
      );

      // tslint:disable
      mockedHelper.FileHelper = class {
        public static getHomeDir = sinon.stub().returns("/home/test");
        public configDirExists = sinon.stub().resolves(true);
        public isConfigFileValid = sinon.stub().resolves(true);
        // public findAllProjects = findAllProjectsStub;
        public findProjectByName = findProjectByNameStub;
      }

      mockedHelper.ProjectHelper = class {
        public getProjectFromGit = sinon.stub().resolves({
          name: "mocked_project_1",
        });
        public getTotalHours = sinon.stub();
        public getOrAskForProjectFromGit = getOrAskForProjectFromGitStub;
      }

      mockedHelper.ChartHelper = class {
        public static chart = mockedChartStub;
      }

      const proxy: any = proxyquire("../../app", {
        "./helper": mockedHelper,
        "commander": mockedCommander,
      });
      // tslint:enable

      const mockedApp: App = new proxy.App();

      await mockedApp.setup();

      process.argv = ["namespace", "mocked", "report"];

      await mockedApp.reportAction(new Command());

      assert.isTrue(mockedChartStub.called);
    });
  });
});
