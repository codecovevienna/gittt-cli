import ClientOAuth2 from 'client-oauth2';
import { IMultipieInputLink, IMultipieStoreLink, IIntegrationLink } from '../interfaces';

const MULTIPIE_OAUTH_CLIENT_ID = "cc-gittt-cli";
const MULTIPIE_OAUTH_ACCESS_TOKEN_URI = "https://auth.multipie.cc/auth/realms/multipie/protocol/openid-connect/token";
const MULTIPIE_OAUTH_AUTHORIZATION_URI = "https://auth.multipie.cc/auth/realms/multipie/protocol/openid-connect/auth";
const MULTIPIE_OAUTH_REDIRECT_URI = MULTIPIE_OAUTH_AUTHORIZATION_URI;

export class AuthHelper {

  private authClient: ClientOAuth2;

  public getAuthClient = (multipieLink: IMultipieStoreLink | IMultipieInputLink): ClientOAuth2 => {
    if (!this.authClient) {
      this.authClient = new ClientOAuth2({
        clientId: MULTIPIE_OAUTH_CLIENT_ID,
        clientSecret: multipieLink.clientSecret,
        accessTokenUri: MULTIPIE_OAUTH_ACCESS_TOKEN_URI,
        authorizationUri: MULTIPIE_OAUTH_AUTHORIZATION_URI,
        redirectUri: MULTIPIE_OAUTH_REDIRECT_URI,
        scopes: ['openid', 'offline_access']
      })
    }

    return this.authClient;
  }

  public getLegacyAuth = (multipieLink: IMultipieStoreLink | IMultipieInputLink): string => {
    if (multipieLink.username) {
      return multipieLink.username;
    } else {
      throw new Error("Unable to get username");
    }
  }
}