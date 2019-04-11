import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import { StatusResult } from "simple-git/promise";
import { DefaultLogFields, ListLogSummary } from "simple-git/typings/response";
import sinon, { SinonInspectable } from "sinon";
import { FileHelper, GitHelper, LogHelper } from "../../helper/index";
import { IOverrideAnswers } from "../../interfaces";

const sandboxDir: string = "./sandbox";
const configDir: string = path.join(sandboxDir, ".git-time-tracker");
const configFileName: string = "config.json";
const timerFileName: string = "timer.json";
const projectsDir: string = "projects";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("GitHelper", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should create instance", async () => {
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

  it("should log changes", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          log: (): ListLogSummary => {
            return {
              all: [
                {
                  author_email: "mock@mail.com",
                  author_name: "mockAuthor",
                  body: "mockedBody",
                  date: Date.UTC.toString(),
                  hash: "mockedHash",
                  message: "mockMessage",
                  refs: "mockedRefs",
                },
              ],
              latest: {
                author_email: "mock@mail.com",
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

  it("should push changes", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const pullSpy: SinonInspectable = sinon.spy();
    const pushSpy: SinonInspectable = sinon.spy();
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

  it("should commit changes", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const pullSpy: SinonInspectable = sinon.spy();
    const addSpy: SinonInspectable = sinon.spy();
    const commitSpy: SinonInspectable = sinon.spy();
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

  it("should commit changes with message", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const pullSpy: SinonInspectable = sinon.spy();
    const addSpy: SinonInspectable = sinon.spy();
    const commitSpy: SinonInspectable = sinon.spy();
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

  it("should init repo", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const initSpy: SinonInspectable = sinon.spy();
    const addRemoteSpy: SinonInspectable = sinon.spy();
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

  it("should pull repo [reset: default, override: 0]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy: SinonInspectable = sinon.spy(mockedFileHelper, "invalidateCache");

    const resetSpy: SinonInspectable = sinon.spy();
    const pullSpy: SinonInspectable = sinon.stub()
      .onCall(0).rejects(new Error("Mocked error"))
      .onCall(1).resolves();

    const proxy: any = proxyquire("../../helper/git", {
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 0,
        } as IOverrideAnswers),
      },
      "simple-git/promise": (): any => {
        return {
          pull: pullSpy,
          reset: resetSpy,
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(resetSpy.calledWith(["--hard", "origin/master"]));
    expect(pullSpy.callCount).to.eq(2);

    assert.isTrue(invalidateCacheSpy.calledOnce);
  });

  it("should pull repo [reset: default, override: 1]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy: SinonInspectable = sinon.spy(mockedFileHelper, "invalidateCache");

    const addSpy: SinonInspectable = sinon.spy();
    const commitSpy: SinonInspectable = sinon.spy();
    const rawSpy: SinonInspectable = sinon.spy();
    const proxy: any = proxyquire("../../helper/git", {
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 1,
        } as IOverrideAnswers),
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

  it("should pull repo [reset: true, override: 1]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy: SinonInspectable = sinon.spy(mockedFileHelper, "invalidateCache");

    const resetSpy: SinonInspectable = sinon.spy();
    const pullSpy: SinonInspectable = sinon.spy();
    const proxy: any = proxyquire("../../helper/git", {
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 1,
        } as IOverrideAnswers),
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

  it("should pull repo [no master branch]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const invalidateCacheSpy: SinonInspectable = sinon.spy(mockedFileHelper, "invalidateCache");

    sinon.stub(mockedFileHelper, "initReadme").resolves();

    const addSpy: SinonInspectable = sinon.spy();
    const commitSpy: SinonInspectable = sinon.spy();
    const rawSpy: SinonInspectable = sinon.spy();
    const pullSpy: SinonInspectable = sinon.stub()
      .onCall(0).rejects(new Error("fatal: couldn't find remote ref master\n"))
      .onCall(1).resolves();

    const proxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (): any => {
        return {
          add: addSpy,
          commit: commitSpy,
          pull: pullSpy,
          raw: rawSpy,
          status: sinon.stub().resolves({} as StatusResult),
        };
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(pullSpy.calledWith("origin", "master"));
    assert.isTrue(addSpy.calledWith("./*"));
    assert.isTrue(commitSpy.calledWith("Setup commit"));
    assert.isTrue(rawSpy.calledWith(["push", "origin", "master", "--force"]));

    assert.isTrue(invalidateCacheSpy.calledOnce);
  });

  it("should fail to pull repo [error in add]", async () => {
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

  it("should exit by choice", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const exitStub: SinonInspectable = sinon.stub(process, "exit");
    const proxy: any = proxyquire("../../helper/git", {
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 2,
        } as IOverrideAnswers),
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

  it("should fail to pull repo [unknown override option]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy
      .FileHelper(configDir, configFileName, timerFileName, projectsDir);

    const proxy: any = proxyquire("../../helper/git", {
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 1337,
        } as IOverrideAnswers),
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
