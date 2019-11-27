import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { QuestionHelper } from "../../helper";
import { IJiraLink, IProject, IRecord } from "../../interfaces";
import { RECORD_TYPES } from "../../types";

describe("QuestionHelper", function () {
  describe("Static", function () {
    it.only("should filter jira endpoint", async function () {
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

    it("should ask for jira link", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            host: "http://mocked.com/",
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

      expect(choice.endpoint).to.eq("http://mocked.com/rest/gittt/latest/");
      expect(choice.key).to.eq("MOCKED");
      expect(choice.username).to.eq("mocked");
      expect(choice.hash).to.eq("bW9ja2VkOm1vY2tlZA==");
      expect(choice.linkType).to.eq("Jira");
      expect(choice.projectName).to.eq("mocked_project_1");
    });

    it.only("should ask for jira link with issue", async function () {
      const proxy: any = proxyquire("../../helper/question", {
        inquirer: {
          prompt: sinon.stub().resolves({
            host: "http://mocked.com/",
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

      expect(choice.endpoint).to.eq("http://mocked.com/rest/gittt/latest/");
      expect(choice.key).to.eq("MOCKED");
      expect(choice.issue).to.eq("EPIC-1");
      expect(choice.username).to.eq("mocked");
      expect(choice.hash).to.eq("bW9ja2VkOm1vY2tlZA==");
      expect(choice.linkType).to.eq("Jira");
      expect(choice.projectName).to.eq("mocked_project_1");
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
  });
});
