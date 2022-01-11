import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { QuestionHelper } from "../../helper";
import { IJiraLink, IProject, IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";
import { IMultipieInputLink } from '../../interfaces/index';
import { emptyHelper } from "../helper";

describe("QuestionHelper", function () {
  describe("Static", function () {
    it("should filter jira endpoint", async function () {
      expect(QuestionHelper.filterJiraEndpoint("http://test.com")).to.eq("http://test.com");
      expect(QuestionHelper.filterJiraEndpoint("http://test.com/")).to.eq("http://test.com");
    });
  });

  describe("Ask", function () {
    it("should ask for year", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "2012",
          }),
        },
      });

      const choice: number = await proxy.QuestionHelper.askYear();
      expect(choice).to.eq(2012);
    });

    it("should ask for month", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "1",
          }),
        },
      });

      const choice: number = await proxy.QuestionHelper.askMonth();
      expect(choice).to.eq(1);
    });

    it("should ask for day", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "1",
          }),
        },
      });

      const choice: number = await proxy.QuestionHelper.askDay();
      expect(choice).to.eq(1);
    });

    it("should ask for hour", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "1",
          }),
        },
      });

      const choice: number = await proxy.QuestionHelper.askHour();
      expect(choice).to.eq(1);
    });

    it("should ask for minute", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "1",
          }),
        },
      });

      const choice: number = await proxy.QuestionHelper.askMinute();
      expect(choice).to.eq(1);
    });

    it("should ask for amount", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "1",
          }),
        },
      });

      const choice: number = await proxy.QuestionHelper.askAmount();
      expect(choice).to.eq(1);
    });

    it("should ask for amount [with old amount]", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "1",
          }),
        },
      });

      const choice: number = await proxy.QuestionHelper.askAmount(2);
      expect(choice).to.eq(1);
    });

    it("should ask for message", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "message",
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.askMessage();
      expect(choice).to.eq("message");
    });

    it("should ask for message and get undefined", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "",
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.askMessage();
      expect(choice).to.be.undefined;
    });

    it("should ask for git url", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "ssh://git@github.com/company/project.git",
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.askGitUrl();
      expect(choice).to.eq("ssh://git@github.com/company/project.git");
    });

    describe("Jira", function () {
      it("should ask for jira link", async function () {
        const proxy: any = proxyquire("../../helper/question", {
          inquirer: {
            prompt: sinon.stub().resolves({
              host: "http://mocked.com",
              key: "MOCKED",
              password: "mocked",
              username: "mocked",
            }),
          },
        });

        const choice: IJiraLink = await proxy.QuestionHelper.askJiraLink({
          meta: {
            host: "mocked.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject);

        expect(choice.host).to.eq("http://mocked.com");
        expect(choice.endpoint).to.eq("/rest/gittt/latest/");
        expect(choice.key).to.eq("MOCKED");
        expect(choice.username).to.eq("mocked");
        expect(choice.hash).to.eq("bW9ja2VkOm1vY2tlZA==");
        expect(choice.linkType).to.eq("Jira");
        expect(choice.projectName).to.eq("mocked_project_1");
      });

      it("should ask for jira link with issue", async function () {
        const proxy: any = proxyquire("../../helper/question", {
          inquirer: {
            prompt: sinon.stub().resolves({
              host: "http://mocked.com",
              key: "MOCKED",
              issue: "EPIC-1",
              password: "mocked",
              username: "mocked",
            }),
          },
        });

        const choice: IJiraLink = await proxy.QuestionHelper.askJiraLink({
          meta: {
            host: "mocked.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject);

        expect(choice.host).to.eq("http://mocked.com");
        expect(choice.endpoint).to.eq("/rest/gittt/latest/");
        expect(choice.key).to.eq("MOCKED");
        expect(choice.issue).to.eq("EPIC-1");
        expect(choice.username).to.eq("mocked");
        expect(choice.hash).to.eq("bW9ja2VkOm1vY2tlZA==");
        expect(choice.linkType).to.eq("Jira");
        expect(choice.projectName).to.eq("mocked_project_1");
      });

      it("should ask for jira link with previous data", async function () {
        const proxy: any = proxyquire("../../helper/question", {
          inquirer: {
            prompt: sinon.stub().resolves({
              host: "http://mocked.com",
              key: "MOCKED",
              issue: "EPIC-1",
              username: "mocked",
            }),
          },
        });

        const choice: IJiraLink = await proxy.QuestionHelper.askJiraLink({
          meta: {
            host: "mocked.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject
          , {
            endpoint: "/rest/gittt/latest/",
            hash: "bW9ja2VkOm1vY2tlZA==",
            host: "http://mocked.com",
            issue: "EPIC-1",
            key: "MOCKED",
            linkType: "Jira",
            projectName: "mocked_project_1",
            username: "mocked"
          } as IJiraLink);

        expect(choice.host).to.eq("http://mocked.com");
        expect(choice.endpoint).to.eq("/rest/gittt/latest/");
        expect(choice.key).to.eq("MOCKED");
        expect(choice.issue).to.eq("EPIC-1");
        expect(choice.username).to.eq("mocked");
        expect(choice.hash).to.eq("bW9ja2VkOm1vY2tlZA==");
        expect(choice.linkType).to.eq("Jira");
        expect(choice.projectName).to.eq("mocked_project_1");
      });

      it("should ask for jira link [with endpoint version]", async function () {
        const proxy: any = proxyquire("../../helper/question", {
          inquirer: {
            prompt: sinon.stub().resolves({
              host: "http://mocked.com",
              key: "MOCKED",
              password: "mocked",
              username: "mocked",
            }),
          },
        });

        const choice: IJiraLink = await proxy.QuestionHelper.askJiraLink({
          meta: {
            host: "mocked.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject, undefined, "2.0.0");

        expect(choice.host).to.eq("http://mocked.com");
        expect(choice.endpoint).to.eq("/rest/gittt/2.0.0/");
        expect(choice.key).to.eq("MOCKED");
        expect(choice.username).to.eq("mocked");
        expect(choice.hash).to.eq("bW9ja2VkOm1vY2tlZA==");
        expect(choice.linkType).to.eq("Jira");
        expect(choice.projectName).to.eq("mocked_project_1");
      });
    });

    describe("Multipie", function () {
      it("should ask for multipie link", async function () {
        const proxy: any = proxyquire("../../helper/question", {
          inquirer: {
            prompt: sinon.stub().resolves({
              endpoint: "http://mocked.com/v1/publish",
              username: "mocked",
            }),
          },
        });

        const choice: IMultipieInputLink = await proxy.QuestionHelper.askMultipieLink({
          meta: {
            host: "mocked.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject);

        expect(choice.endpoint).to.eq("http://mocked.com/v1/publish");
        expect(choice.username).to.eq("mocked");
        expect(choice.linkType).to.eq("Multipie");
        expect(choice.projectName).to.eq("mocked_project_1");
      });

      it("should ask for multipie link with previous data", async function () {
        const proxy: any = proxyquire("../../helper/question", {
          inquirer: {
            prompt: sinon.stub().resolves({
              endpoint: "http://mocked.com/v1/publish",
              username: "mocked",
            }),
          },
        });

        const choice: IMultipieInputLink = await proxy.QuestionHelper.askMultipieLink({
          meta: {
            host: "mocked.com",
            port: 443,
          },
          name: "mocked_project_1",
        } as IProject
          , {
            endpoint: "http://mocked.com/v1/publish",
            linkType: "Multipie",
            projectName: "mocked_project_1",
            username: "mocked"
          } as IMultipieInputLink);

        expect(choice.endpoint).to.eq("http://mocked.com/v1/publish");
        expect(choice.username).to.eq("mocked");
        expect(choice.linkType).to.eq("Multipie");
        expect(choice.projectName).to.eq("mocked_project_1");
      });
    });
  });

  describe("Choose", function () {
    it("should choose record", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "mocked-guid-one",
          }),
        },
      });

      const mockedRecords: IRecord[] = [
        {
          amount: 69,
          created: 1234,
          guid: "mocked-guid-one",
          type: RECORD_TYPES.Time,
        } as IRecord,
        {
          amount: 1337,
          created: 1234,
          guid: "mocked-guid-two",
          type: RECORD_TYPES.Time,
        } as IRecord,
      ];

      const choice: string = await proxy.QuestionHelper.chooseRecord(mockedRecords);
      expect(choice).to.deep.eq(mockedRecords[0]);
    });

    it("should choose type", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: RECORD_TYPES.Time,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.chooseType();
      expect(choice).to.eq(RECORD_TYPES.Time);
    });

    it("should choose type [with old type]", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: RECORD_TYPES.Time,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.chooseType(RECORD_TYPES.Time);
      expect(choice).to.eq(RECORD_TYPES.Time);
    });

    it("should choose role", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.MultipieHelper = class {
        public getValidRoles = sinon.stub().resolves([{ name: '?', value: '?' }]);
      }

      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: '?',
          }),
        },
        ".": mockedHelper,
      });

      const choice: string = await proxy.QuestionHelper.chooseRole();
      expect(choice).to.eq('?');
    });

    it("should choose role [with old role]", async function () {
      const mockedHelper: any = Object.assign({}, emptyHelper);

      mockedHelper.MultipieHelper = class {
        public getValidRoles = sinon.stub().resolves([{ name: '?', value: '?' }]);
      }

      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: 'asdf',
          }),
        },
        ".": mockedHelper,
      });

      const choice: string = await proxy.QuestionHelper.chooseRole('asdf');
      expect(choice).to.eq('asdf');
    });

    it("should choose integration", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "Jira",
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.chooseIntegration();
      expect(choice).to.eq("Jira");
    });

    it("should choose domain", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "github.com",
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.chooseDomain([
        "gitlab.com",
        "github.com",
      ]);
      expect(choice).to.eq("github.com");
    });

    it("should choose project file", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "gitlab_com_443/codecovevienna_gittt-cli.json",
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.chooseProjectFile([
        {
          meta: {
            host: "github.com",
            port: 10022,
          },
          name: "codecovevienna_gittt-cli",
          records: [],
        } as IProject,
        {
          meta: {
            host: "gitlab.com",
            port: 443,
          },
          name: "codecovevienna_gittt-cli",
          records: [],
        } as IProject,
      ]);
      expect(choice).to.eq("gitlab_com_443/codecovevienna_gittt-cli.json");
    });

    it("should choose override local changes", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: "0",
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.chooseOverrideLocalChanges();
      expect(choice).to.eq(0);
    });
  });

  describe("Confirm", function () {
    it("should confirm migration", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: true,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.confirmMigration();
      expect(choice).to.eq(true);
    });

    it("should confirm jira link creation", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: true,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.confirmLinkCreation();
      expect(choice).to.eq(true);
    });

    it("should confirm pushing of local changes", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: true,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.confirmPushLocalChanges();
      expect(choice).to.eq(true);
    });

    it("should confirm setup", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: true,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.confirmSetup();
      expect(choice).to.eq(true);
    });

    it("should confirm init", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: true,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.confirmInit();
      expect(choice).to.eq(true);
    });

    it("should confirm ticket number", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            choice: true,
          }),
        },
      });

      const choice: string = await proxy.QuestionHelper.confirmTicketNumber("1337");
      expect(choice).to.eq(true);
    });
  });
});
