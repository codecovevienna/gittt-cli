import { assert } from "chai";
import { ValidationHelper } from "../../helper";
import proxyquire from "proxyquire";
import sinon, { SinonStub } from "sinon";

describe("ValidationHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should validate number", async function () {
    assert.isTrue(ValidationHelper.validateNumber("1337"));
    assert.isTrue(ValidationHelper.validateNumber("1.234"));
    assert.isTrue(ValidationHelper.validateNumber(69));
    assert.isTrue(ValidationHelper.validateNumber(5, 5, 5));
    assert.isTrue(ValidationHelper.validateNumber("5", 5, 5));

    assert.isFalse(ValidationHelper.validateNumber("asdf"));
    assert.isFalse(ValidationHelper.validateNumber("7..5"));
    assert.isFalse(ValidationHelper.validateNumber(3, 4, 5));
    assert.isFalse(ValidationHelper.validateNumber(6, 4, 5));
  });

  it("should validate year", async function () {
    assert.isTrue(ValidationHelper.validateYear("1337"));
    assert.isTrue(ValidationHelper.validateYear(1337));

    assert.isString(ValidationHelper.validateYear("asdf"));
  });

  it("should validate month", async function () {
    assert.isTrue(ValidationHelper.validateMonth("06"));
    assert.isTrue(ValidationHelper.validateMonth(6));

    assert.isString(ValidationHelper.validateMonth(69));
  });

  it("should validate day", async function () {
    assert.isTrue(ValidationHelper.validateDay("06"));
    assert.isTrue(ValidationHelper.validateDay(6));

    assert.isString(ValidationHelper.validateDay(69));
  });

  it("should validate hour", async function () {
    assert.isTrue(ValidationHelper.validateHour("06"));
    assert.isTrue(ValidationHelper.validateHour(6));

    assert.isString(ValidationHelper.validateHour(69));
  });

  it("should validate minute", async function () {
    assert.isTrue(ValidationHelper.validateMinute("06"));
    assert.isTrue(ValidationHelper.validateMinute(6));

    assert.isString(ValidationHelper.validateMinute(69));
  });

  it("should validate amount", async function () {
    assert.isTrue(ValidationHelper.validateAmount("06"));
    assert.isTrue(ValidationHelper.validateAmount(6));

    assert.isString(ValidationHelper.validateAmount("asdf"));
  });

  it("should validate git url", async function () {
    assert.isTrue(ValidationHelper.validateGitUrl("ssh://git@github.com:10022/company/project.git"));
    assert.isTrue(ValidationHelper.validateGitUrl("https://github.com:443/company/project.git"));
    assert.isTrue(ValidationHelper.validateGitUrl("http://github.com:80/company/project.git"));

    assert.isString(ValidationHelper.validateGitUrl("http://github.com/company/project.git"));
  });

  it("should validate jira endpoint", async function () {
    assert.isTrue(ValidationHelper.validateJiraEndpoint("http://test.com"));
    assert.isTrue(ValidationHelper.validateJiraEndpoint("https://test.com"));
    // TODO improve regex, this is not a valid url
    assert.isTrue(ValidationHelper.validateJiraEndpoint("https://a"));

    assert.isString(ValidationHelper.validateJiraEndpoint("ssh://"));
  });

  it("should validate jira key", async function () {
    assert.isTrue(ValidationHelper.validateJiraKey("MOCKED"));

    assert.isString(ValidationHelper.validateJiraKey("M"));
  });

  it("should validate file", async function () {
    const proxy: any = proxyquire("../../helper/validation", {
      "fs-extra": {
        accessSync: sinon.stub().returns(true),
        statSync: sinon.stub()
          .returns({
            isFile: true,
          }),
      },
    });
    assert.isTrue(proxy.ValidationHelper.validateFile("/tmp/mocked"));
  });

  it("should fail to validate file [throws error]", async function () {
    const proxy: any = proxyquire("../../helper/validation", {
      "fs-extra": {
        accessSync: sinon.stub().throws(new Error("Mocked Error")),
        statSync: sinon.stub()
          .returns({
            isFile: true,
          }),
      },
    });
    assert.isFalse(proxy.ValidationHelper.validateFile("/tmp/mocked"));
  });


  it("should fail to validate file [wrong input]", async function () {
    const proxy: any = proxyquire("../../helper/validation", {
      "fs-extra": {
        accessSync: sinon.stub().throws(new Error("Mocked Error")),
        statSync: sinon.stub()
          .returns({
            isFile: true,
          }),
      },
    });
    assert.isFalse(proxy.ValidationHelper.validateFile(23));
  });
});
