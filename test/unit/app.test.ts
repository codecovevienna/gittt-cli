import { assert, expect } from "chai";
import { Command, CommanderStatic } from "commander";
import moment from "moment";
import proxyquire from "proxyquire";
import { DefaultLogFields } from "simple-git/typings/response";
import sinon, { SinonSpy, SinonStub } from "sinon";
import { App } from "../../app";
import { LogHelper } from "../../helper/index";
import {
  IConfigFile, IInitAnswers,
  IJiraLink, IJiraPublishResult, IProject, IRecord,
} from "../../interfaces";

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

  describe("Get home directory", () => {
    it("should get home directory [from os]", async () => {
      const proxy: any = proxyquire("../../app", {
        os: {
          homedir: sinon.stub().returns("/home/test"),
        },
      });

      const app: App = new proxy.App();
      const homeDir: string = app.getHomeDir();

      expect(homeDir).to.eq("/home/test");
    });

    it("should get home directory [from process.env.HOME]", async () => {
      const proxy: any = proxyquire("../../app", {
        os: {
          homedir: sinon.stub().returns(undefined),
        },
      });

      process.env.HOME = "/home/test";

      const app: App = new proxy.App();
      const homeDir: string = app.getHomeDir();

      expect(homeDir).to.eq("/home/test");

      delete process.env.HOME;
    });

    it("should get home directory [from process.env.HOMEPATH]", async () => {
      const proxy: any = proxyquire("../../app", {
        os: {
          homedir: sinon.stub().returns(undefined),
        },
      });

      process.env.HOMEPATH = "/home/test";

      const app: App = new proxy.App();
      const homeDir: string = app.getHomeDir();

      expect(homeDir).to.eq("/home/test");

      delete process.env.HOMEPATH;
    });

    it("should get home directory [from process.env.USERPROFIL]", async () => {
      const proxy: any = proxyquire("../../app", {
        os: {
          homedir: sinon.stub().returns(undefined),
        },
      });

      process.env.USERPROFIL = "/home/test";

      const app: App = new proxy.App();
      const homeDir: string = app.getHomeDir();

      expect(homeDir).to.eq("/home/test");

      delete process.env.USERPROFIL;
    });

    it("should fail to get home directory", async () => {
      const homedirStub: SinonStub = sinon.stub().returns(undefined);
      const proxy: any = proxyquire("../../app", {
        os: {
          homedir: homedirStub,
        },
      });

      const app: App = new proxy.App();
      try {
        app.getHomeDir();
      } catch (err) {
        assert.isDefined(err);
      }

      assert.isTrue(homedirStub.calledOnce);
    });
  });

  describe("Setup", () => {
    it("should setup app", async () => {
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
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });

      const app: App = new proxy.App();

      sinon.stub(app, "getHomeDir").returns("/home/test");
      sinon.stub(app, "initCommander").resolves();
      sinon.stub(app, "isConfigFileValid").resolves(true);

      await app.setup();
    });

    it("should setup app without config directory", async () => {
      const proxy: any = proxyquire("../../app", {

        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(false),
            };
          },
          GitHelper: function GitHelper(): any {
            return {};
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: true,
          } as IInitAnswers),
        },
      });

      const app: App = new proxy.App();

      sinon.stub(app, "getHomeDir").returns("/home/test");
      sinon.stub(app, "initCommander").resolves();
      const initConfigDirStub: SinonStub = sinon.stub(app, "initConfigDir").resolves();

      await app.setup();

      assert.isTrue(initConfigDirStub.calledOnce);
    });

    it("should exit app due to no setup config directory", async () => {
      const exitStub: SinonStub = sinon.stub(process, "exit");
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(false),
            };
          },
          GitHelper: function GitHelper(): any {
            return {};
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
        "inquirer": {
          prompt: sinon.stub().resolves({
            setup: false,
          } as IInitAnswers),
        },
      });

      const app: App = new proxy.App();

      sinon.stub(app, "getHomeDir").returns("/home/test");
      sinon.stub(app, "initCommander").resolves();

      await app.setup();

      assert.isTrue(exitStub.calledWith(0));
      exitStub.restore();
    });

    it("should pull repo due to already set up config directory", async () => {
      const pullStub: SinonStub = sinon.stub().resolves();
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
              pullRepo: pullStub,
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });

      const app: App = new proxy.App();

      sinon.stub(app, "isConfigFileValid").resolves(true);

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(pullStub.calledOnce);
    });

    it("should exit app due to invalid config file", async () => {
      const exitStub: SinonStub = sinon.stub(process, "exit");
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub()
                .onCall(0).resolves(true)
                .onCall(1).resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {};
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });

      const app: App = new proxy.App();

      sinon.stub(app, "getHomeDir").returns("/home/test");
      // Hack to overcome setup call
      sinon.stub(app, "isConfigFileValid")
        .onCall(0).resolves(true)
        .onCall(1).resolves(false);

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(exitStub.calledWith(1));
      exitStub.restore();
    });

    it("should initialize config directory from scratch", async () => {
      const initRepoStub: SinonStub = sinon.stub().resolves();
      const pullRepoStub: SinonStub = sinon.stub().resolves();
      const createDirStub: SinonStub = sinon.stub().resolves();
      const initConfigFileStub: SinonStub = sinon.stub().resolves();
      const commitChangesStub: SinonStub = sinon.stub().resolves();
      const pushChangesStub: SinonStub = sinon.stub().resolves();
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              // TODO remove this hack to get over setup()
              configDirExists: sinon.stub()
                .onCall(0).resolves(true)
                .onCall(1).resolves(false),
              createConfigDir: createDirStub,
              initConfigFile: initConfigFileStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
              commitChanges: commitChangesStub,
              initRepo: initRepoStub,
              pullRepo: pullRepoStub,
              pushChanges: pushChangesStub,
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          QuestionHelper: {
            askGitUrl: sinon.stub().resolves("ssh://git@mocked.git.com/mock/test.git"),
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });

      const app: App = new proxy.App();

      sinon.stub(app, "getHomeDir").returns("/home/test");
      // Hack to overcome setup call
      sinon.stub(app, "isConfigFileValid")
        .onCall(0).resolves(true)
        .onCall(1).resolves(false);

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
      const pullStub: SinonStub = sinon.stub().resolves();
      const createDirStub: SinonStub = sinon.stub().resolves();
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              // TODO remove this hack to get over setup()
              configDirExists: sinon.stub().onCall(0)
                .resolves(true)
                .resolves(false),
              createConfigDir: createDirStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
              pullRepo: pullStub,
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });

      const app: App = new proxy.App();

      sinon.stub(app, "isConfigFileValid").resolves(true);

      // Has to be called to have all helper instantiated
      await app.setup();
      await app.initConfigDir();

      assert.isTrue(createDirStub.calledOnce);
      assert.isTrue(pullStub.calledOnce);
    });
  });

  describe("Filter records", () => {
    it("should filter records by year", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2012).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
        "inquirer": {
          prompt: sinon.stub().resolves({
            year: "2012",
          }),
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByYear(mockedRecords);

      expect(filtered.length).to.eq(1);
      expect(filtered[0]).to.deep.eq(mockedRecords[0]);
    });

    it("should filter records by year [same year]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByYear(mockedRecords);

      expect(filtered).to.deep.eq(mockedRecords);
    });

    it("should filter records by month", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
        "inquirer": {
          prompt: sinon.stub().resolves({
            month: "January",
          }),
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByMonth(mockedRecords);

      expect(filtered.length).to.eq(1);
      expect(filtered[0]).to.deep.eq(mockedRecords[0]);
    });

    it("should filter records by month [same month]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(0).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByMonth(mockedRecords);

      expect(filtered).to.deep.eq(mockedRecords);
    });

    it("should filter records by day", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).date(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(0).date(2).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
        "inquirer": {
          prompt: sinon.stub().resolves({
            day: "01",
          }),
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByDay(mockedRecords);

      expect(filtered.length).to.eq(1);
      expect(filtered[0]).to.deep.eq(mockedRecords[0]);
    });

    it("should filter records by day [same day]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          end: moment().year(2019).month(0).date(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
        {
          amount: 1337,
          end: moment().year(2019).month(0).date(1).hours(0).minutes(0).seconds(0).unix() * 1000,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const filtered: IRecord[] = await mockedApp.filterRecordsByDay(mockedRecords);

      expect(filtered).to.deep.eq(mockedRecords);
    });

    // it("should choose one record", async () => {
    //   const mockedRecords: IRecord[] = [
    //     {
    //       amount: 69,
    //       created: 1234,
    //       guid: "mocked-guid-one",
    //       type: "Time",
    //     } as IRecord,
    //     {
    //       amount: 1337,
    //       created: 1234,
    //       guid: "mocked-guid-two",
    //       type: "Time",
    //     } as IRecord,
    //   ];

    //   const proxy: any = proxyquire("../../app", {
    //     "./helper": {
    //       FileHelper: function FileHelper(): any {
    //         return {
    //           configDirExists: sinon.stub().resolves(true),
    //         };
    //       },
    //       GitHelper: function GitHelper(): any {
    //         return {
    //         };
    //       },
    //       LogHelper,
    //       ProjectHelper: function ProjectHelper(): any {
    //         return {
    //         };
    //       },
    //       QuestionHelper: {
    //         chooseRecord: sinon.stub().resolves({
    //           choice: "mocked-guid-one",
    //         }),
    //       },
    //       TimerHelper: function TimerHelper(): any {
    //         return {};
    //       },
    //     },
    //     // "inquirer": {
    //     //   prompt: sinon.stub().resolves({
    //     //     choice: "mocked-guid-one",
    //     //   }),
    //     // },
    //   });
    //   const mockedApp: App = new proxy.App();

    //   sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    //   sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    //   await mockedApp.setup();

    //   const chosen: IRecord = await mockedApp.askRecord(mockedRecords);

    //   expect(chosen).to.deep.eq(mockedRecords[0]);
    // });

    // it("should ask for new amount", async () => {
    //   const proxy: any = proxyquire("../../app", {
    //     "./helper": {
    //       FileHelper: function FileHelper(): any {
    //         return {
    //           configDirExists: sinon.stub().resolves(true),
    //         };
    //       },
    //       GitHelper: function GitHelper(): any {
    //         return {
    //         };
    //       },
    //       LogHelper,
    //       ProjectHelper: function ProjectHelper(): any {
    //         return {
    //         };
    //       },
    //       TimerHelper: function TimerHelper(): any {
    //         return {};
    //       },
    //     },
    //     "askAmount": sinon.stub().resolves(4321),
    //     "inquirer": {
    //       prompt: sinon.stub().resolves({
    //         amount: 1234,
    //       }),
    //     },
    //   });
    //   const mockedApp: App = new proxy.App();

    //   sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    //   sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    //   await mockedApp.setup();

    //   const newAmount: number = await mockedApp.askNewAmount(4321);

    //   expect(newAmount).to.eq(1234);
    // });

    // it("should ask for new type", async () => {
    //   const proxy: any = proxyquire("../../app", {
    //     "./helper": {
    //       FileHelper: function FileHelper(): any {
    //         return {
    //           configDirExists: sinon.stub().resolves(true),
    //         };
    //       },
    //       GitHelper: function GitHelper(): any {
    //         return {
    //         };
    //       },
    //       LogHelper,
    //       ProjectHelper: function ProjectHelper(): any {
    //         return {
    //         };
    //       },
    //       TimerHelper: function TimerHelper(): any {
    //         return {};
    //       },
    //     },
    //     "inquirer": {
    //       prompt: sinon.stub().resolves({
    //         type: "Money",
    //       }),
    //     },
    //   });
    //   const mockedApp: App = new proxy.App();

    //   sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
    //   sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

    //   await mockedApp.setup();

    //   const newType: RECORD_TYPES = await mockedApp.askNewType("Time");

    //   expect(newType).to.eq("Money");
    // });
  });

  describe("Edit records", () => {
    it("should edit specific record", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
              saveProjectObject: saveProjectObjectStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
              commitChanges: commitChangesStub,
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          QuestionHelper: {
            askAmount: sinon.stub().resolves(69),
            askDay: sinon.stub().resolves(24),
            askHour: sinon.stub().resolves(13),
            askMessage: sinon.stub().resolves("Mocked message"),
            askMinute: sinon.stub().resolves(37),
            askMonth: sinon.stub().resolves(24),
            askYear: sinon.stub().resolves(2019),
            chooseRecord: sinon.stub().resolves(mockedRecords[0]),
            chooseType: sinon.stub().resolves("Time"),
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      sinon.stub(mockedApp, "filterRecordsByYear").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByMonth").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByDay").resolves(mockedRecords);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 69;
      mockedCommand.guid = "mocked-guid";
      mockedCommand.type = "Time";

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records[0].amount).to.eq(mockedCommand.amount);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to edit specific record [unable to get project from git]", async () => {
      const getProjectFromGitStub: SinonStub = sinon.stub().throws(new Error("Mocked Error"));

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });

    it("should fail to edit specific record [unable to get project from filesystem]", async () => {
      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      const findProjectByNameStub: SinonStub = sinon.stub().resolves(undefined);

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });

    it("should fail to edit specific record [no records]", async () => {
      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").returns();

      await mockedApp.setup();

      await mockedApp.editAction(new Command());

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });

    it("should edit specific record with arguments", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
              saveProjectObject: saveProjectObjectStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
              commitChanges: commitChangesStub,
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          ValidationHelper: {
            validateNumber: sinon.stub().returns(true),
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 69;
      mockedCommand.guid = "mocked-guid";
      mockedCommand.type = "Time";

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records[0].amount).to.eq(mockedCommand.amount);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [unknown guid]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 69;
      mockedCommand.guid = "unknown-guid";
      mockedCommand.type = "Time";

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [no guid]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 3;
      mockedCommand.type = "Time";

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [no amount]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          ValidationHelper: {
            validateNumber: sinon.stub().returns(false),
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.guid = "mocked-guid";
      mockedCommand.type = "Time";

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to edit specific record with arguments [no type]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 420;
      mockedCommand.guid = "mocked-guid";

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.editAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });
  });

  describe("Remove records", () => {
    it("should remove specific record", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
              saveProjectObject: saveProjectObjectStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
              commitChanges: commitChangesStub,
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          QuestionHelper: {
            chooseRecord: sinon.stub().resolves(mockedRecords[0]),
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      sinon.stub(mockedApp, "filterRecordsByYear").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByMonth").resolves(mockedRecords);
      sinon.stub(mockedApp, "filterRecordsByDay").resolves(mockedRecords);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records.length).to.eq(0);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to remove specific record [unable to get project from git]", async () => {
      const getProjectFromGitStub: SinonStub = sinon.stub().throws(new Error("Mocked Error"));

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
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });

    it("should fail to remove specific record [unable to get project from filesystem]", async () => {
      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
        meta: {
          host: "test.git.com",
          port: 443,
        },
        name: "mocked",
      } as IProject);

      const findProjectByNameStub: SinonStub = sinon.stub().resolves(undefined);

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {};
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });

    it("should fail to remove specific record [no records]", async () => {
      const mockedRecords: IRecord[] = [];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {};
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });

    it("should remove specific record with arguments", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
              saveProjectObject: saveProjectObjectStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
              commitChanges: commitChangesStub,
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.guid = "mocked-guid";

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(saveProjectObjectStub.calledOnce);
      expect(saveProjectObjectStub.args[0][0].records.length).to.eq(0);
      assert.isTrue(commitChangesStub.calledOnce);
    });

    it("should fail to remove specific record with arguments [no guid]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(helpStub.calledOnce);
    });

    it("should fail to remove specific record with arguments [unknown guid]", async () => {
      const mockedRecords: IRecord[] = [
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid",
          type: "Time",
        } as IRecord,
      ];

      const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              findProjectByName: findProjectByNameStub,
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              getProjectFromGit: getProjectFromGitStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      const exitStub: SinonStub = sinon.stub(mockedApp, "exit").resolves();

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.guid = "unknown-guid";

      // Mock arguments array to be greater than 3
      process.argv = ["1", "2", "3", "4"];

      await mockedApp.removeAction(mockedCommand);

      assert.isTrue(getProjectFromGitStub.calledOnce);
      assert.isTrue(findProjectByNameStub.calledOnce);
      assert.isTrue(exitStub.calledOnce);
    });
  });

  describe("Add records", () => {
    it("should not add record [no cmd amount]", async () => {

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
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          ValidationHelper: {
            validateNumber: sinon.stub().returns(false),
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should not add record [invalid number]", async () => {

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
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          ValidationHelper: {
            validateNumber: sinon.stub().returns(false),
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 69;

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should not add record [no cmd type]", async () => {

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
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {};
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          ValidationHelper: {
            validateNumber: sinon.stub().returns(true),
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 69;

      const helpStub: SinonStub = sinon.stub(mockedCommand, "help");

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(helpStub.calledOnce);
    });

    it("should add record to project [message is null]", async () => {
      const addRecordToProjectStub: SinonStub = sinon.stub().resolves();

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
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              addRecordToProject: addRecordToProjectStub,
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          ValidationHelper: {
            validateNumber: sinon.stub().returns(true),
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.amount = 2;
      mockedCommand.type = "Time";
      mockedCommand.year = 2019;
      mockedCommand.month = 5;
      mockedCommand.day = 12;
      mockedCommand.hour = 12;
      mockedCommand.minute = 0;
      mockedCommand.message = null;

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(addRecordToProjectStub.calledOnce);
    });

    it("should add record to the past", async () => {
      const addRecordToProjectStub: SinonStub = sinon.stub().resolves();

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
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              addRecordToProject: addRecordToProjectStub,
            };
          },
          QuestionHelper: {
            askAmount: sinon.stub().resolves(1.234),
            askDay: sinon.stub().resolves(24),
            askHour: sinon.stub().resolves(13),
            askMessage: sinon.stub().resolves("Mocked message"),
            askMinute: sinon.stub().resolves(37),
            askMonth: sinon.stub().resolves(24),
            askYear: sinon.stub().resolves(2019),
            chooseType: sinon.stub().resolves("Time"),
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.addAction(mockedCommand);

      assert.isTrue(addRecordToProjectStub.calledOnce);
    });

    it("should check if config file is valid", async () => {
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              getConfigObject: sinon.stub().resolves({
                created: 1234,
                gitRepo: "ssh://git@github.com:443/mocked/test.git",
              } as IConfigFile),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          parseProjectNameFromGitUrl: sinon.stub(),
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");

      // Mock isConfigFileValid to get over setup call
      const setupMock: SinonStub = sinon.stub(mockedApp, "isConfigFileValid").resolves(true);
      await mockedApp.setup();
      // Restore isConfigFileValid to test the function
      setupMock.restore();

      const valid: boolean = await mockedApp.isConfigFileValid();

      assert.isTrue(valid);
    });

    it("should fail to check config file [unable to get config object]", async () => {
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              getConfigObject: sinon.stub().throws(new Error("Mocked Error")),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");

      // Mock isConfigFileValid to get over setup call
      const setupMock: SinonStub = sinon.stub(mockedApp, "isConfigFileValid").resolves(true);
      await mockedApp.setup();
      // Restore isConfigFileValid to test the function
      setupMock.restore();

      const valid: boolean = await mockedApp.isConfigFileValid();

      assert.isFalse(valid);
    });

    it("should fail to check config file [unable to parse git url]", async () => {
      const proxy: any = proxyquire("../../app", {
        "./helper": {
          FileHelper: function FileHelper(): any {
            return {
              configDirExists: sinon.stub().resolves(true),
              getConfigObject: sinon.stub().resolves({
                created: 1234,
                gitRepo: "ssh://git@github.com:443/mocked/test.git",
              } as IConfigFile),
            };
          },
          GitHelper: function GitHelper(): any {
            return {
            };
          },
          ImportHelper: function ImportHelper(): any {
            return {};
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
            };
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
          parseProjectNameFromGitUrl: sinon.stub().throws(new Error("Mocked Error")),
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");

      // Mock isConfigFileValid to get over setup call
      const setupMock: SinonStub = sinon.stub(mockedApp, "isConfigFileValid").resolves(true);
      await mockedApp.setup();
      // Restore isConfigFileValid to test the function
      setupMock.restore();

      const valid: boolean = await mockedApp.isConfigFileValid();

      assert.isFalse(valid);
    });
  });

  describe("Import records from csv", () => {
    it("should add records from csv", async () => {
      const addRecordsToProjectStub: SinonStub = sinon.stub().resolves();

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
          ImportHelper: function ImportHelper(): any {
            return {
              importCsv: sinon.stub().resolves([
                {
                  amount: 1337,
                  end: Date.now(),
                  guid: "g-u-i-d",
                  message: "Mocked record",
                  type: "Time",
                },
              ] as IRecord[]),
            };
          },
          LogHelper,
          ProjectHelper: function ProjectHelper(): any {
            return {
              addRecordsToProject: addRecordsToProjectStub,
            };
          },
          QuestionHelper: {
            validateFile: sinon.stub().resolves("/path/mockedFile.csv"),
          },
          TimerHelper: function TimerHelper(): any {
            return {};
          },
        },
      });
      const mockedApp: App = new proxy.App();

      sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
      sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

      await mockedApp.setup();

      const mockedCommand: Command = new Command();
      mockedCommand.file = "mockedFile.csv";

      // Mock arguments array to enable interactive mode
      process.argv = ["1", "2", "3"];

      await mockedApp.importCsv(mockedCommand);

      assert.isTrue(addRecordsToProjectStub.calledOnce);
    });
  });

  describe("Links", () => {
    describe("Jira", () => {

      it("should add new JIRA link", async () => {
        const mockedCommander: CommanderStatic = proxyquire("commander", {});
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject);

        const addOrUpdateLinkStub: SinonStub = sinon.stub().resolves();

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                addOrUpdateLink: addOrUpdateLinkStub,
                configDirExists: sinon.stub().resolves(true),
              };
            },
            GitHelper: function GitHelper(): any {
              return {};
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                addLink: sinon.stub().resolves(),
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            QuestionHelper: {
              askJiraLink: sinon.stub().resolves({
                endpoint: "http://mocked.com/rest/gittt/latest/",
                hash: "shaHash",
                key: "MOCKED",
                linkType: "Jira",
                projectName: "mocked_,project_1",
                username: "mocked",
              } as IJiraLink),
              chooseIntegration: sinon.stub().resolves("Jira"),
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "commander": mockedCommander,
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        await mockedApp.setup();

        await mockedApp.linkAction(new Command());

        assert.isTrue(addOrUpdateLinkStub.calledOnce);
      });

      it("should fail to add new JIRA link [no git directory]", async () => {
        const mockedCommander: CommanderStatic = proxyquire("commander", {});
        const getProjectFromGitStub: SinonStub = sinon.stub().returns(undefined);

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
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                addLink: sinon.stub().resolves(),
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            QuestionHelper: {
              chooseIntegration: sinon.stub().resolves("Jira"),
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "commander": mockedCommander,
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.linkAction(new Command());

        assert.isTrue(exitStub.calledOnce);
      });

      it("should fail to add new JIRA link [error while adding]", async () => {
        const mockedCommander: CommanderStatic = proxyquire("commander", {});
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
          meta: {
            host: "github.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject);
        const addOrUpdateLinkStub: SinonStub = sinon.stub().throws(new Error("Mocked Error"));

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                addOrUpdateLink: addOrUpdateLinkStub,
                configDirExists: sinon.stub().resolves(true),
              };
            },
            GitHelper: function GitHelper(): any {
              return {};
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                addLink: sinon.stub().resolves(),
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            QuestionHelper: {
              askJiraLink: sinon.stub().resolves({
                endpoint: "http://mocked.com/rest/gittt/latest/",
                hash: "shaHash",
                key: "MOCKED",
                linkType: "Jira",
                projectName: "mocked_,project_1",
                username: "mocked",
              } as IJiraLink),
              chooseIntegration: sinon.stub().resolves("Jira"),
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "commander": mockedCommander,
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.linkAction(new Command());

        assert.isTrue(addOrUpdateLinkStub.calledOnce);
        assert.isTrue(exitStub.calledOnce);
      });

      it("should publish records to Jira endpoint", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {
                logChanges: sinon.stub().resolves([]),
              };
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.calledOnce);
      });

      it("should publish records to Jira endpoint [create link beforehand]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {
                logChanges: sinon.stub().resolves([]),
              };
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
          "inquirer": {
            prompt: sinon.stub().resolves({
              confirm: true,
            }),
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const linkActionStub: SinonStub = sinon.stub(mockedApp, "linkAction");

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(linkActionStub.calledOnce);
        assert.isTrue(axiosPostStub.calledOnce);
      });

      it("should publish records to Jira endpoint [with local changes]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const pushChangesStub: SinonStub = sinon.stub().resolves();

        const axiosPostStub: SinonStub = sinon.stub().resolves({
          data: {
            success: true,
          } as IJiraPublishResult,
        });

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {
                logChanges: sinon.stub().resolves([
                  {
                    author_email: "mockedEmail",
                    author_name: "mockedAuthor",
                    body: "mockedBody",
                    date: "mockedDate",
                    hash: "mockedHash",
                    message: "mockedMessage",
                    refs: "mockedRefs",
                  } as DefaultLogFields,
                ]),
                pushChanges: pushChangesStub,
              };
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
          "inquirer": {
            prompt: sinon.stub().resolves({
              push: true,
            }),
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(pushChangesStub.called);
        assert.isTrue(axiosPostStub.calledOnce);
      });

      it("should fail to publish records to Jira endpoint [no pushing]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {
                logChanges: sinon.stub().resolves([
                  {
                    author_email: "mockedEmail",
                    author_name: "mockedAuthor",
                    body: "mockedBody",
                    date: "mockedDate",
                    hash: "mockedHash",
                    message: "mockedMessage",
                    refs: "mockedRefs",
                  } as DefaultLogFields,
                ]),
              };
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
          "inquirer": {
            prompt: sinon.stub().resolves({
              push: false,
            }),
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit").resolves();

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.notCalled);
        assert.isTrue(exitStub.called);
      });

      it("should fail to publish records to Jira endpoint [no git directory]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns(undefined);

        const axiosPostStub: SinonStub = sinon.stub().resolves({
          data: {
            success: true,
          } as IJiraPublishResult,
        });

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
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.notCalled);
        assert.isTrue(exitStub.called);
      });

      it("should fail to publish records to Jira endpoint [no link found]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {};
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
          "inquirer": {
            prompt: sinon.stub().resolves({
              confirm: false,
            }),
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.notCalled);
        assert.isTrue(exitStub.called);
      });

      it("should fail to publish records to Jira endpoint [no project found]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {};
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.notCalled);
        assert.isTrue(exitStub.called);
      });

      it("should fail to publish records to Jira endpoint [request fails]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {
                logChanges: sinon.stub().resolves([]),
              };
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.calledOnce);
        assert.isTrue(exitStub.called);
      });

      it("should fail to publish records to Jira endpoint [unsuccessful response]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {
                logChanges: sinon.stub().resolves([]),
              };
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.calledOnce);
        assert.isTrue(exitStub.called);
      });

      it("should fail to publish records to Jira endpoint [unknown link type]", async () => {
        const getProjectFromGitStub: SinonStub = sinon.stub().returns({
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

        const proxy: any = proxyquire("../../app", {
          "./helper": {
            FileHelper: function FileHelper(): any {
              return {
                configDirExists: sinon.stub().resolves(true),
                findProjectByName: findProjectByNameStub,
                getConfigObject: getConfigObjectStub,
              };
            },
            GitHelper: function GitHelper(): any {
              return {
                logChanges: sinon.stub().resolves([]),
              };
            },
            ImportHelper: function ImportHelper(): any {
              return {};
            },
            LogHelper,
            ProjectHelper: function ProjectHelper(): any {
              return {
                getProjectFromGit: getProjectFromGitStub,
              };
            },
            TimerHelper: function TimerHelper(): any {
              return {};
            },
          },
          "axios": {
            post: axiosPostStub,
          },
        });

        const mockedApp: App = new proxy.App();

        sinon.stub(mockedApp, "getHomeDir").returns("/home/test");
        sinon.stub(mockedApp, "isConfigFileValid").resolves(true);

        const exitStub: SinonStub = sinon.stub(mockedApp, "exit");

        await mockedApp.setup();

        await mockedApp.publishAction(new Command());

        assert.isTrue(axiosPostStub.notCalled);
        assert.isTrue(exitStub.called);
      });
    });
  });

  // it("should ask for git url", async () => {
  //   const proxy: any = proxyquire("../../app", {
  //     inquirer: {
  //       prompt: sinon.stub().resolves({
  //         gitRepo: "ssh://git@mock.git.com/mock/test.git",
  //       } as IGitRepoAnswers),
  //     },
  //   });

  //   const app: App = new proxy.App();

  //   const repo: string = await app.askGitUrl();

  //   // TODO should test inquirer validation
  //   expect(repo).to.eq("ssh://git@mock.git.com/mock/test.git");
  // });
});
