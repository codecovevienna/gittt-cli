import { expect } from "chai";
import { AuthHelper } from "../../helper";
import sinon from "sinon";
import proxyquire from "proxyquire";

describe("AuthHelper", function () {
  it("create instance and call createToken", async function () {
    const proxy: any = proxyquire("../../helper/auth", {
      "client-oauth2": class ClientOAuth2 {
        constructor() {
          return {
            createToken: sinon.stub().resolves("token")
          }
        }
      }
    });

    const instance: AuthHelper = new proxy.AuthHelper();

    const client = await instance.getAuthClient({
      clientSecret: "mocked",
      endpoint: "mocked",
      host: "mocked",
      linkType: "mocked",
      username: "mocked",
      password: "mocked",
      projectName: "mocked",
    })

    expect(await client.createToken({
      mock: "mocked"
    })).to.eq("token");

  });

  it("create instance and get legacy auth", async function () {
    const proxy: any = proxyquire("../../helper/auth", {});

    const instance: AuthHelper = new proxy.AuthHelper();

    const legacyAuth = await instance.getLegacyAuth({
      host: "mocked",
      endpoint: "mocked",
      linkType: "mocked",
      username: "mocked",
      projectName: "mocked",
    })

    expect(legacyAuth).to.eq("mocked");

  });
})