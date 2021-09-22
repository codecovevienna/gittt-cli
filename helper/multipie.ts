import axios, { AxiosResponse } from "axios";
import { Token } from "client-oauth2";
import { AuthHelper, ConfigHelper, LogHelper } from ".";
import { IMultipieLink, IMultipieRolesResult, IMultipieStoreLink, IProject, ISelectChoice } from "../interfaces";

export const DEFAULT_ROLE = '?'

export class MultipieHelper {

  public getValidRoles = async (project: IProject, oldRole?: string): Promise<Array<ISelectChoice>> => {
    let roles: Array<ISelectChoice> = [
      {
        name: DEFAULT_ROLE,
        value: oldRole || DEFAULT_ROLE,
      }
    ];

    if (project === undefined) {
      return roles;
    }

    const configHelper = ConfigHelper.getInstance();
    const links = await configHelper.findLinksByProject(project, 'Multipie');
    if (links.length > 1) {
      throw new Error(`Multiple multipie links found for "${project.name}"`);
    }

    // check if everything is configured
    const link = links[0] as IMultipieLink;
    if (!link.roleEndpoint) {
      throw new Error(`No role endpoint set in link for "${project.name}".`);
    }
    const rolesFromApi = await this.getRolesFromApi(link);

    // merge roles with default roles
    // so if we have an oldRole that is not in the rolesFromApi it will be available afterwards
    roles = [
      ...roles.filter(choice => !rolesFromApi.includes(choice.name)),
      ...rolesFromApi.map(role => ({ name: role, value: role }))
    ];

    return roles;
  }

  private getRolesFromApi = async (link: IMultipieLink): Promise<Array<string>> => {
    const multipieLink: IMultipieStoreLink = link as IMultipieStoreLink;
    const authHelper = new AuthHelper();

    try {
      let authorizationHeader = "";

      if (multipieLink.username) {
        // Legacy flow
        LogHelper.debug("Found username parameter in link configuration, using legacy auth method")
        authorizationHeader = authHelper.getLegacyAuth(multipieLink);
      } else {
        const multipieAuth = authHelper.getAuthClient(multipieLink);

        const { refreshToken } = multipieLink;
        if (!refreshToken) {
          throw new Error(`Unable to find refresh token for this project, please login via 'gittt link'`);
        }

        const offlineToken: Token = await multipieAuth.createToken("", refreshToken, {});

        LogHelper.debug(`Refreshing token to get access token`);

        const refreshedToken: Token = await offlineToken.refresh();
        LogHelper.debug(`Got access token`);

        authorizationHeader = `Bearer ${refreshedToken.accessToken}`
      }
      const rolesUrl = `${link.host}${link.roleEndpoint}?project=${link.projectName}`;

      LogHelper.debug(`Loading roles from ${rolesUrl}`);

      const rolesResult: AxiosResponse<IMultipieRolesResult> = await axios
        .get(rolesUrl,
          {
            headers: {
              "Authorization": authorizationHeader,
              "Cache-Control": "no-cache",
              "Content-Type": "application/json",
            },
          },
        );

      const data: IMultipieRolesResult = rolesResult.data;

      // naming is not the best - but the roles are in data.data.roles
      if (data && data.data && data.data.roles && rolesResult.status == 200) {
        return data.data.roles;
      }

      return [];
    } catch (err) {
      delete err.config;
      delete err.request;
      delete err.response;
      LogHelper.debug("Loading roles request failed", err);
      throw new Error("Loading roles request failed");
    }
  }
}
