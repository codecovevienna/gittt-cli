import { assert, expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { QuestionHelper } from "../../helper";
import { IJiraLink, IProject, IRecord } from "../../interfaces";

describe("QuestionHelper", () => {
  it("should filter jira endpoint", async () => {
    expect(QuestionHelper.filterJiraEndpoint("http://test.com")).to.eq("http://test.com/");
    expect(QuestionHelper.filterJiraEndpoint("http://test.com/")).to.eq("http://test.com/");
  });

  it("should ask for year", async () => {
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

  it("should ask for month", async () => {
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

  it("should ask for day", async () => {
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

  it("should ask for hour", async () => {
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

  it("should ask for minute", async () => {
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

  it("should ask for amount", async () => {
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

  it("should ask for amount [with old amount]", async () => {
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

  it("should ask for message", async () => {
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

  it("should ask for git url", async () => {
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

  it("should ask for jira link", async () => {
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

  it("should choose record", async () => {
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
        type: "Time",
      } as IRecord,
      {
        amount: 1337,
        created: 1234,
        guid: "mocked-guid-two",
        type: "Time",
      } as IRecord,
    ];

    const choice: string = await proxy.QuestionHelper.chooseRecord(mockedRecords);
    expect(choice).to.deep.eq(mockedRecords[0]);
  });

  it("should choose type", async () => {
    const proxy: any = proxyquire("../../helper/question", {
      inquirer: {
        prompt: sinon.stub().resolves({
          choice: "Time",
        }),
      },
    });

    const choice: string = await proxy.QuestionHelper.chooseType();
    expect(choice).to.eq("Time");
  });

  it("should choose type [with old type]", async () => {
    const proxy: any = proxyquire("../../helper/question", {
      inquirer: {
        prompt: sinon.stub().resolves({
          choice: "Time",
        }),
      },
    });

    const choice: string = await proxy.QuestionHelper.chooseType("Time");
    expect(choice).to.eq("Time");
  });

  it("should choose integration", async () => {
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

  it("should choose domain", async () => {
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

  it("should choose project file", async () => {
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

  it("should confirm migration", async () => {
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
