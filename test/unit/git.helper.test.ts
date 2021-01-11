import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import { StatusResult } from "simple-git/promise";
import sinon from "sinon";
import { FileHelper, GitHelper, LogHelper } from "../../helper/";
import { LogResult, DefaultLogFields } from "simple-git";

const sandboxDir = "./sandbox";
const configDir: string = path.join(sandboxDir, ".git-time-tracker");
const configFileName = "config.json";
const timerFileName = "timer.json";
const projectsDir = "projects";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("GitHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should create instance", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {};
      },
    });

    const gitHelper: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    // type of proxy object is not GitHelper, so just check for definition
    assert.isDefined(gitHelper);
  });

  it("should log changes", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          log: (): LogResult => {
            return {
              all: [
                {
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  author_email: "mock@mail.com",
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  author_name: "mockAuthor",
                  body: "mockedBody",
                  date: Date.UTC.toString(),
                  hash: "mockedHash",
                  message: "mockMessage",
                  refs: "mockedRefs",
                },
              ],
              latest: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                author_email: "mock@mail.com",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                author_name: "mockAuthor",
                body: "mockedBody",
                date: Date.UTC.toString(),
                hash: "mockedHash",
                message: "mockMessage",
                refs: "mockedRefs",
              },
              total: 0,
            };
          },
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    const logs: ReadonlyArray<DefaultLogFields> = await instance.logChanges();

    expect(logs.length).to.eq(1);
  });

  it("should push changes", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const pullSpy = sinon.spy();
    const pushSpy = sinon.spy();
    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          pull: pullSpy,
          push: pushSpy,
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pushChanges();

    assert.isTrue(pullSpy.calledOnce);
    assert.isTrue(pushSpy.calledOnce);
  });

  it("should commit changes", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const pullSpy = sinon.spy();
    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          add: addSpy,
          commit: commitSpy,
          pull: pullSpy,
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.commitChanges();

    assert.isTrue(pullSpy.calledOnce);
    assert.isTrue(addSpy.calledOnce);
    assert.isTrue(commitSpy.calledOnce);
  });

  it("should commit changes with message", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const pullSpy = sinon.spy();
    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          add: addSpy,
          commit: commitSpy,
          pull: pullSpy,
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.commitChanges("message");

    assert.isTrue(pullSpy.calledOnce);
    assert.isTrue(addSpy.calledOnce);
    assert.isTrue(commitSpy.calledWith("message"));
  });

  it("should init repo", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const initSpy = sinon.spy();
    const addRemoteSpy = sinon.spy();
    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          addRemote: addRemoteSpy,
          checkIsRepo: sinon.stub().resolves(false),
          init: initSpy,
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.initRepo("url");

    assert.isTrue(initSpy.calledOnce);
    assert.isTrue(addRemoteSpy.calledWith("origin", "url"));
  });

  it("should pull repo [reset: default, choice: 0]", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache");

    const resetSpy = sinon.spy();
    const pullStub = sinon.stub()
      .onCall(0).rejects(new Error("Mocked error"))
      .onCall(1).resolves();


    const proxy: any = proxyquire("../../helper/git", {
      "./": {
        QuestionHelper: class {
          public static chooseOverrideLocalChanges = sinon.stub().resolves(0);
        },
        LogHelper
      },
      "simple-git/promise": (): any => {
        return {
          pull: pullStub,
          reset: resetSpy,
        };
      },
    });


    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(resetSpy.calledWith(["--hard", "origin/master"]));
    expect(pullStub.callCount).to.eq(2);

    assert.isTrue(invalidateCacheSpy.calledOnce);
  });

  it("should pull repo [reset: default, choice: 1]", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache");

    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const rawSpy = sinon.spy();

    const proxy: any = proxyquire("../../helper/git", {
      "./": {
        QuestionHelper: class {
          public static chooseOverrideLocalChanges = sinon.stub().resolves(1);
        },
        LogHelper
      },
      "simple-git/promise": (): any => {
        return {
          add: addSpy,
          commit: commitSpy,
          pull: sinon.stub().rejects(new Error("Mocked error")),
          raw: rawSpy,
          status: sinon.stub().resolves({} as StatusResult),
        };
      },
    });


    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(addSpy.calledWith("./*"));
    assert.isTrue(commitSpy.calledWith("Setup commit"));
    assert.isTrue(rawSpy.calledWith(["push", "origin", "master", "--force"]));

    assert.isTrue(invalidateCacheSpy.calledOnce);
  });

  it("should pull repo [reset: true, override: 1]", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache");

    const resetSpy = sinon.spy();
    const pullSpy = sinon.spy();


    const proxy: any = proxyquire("../../helper/git", {
      "./": {
        QuestionHelper: class {
          public static chooseOverrideLocalChanges = sinon.stub().resolves(1);
        },
        LogHelper
      },
      "simple-git/promise": (): any => {
        return {
          pull: pullSpy,
          reset: resetSpy,
        };
      },
    });


    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo(true);

    assert.isTrue(resetSpy.calledWith(["--hard", "origin/master"]));
    assert.isTrue(pullSpy.calledWith("origin", "master"));

    // Nothing updated, so no need to invalidate config cache
    assert.isTrue(invalidateCacheSpy.notCalled);
  });

  it("should pull repo [no master branch]", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache");

    sinon.stub(mockedFileHelper, "initReadme").resolves();

    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const rawSpy = sinon.spy();
    const pullStub = sinon.stub()
      .onCall(0).rejects(new Error("fatal: couldn't find remote ref master\n"))
      .onCall(1).resolves();

    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          add: addSpy,
          commit: commitSpy,
          pull: pullStub,
          raw: rawSpy,
          status: sinon.stub().resolves({} as StatusResult),
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(pullStub.calledWith("origin", "master"));
    assert.isTrue(addSpy.calledWith("./*"));
    assert.isTrue(commitSpy.calledWith("Setup commit"));
    assert.isTrue(rawSpy.calledWith(["push", "origin", "master", "--force"]));

    assert.isTrue(invalidateCacheSpy.calledOnce);
  });

  it("should fail to pull repo [error in add]", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    sinon.stub(mockedFileHelper, "initReadme").resolves();

    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          // rejecting pull is the fastest way to get to the error
          add: sinon.stub().rejects(new Error("Mocked error")),
          pull: sinon.stub().rejects(new Error("fatal: couldn't find remote ref master\n")),
          status: sinon.stub().resolves({} as StatusResult),
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    try {
      await instance.pullRepo();
    } catch (err) {
      assert.isDefined(err);
    }
  });

  it("should exit by choice", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const exitStub = sinon.stub(process, "exit");


    const proxy: any = proxyquire("../../helper/git", {
      "./": {
        QuestionHelper: class {
          public static chooseOverrideLocalChanges = sinon.stub().resolves(2);
        },
        LogHelper
      },
      "simple-git/promise": (): any => {
        return {
          pull: sinon.stub().rejects(new Error("Mocked error")),
        };
      },
    });


    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(exitStub.called);
    exitStub.restore();
  });

  it("should fail to pull repo [unknown override option]", async function () {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);


    const proxy: any = proxyquire("../../helper/git", {
      "./": {
        QuestionHelper: class {
          public static chooseOverrideLocalChanges = sinon.stub().resolves(1337);
        },
        LogHelper
      },
      "simple-git/promise": (): any => {
        return {
          pull: sinon.stub().rejects(new Error("Mocked error")),
        };
      },
    });


    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    try {
      await instance.pullRepo();
    } catch (err) {
      assert.isDefined(err);
    }
  });
});
