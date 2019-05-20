import { assert, expect } from "chai";
import inquirer = require("inquirer");
import moment, { Moment } from "moment";
import path from "path";
import proxyquire from "proxyquire";
import sinon, { SinonInspectable } from "sinon";
import { FileHelper, GitHelper, LogHelper, ProjectHelper, TimerHelper } from "../../helper/index";
import { ITimerFile } from "../../interfaces";

const sandboxDir: string = "./sandbox";
const configDir: string = path.join(sandboxDir, ".git-time-tracker");
const configFileName: string = "config.json";
const timerFileName: string = "timer.json";
const projectsDir: string = "projects";

LogHelper.DEBUG = false;
LogHelper.silence = true;

describe("TimerHelper", () => {
  let mockedFileHelper: FileHelper;
  let mockedProjectHelper: ProjectHelper;
  let mockedGitHelper: GitHelper;

  before(() => {
    proxyquire.noCallThru();

    const fileProxy: any = proxyquire("../../helper/file", {});
    const gitProxy: any = proxyquire("../../helper/git", {
      "simple-git/promise": (baseDir: string): any => {
        expect(baseDir).to.eq(configDir);
        return {};
      },
    });
    const projectProxy: any = proxyquire("../../helper/project", {});

    mockedFileHelper = new fileProxy.FileHelper(configDir, configFileName, timerFileName, projectsDir);
    mockedGitHelper = new gitProxy.GitHelper(configDir, mockedFileHelper);
    mockedProjectHelper = new projectProxy.ProjectHelper(mockedGitHelper, mockedFileHelper);
  });

  it("should create instance", async () => {
    const timerHelper: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    expect(timerHelper).to.be.instanceOf(TimerHelper);
  });

  it("should start the timer [file does not exist]", async () => {
    const timerFileExistsStub: SinonInspectable = sinon.stub(mockedFileHelper, "timerFileExists").returns(false);
    const saveTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "saveTimerObject").resolves();

    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    await instance.startTimer();

    assert.isTrue(saveTimerObjectStub.calledOnce);
    assert.isTrue(timerFileExistsStub.calledOnce);

    timerFileExistsStub.restore();
    saveTimerObjectStub.restore();
  });

  it("should fail [timer already started]", async () => {
    const timerFileExistsStub: SinonInspectable = sinon.stub(mockedFileHelper, "timerFileExists").returns(true);
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(true);
    const getTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "getTimerObject").resolves({
      start: 0,
      stop: 0,
    } as ITimerFile);
    const saveTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "saveTimerObject").resolves();

    await instance.startTimer();

    assert.isTrue(timerFileExistsStub.calledOnce);
    assert.isTrue(saveTimerObjectStub.notCalled);
    assert.isTrue(getTimerObjectStub.calledOnce);
    assert.isTrue(isTimerRunningObjectStub.calledOnce);

    timerFileExistsStub.restore();
    saveTimerObjectStub.restore();
    isTimerRunningObjectStub.restore();
    getTimerObjectStub.restore();
  });

  it("should start the timer [file already exists]", async () => {
    const timerFileExistsStub: SinonInspectable = sinon.stub(mockedFileHelper, "timerFileExists").returns(true);
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(false);
    const saveTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "saveTimerObject").resolves();

    await instance.startTimer();

    assert.isTrue(timerFileExistsStub.calledOnce);
    assert.isTrue(saveTimerObjectStub.calledOnce);
    assert.isTrue(isTimerRunningObjectStub.calledOnce);

    timerFileExistsStub.restore();
    saveTimerObjectStub.restore();
    isTimerRunningObjectStub.restore();
  });

  it("should stop the timer [with message]", async () => {

    const now: number = Date.now();

    const nowStub: SinonInspectable = sinon.stub(Date, "now").returns(now);
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(true);
    const getTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "getTimerObject").resolves({
      start: now - 10,
      stop: 0,
    } as ITimerFile);
    const addRecordToProjectStub: SinonInspectable = sinon.stub(mockedProjectHelper, "addRecordToProject").resolves();
    const saveTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "saveTimerObject").resolves();

    const message: string = "test";
    await instance.stopTimer(message);

    assert.isTrue(nowStub.calledOnce);
    assert.isTrue(isTimerRunningObjectStub.calledOnce);
    assert.isTrue(getTimerObjectStub.calledOnce);
    assert.isTrue(addRecordToProjectStub.calledOnceWith({
      amount: moment.duration(10).asHours(),
      message: "test",
      type: "Time",
    }));
    assert.isTrue(saveTimerObjectStub.calledOnce);

    nowStub.restore();
    isTimerRunningObjectStub.restore();
    getTimerObjectStub.restore();
    addRecordToProjectStub.restore();
    saveTimerObjectStub.restore();
  });

  it("should stop the timer [ask for message]", async () => {

    const now: number = Date.now();

    const nowStub: SinonInspectable = sinon.stub(Date, "now").returns(now);
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(true);
    const getTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "getTimerObject").resolves({
      start: now - 10,
      stop: 0,
    } as ITimerFile);
    const addRecordToProjectStub: SinonInspectable = sinon.stub(mockedProjectHelper, "addRecordToProject").resolves();
    const saveTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "saveTimerObject").resolves();
    const promptStub: SinonInspectable = sinon.stub(inquirer, "prompt").resolves({ gitCommitMessage: "Test" });

    await instance.stopTimer(undefined);

    assert.isTrue(nowStub.calledOnce);
    assert.isTrue(isTimerRunningObjectStub.calledOnce);
    assert.isTrue(getTimerObjectStub.calledOnce);
    assert.isTrue(addRecordToProjectStub.calledOnceWith({
      amount: moment.duration(10).asHours(),
      message: "Test",
      type: "Time",
    }));
    assert.isTrue(saveTimerObjectStub.calledOnce);
    assert.isTrue(promptStub.calledOnce);

    nowStub.restore();
    isTimerRunningObjectStub.restore();
    getTimerObjectStub.restore();
    addRecordToProjectStub.restore();
    saveTimerObjectStub.restore();
    promptStub.restore();
  });

  it("should stop the timer [ask for message {empty}]", async () => {

    const now: number = Date.now();

    const nowStub: SinonInspectable = sinon.stub(Date, "now").returns(now);
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(true);
    const getTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "getTimerObject").resolves({
      start: now - 10,
      stop: 0,
    } as ITimerFile);
    const addRecordToProjectStub: SinonInspectable = sinon.stub(mockedProjectHelper, "addRecordToProject").resolves();
    const saveTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "saveTimerObject").resolves();
    const promptStub: SinonInspectable = sinon.stub(inquirer, "prompt").resolves({ gitCommitMessage: "" });

    await instance.stopTimer(undefined);

    assert.isTrue(nowStub.calledOnce);
    assert.isTrue(isTimerRunningObjectStub.calledOnce);
    assert.isTrue(getTimerObjectStub.calledOnce);
    assert.isTrue(addRecordToProjectStub.calledOnceWith({
      amount: moment.duration(10).asHours(),
      message: undefined,
      type: "Time",
    }));
    assert.isTrue(saveTimerObjectStub.calledOnce);
    assert.isTrue(promptStub.calledOnce);

    nowStub.restore();
    isTimerRunningObjectStub.restore();
    getTimerObjectStub.restore();
    addRecordToProjectStub.restore();
    saveTimerObjectStub.restore();
    promptStub.restore();
  });

  it("should not stop the timer [timer is not running]", async () => {
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(false);

    await instance.stopTimer(undefined);

    assert.isTrue(isTimerRunningObjectStub.calledOnce);

    isTimerRunningObjectStub.restore();
  });

  it("should kill the timer", async () => {
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(true);
    const initTimerFileStub: SinonInspectable = sinon.stub(mockedFileHelper, "initTimerFile").resolves();

    await instance.killTimer();

    assert.isTrue(isTimerRunningObjectStub.calledOnce);
    assert.isTrue(initTimerFileStub.calledOnce);

    isTimerRunningObjectStub.restore();
    initTimerFileStub.restore();
  });

  it("should not kill the timer [no timer is running]", async () => {
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const isTimerRunningObjectStub: SinonInspectable = sinon.stub(instance, "isTimerRunning").resolves(false);
    const initTimerFileStub: SinonInspectable = sinon.stub(mockedFileHelper, "initTimerFile").resolves();

    await instance.killTimer();

    assert.isTrue(isTimerRunningObjectStub.calledOnce);
    assert.isTrue(initTimerFileStub.notCalled);

    isTimerRunningObjectStub.restore();
    initTimerFileStub.restore();
  });

  it("should check if timer is running", async () => {
    const now: Moment = moment();
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const timerFileExistsStub: SinonInspectable = sinon.stub(mockedFileHelper, "timerFileExists").returns(true);
    const getTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "getTimerObject").resolves({
      start: now.valueOf() - 10,
      stop: 0,
    } as ITimerFile);

    const result: boolean = await instance.isTimerRunning(now);
    assert.isTrue(result);

    assert.isTrue(timerFileExistsStub.calledOnce);
    assert.isTrue(getTimerObjectStub.calledOnce);

    timerFileExistsStub.restore();
    getTimerObjectStub.restore();
  });

  it("should check if timer is running [timer is not running]", async () => {
    const now: Moment = moment();
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const timerFileExistsStub: SinonInspectable = sinon.stub(mockedFileHelper, "timerFileExists").returns(true);
    const getTimerObjectStub: SinonInspectable = sinon.stub(mockedFileHelper, "getTimerObject").resolves({
      start: now.valueOf() + 10,
      stop: 0,
    } as ITimerFile);

    const result: boolean = await instance.isTimerRunning(now);
    assert.isFalse(result);

    assert.isTrue(timerFileExistsStub.calledOnce);
    assert.isTrue(getTimerObjectStub.calledOnce);

    timerFileExistsStub.restore();
    getTimerObjectStub.restore();
  });

  it("should check if timer is running [timer file does not exist]", async () => {
    const now: Moment = moment();
    const instance: TimerHelper = new TimerHelper(mockedFileHelper, mockedProjectHelper);
    const timerFileExistsStub: SinonInspectable = sinon.stub(mockedFileHelper, "timerFileExists").returns(false);

    const result: boolean = await instance.isTimerRunning(now);
    assert.isFalse(result);

    assert.isTrue(timerFileExistsStub.calledOnce);

    timerFileExistsStub.restore();
  });
});
