import { assert, expect } from "chai";
import path from "path";
import proxyquire from "proxyquire";
import { StatusResult } from "simple-git/promise";
import { DefaultLogFields, ListLogSummary } from "simple-git/typings/response";
import sinon from "sinon";
import { FileHelper, GitHelper, LogHelper } from "../../helper/index";
import { IOverrideAnswers } from "../../interfaces";

const sandboxDir = "./sandbox";
const configDir = path.join(sandboxDir, ".git-time-tracker");
const configFileName = "config.json";
const projectsDir = "projects";

LogHelper.silence = true;

describe("GitHelper", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should create instance", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const proxy = proxyquire("../../helper/git", {
      "simple-git/promise": () => {
        return {};
      },
    });

    const gitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    // type of proxy object is not GitHelper, so just check for definition
    assert.isDefined(gitHelper)
  });

  it("should log changes", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
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
              total: 0,
              latest: {
                author_email: "mock@mail.com",
                author_name: "mockAuthor",
                body: "mockedBody",
                date: Date.UTC.toString(),
                hash: "mockedHash",
                message: "mockMessage",
                refs: "mockedRefs",
              },
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
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const pullSpy = sinon.spy();
    const pushSpy = sinon.spy();
    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
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
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const pullSpy = sinon.spy();
    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          pull: pullSpy,
          add: addSpy,
          commit: commitSpy,
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
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const pullSpy = sinon.spy();
    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          pull: pullSpy,
          add: addSpy,
          commit: commitSpy,
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
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const initSpy = sinon.spy();
    const addRemoteSpy = sinon.spy();
    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          checkIsRepo: sinon.stub().resolves(false),
          init: initSpy,
          addRemote: addRemoteSpy,
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
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache")

    const resetSpy = sinon.spy();
    const pullSpy = sinon.stub()
      .onCall(0).rejects(new Error("Mocked error"))
      .onCall(1).resolves();

    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          reset: resetSpy,
          pull: pullSpy,
        };
      },
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 0,
        } as IOverrideAnswers),
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(resetSpy.calledWith(["--hard", "origin/master"]));
    expect(pullSpy.callCount).to.eq(2);

    assert.isTrue(invalidateCacheSpy.calledOnce)
  });

  it("should pull repo [reset: default, override: 1]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache")

    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const rawSpy = sinon.spy();
    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          add: addSpy,
          commit: commitSpy,
          raw: rawSpy,
          pull: sinon.stub().rejects(new Error("Mocked error")),
          status: sinon.stub().resolves({} as StatusResult),
        };
      },
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 1,
        } as IOverrideAnswers),
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(addSpy.calledWith("./*"));
    assert.isTrue(commitSpy.calledWith("Setup commit"));
    assert.isTrue(rawSpy.calledWith(["push", "origin", "master", "--force"]));

    assert.isTrue(invalidateCacheSpy.calledOnce)
  });

  it("should pull repo [reset: true, override: 1]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache")

    const resetSpy = sinon.spy();
    const pullSpy = sinon.spy();
    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          reset: resetSpy,
          pull: pullSpy,
        };
      },
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 1,
        } as IOverrideAnswers),
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo(true);

    assert.isTrue(resetSpy.calledWith(["--hard", "origin/master"]));
    assert.isTrue(pullSpy.calledWith("origin", "master"));

    // Nothing updated, so no need to invalidate config cache
    assert.isTrue(invalidateCacheSpy.notCalled)
  });

  it("should pull repo [no master branch]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const invalidateCacheSpy = sinon.spy(mockedFileHelper, "invalidateCache")

    sinon.stub(mockedFileHelper, "initReadme").resolves()

    const addSpy = sinon.spy();
    const commitSpy = sinon.spy();
    const rawSpy = sinon.spy();
    const pullSpy = sinon.stub()
      .onCall(0).rejects(new Error("fatal: couldn't find remote ref master\n"))
      .onCall(1).resolves();

    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          pull: pullSpy,
          add: addSpy,
          commit: commitSpy,
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

    assert.isTrue(invalidateCacheSpy.calledOnce)
  });

  it("should fail to pull repo [error in add]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    sinon.stub(mockedFileHelper, "initReadme").resolves()

    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          // rejecting pull is the fastest way to get to the error
          pull: sinon.stub().rejects(new Error("fatal: couldn't find remote ref master\n")),
          add: sinon.stub().rejects(new Error("Mocked error")),
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
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const exitStub = sinon.stub(process, "exit");
    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          pull: sinon.stub().rejects(new Error("Mocked error")),
        };
      },
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 2,
        } as IOverrideAnswers),
      },
    });

    const instance: GitHelper = new proxy.GitHelper(configDir, mockedFileHelper);

    await instance.pullRepo();

    assert.isTrue(exitStub.called);
  });

  it("should fail to pull repo [unknown override option]", async () => {
    const fileProxy: any = proxyquire("../../helper/file", {});
    const mockedFileHelper: FileHelper = new fileProxy.FileHelper(configDir, configFileName, projectsDir);

    const proxy = proxyquire.noCallThru().load("../../helper/git", {
      "simple-git/promise": () => {
        return {
          pull: sinon.stub().rejects(new Error("Mocked error")),
        };
      },
      "inquirer": {
        prompt: sinon.stub().resolves({
          override: 1337,
        } as IOverrideAnswers),
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
