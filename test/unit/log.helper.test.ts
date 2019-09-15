import { assert } from "chai";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";

describe("LogHelper", () => {
  before(() => {
    proxyquire.noCallThru();
  });

  it("should debug message", async () => {
    const proxy: any = proxyquire("../../helper/log", {});

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.DEBUG = true;
    proxy.LogHelper.debug("Debug");

    assert.isTrue(logStub.calledOnceWith("Debug"));
    logStub.restore();
  });

  it("should debug message with error", async () => {
    const mockedError: Error = new Error("Mocked error");
    const proxy: any = proxyquire("../../helper/log", {});

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.DEBUG = true;
    proxy.LogHelper.debug("Debug", mockedError);

    assert.isTrue(logStub.calledOnceWith("Debug", mockedError));
    logStub.restore();
  });

  it("should not debug message", async () => {
    const proxy: any = proxyquire("../../helper/log", {});

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.DEBUG = false;
    proxy.LogHelper.debug("Debug");

    assert.isTrue(logStub.notCalled);
    logStub.restore();
  });

  it("should not debug message", async () => {
    const proxy: any = proxyquire("../../helper/log", {});

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.DEBUG = true;
    proxy.LogHelper.silence = true;
    proxy.LogHelper.debug("Debug");

    assert.isTrue(logStub.notCalled);
    logStub.restore();
  });

  it("should log message", async () => {
    const whiteStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        white: {
          bold: whiteStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.log("Message");

    assert.isTrue(logStub.calledOnce);
    logStub.restore();

    assert.isTrue(whiteStub.calledOnce);
  });

  it("should not log message", async () => {
    const whiteStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        white: {
          bold: whiteStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.silence = true;
    proxy.LogHelper.log("Message");

    assert.isTrue(logStub.notCalled);
    logStub.restore();

    assert.isTrue(whiteStub.notCalled);
  });

  it("should warn message", async () => {
    const yellowStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        yellow: {
          bold: yellowStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.warn("Message");

    assert.isTrue(logStub.calledOnce);
    logStub.restore();

    assert.isTrue(yellowStub.calledOnce);
  });

  it("should not warn message", async () => {
    const yellowStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        yellow: {
          bold: yellowStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.silence = true;
    proxy.LogHelper.warn("Message");

    assert.isTrue(logStub.notCalled);
    logStub.restore();

    assert.isTrue(yellowStub.notCalled);
  });

  it("should error message", async () => {
    const redStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        red: {
          bold: redStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.error("Message");

    assert.isTrue(logStub.calledOnce);
    logStub.restore();

    assert.isTrue(redStub.calledOnce);
  });

  it("should not error message", async () => {
    const redStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        red: {
          bold: redStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.silence = true;
    proxy.LogHelper.error("Message");

    assert.isTrue(logStub.notCalled);
    logStub.restore();

    assert.isTrue(redStub.notCalled);
  });

  it("should info message", async () => {
    const greenStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        green: {
          bold: greenStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.info("Message");

    assert.isTrue(logStub.calledOnce);
    logStub.restore();

    assert.isTrue(greenStub.calledOnce);
  });

  it("should not info message", async () => {
    const greenStub: SinonStub = sinon.stub();
    const proxy: any = proxyquire("../../helper/log", {
      chalk: {
        green: {
          bold: greenStub,
        },
      },
    });

    const logStub: SinonStub = sinon.stub(console, "log").returns();

    proxy.LogHelper.silence = true;
    proxy.LogHelper.info("Message");

    assert.isTrue(logStub.notCalled);
    logStub.restore();

    assert.isTrue(greenStub.notCalled);
  });
});
