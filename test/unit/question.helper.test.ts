import { assert, expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import { QuestionHelper } from "../../helper";
import { IJiraLink, IProject, IRecord } from "../../interfaces";

describe("QuestionHelper", () => {
  it("should validate number", async () => {
    assert.isTrue(QuestionHelper.validateNumber("1337"));
    assert.isTrue(QuestionHelper.validateNumber("1.234"));
    assert.isTrue(QuestionHelper.validateNumber(69));
    assert.isTrue(QuestionHelper.validateNumber(5, 5, 5));
    assert.isTrue(QuestionHelper.validateNumber("5", 5, 5));

    assert.isFalse(QuestionHelper.validateNumber("asdf"));
    assert.isFalse(QuestionHelper.validateNumber("7..5"));
    assert.isFalse(QuestionHelper.validateNumber(3, 4, 5));
    assert.isFalse(QuestionHelper.validateNumber(6, 4, 5));
  });

  it("should validate year", async () => {
    assert.isTrue(QuestionHelper.validateYear("1337"));
    assert.isTrue(QuestionHelper.validateYear(1337));

    assert.isString(QuestionHelper.validateYear("asdf"));
  });

  it("should validate month", async () => {
    assert.isTrue(QuestionHelper.validateMonth("06"));
    assert.isTrue(QuestionHelper.validateMonth(6));

    assert.isString(QuestionHelper.validateMonth(69));
  });

  it("should validate day", async () => {
    assert.isTrue(QuestionHelper.validateDay("06"));
    assert.isTrue(QuestionHelper.validateDay(6));

    assert.isString(QuestionHelper.validateDay(69));
  });

  it("should validate hour", async () => {
    assert.isTrue(QuestionHelper.validateHour("06"));
    assert.isTrue(QuestionHelper.validateHour(6));

    assert.isString(QuestionHelper.validateHour(69));
  });

  it("should validate minute", async () => {
    assert.isTrue(QuestionHelper.validateMinute("06"));
    assert.isTrue(QuestionHelper.validateMinute(6));

    assert.isString(QuestionHelper.validateMinute(69));
  });

  it("should validate amount", async () => {
    assert.isTrue(QuestionHelper.validateAmount("06"));
    assert.isTrue(QuestionHelper.validateAmount(6));

    assert.isString(QuestionHelper.validateAmount("asdf"));
  });

  it("should validate git url", async () => {
    assert.isTrue(QuestionHelper.validateGitUrl("ssh://git@github.com:10022/company/project.git"));
    assert.isTrue(QuestionHelper.validateGitUrl("https://github.com:443/company/project.git"));
    assert.isTrue(QuestionHelper.validateGitUrl("http://github.com:80/company/project.git"));

    assert.isString(QuestionHelper.validateGitUrl("http://github.com/company/project.git"));
  });

  it("should validate jira endpoint", async () => {
    assert.isTrue(QuestionHelper.validateJiraEndpoint("http://test.com"));
    assert.isTrue(QuestionHelper.validateJiraEndpoint("https://test.com"));
    // TODO improve regex, this is not a valid url
    assert.isTrue(QuestionHelper.validateJiraEndpoint("https://a"));

    assert.isString(QuestionHelper.validateJiraEndpoint("ssh://"));
  });

  it("should validate jira key", async () => {
    assert.isTrue(QuestionHelper.validateJiraKey("MOCKED"));

    assert.isString(QuestionHelper.validateJiraKey("M"));
  });

  it("should filter jira endpoint", async () => {
    expect(QuestionHelper.filterJiraEndpoint("http://test.com")).to.eq("http://test.com/");
    expect(QuestionHelper.filterJiraEndpoint("http://test.com/")).to.eq("http://test.com/");
  });

  describe("Validate file", () => {
    it("should validate file", async () => {
      const proxy: any = proxyquire("../../helper/question", {
        fs: {
          accessSync: sinon.stub().returns(true),
          statSync: sinon.stub()
            .returns({
              isFile: true,
            }),
        },
      });
      assert.isTrue(proxy.QuestionHelper.validateFile("/tmp/mocked"));
    });

    it("should fail to validate file [path is number]", async () => {
      const proxy: any = proxyquire("../../helper/question", {
        fs: {
          accessSync: sinon.stub().returns(true),
          statSync: sinon.stub()
            .returns({
              isFile: true,
            }),
        },
      });
      assert.isFalse(proxy.QuestionHelper.validateFile(1337));
    });

    it("should fail to validate file [file not readable]", async () => {
      const proxy: any = proxyquire("../../helper/question", {
        fs: {
          accessSync: sinon.stub().throws(new Error("File is not readable")),
          statSync: sinon.stub()
            .returns({
              isFile: true,
            }),
        },
      });
      assert.isFalse(proxy.QuestionHelper.validateFile("/tmp/mocked"));
    });
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
          endpoint: "http://mocked.com/endpoint/",
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

    expect(choice.endpoint).to.eq("http://mocked.com/endpoint/");
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
