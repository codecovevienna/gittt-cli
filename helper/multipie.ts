import axios, { AxiosResponse } from "axios";
import { Token } from "client-oauth2";
import { AuthHelper, ConfigHelper, LogHelper } from ".";
import { IMultipieLink, IMultipieRole, IMultipieRolesResult, IMultipieStoreLink, IProject, ISelectChoice } from "../interfaces";
import { IRecord } from '../interfaces/index';
import moment from "moment";

export const DEFAULT_ROLE = '?'

export class MultipieHelper {

  public getValidRoles = async (project: IProject, record: IRecord, oldRole?: string): Promise<Array<ISelectChoice>> => {
    let roles: Array<ISelectChoice> = [
      {
        name: oldRole || DEFAULT_ROLE,
        value: oldRole || DEFAULT_ROLE,
      }
    ];

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
    const rolesFromApi: IMultipieRole[] = await this.getRolesFromApi(link, record);

    // merge roles with default roles
    // so if we have an oldRole that is not in the rolesFromApi it will be available afterwards
    roles = [
      ...roles
        .filter(
          choice => !rolesFromApi
            .map(multipieApiRole => multipieApiRole.role)
            .includes(choice.name)
        ),
      ...rolesFromApi
        .map(multipieApiRole => (
          {
            name: multipieApiRole.role,
            value: multipieApiRole.role
          })
        )
    ];

    return roles;
  }

  private getRolesFromApi = async (link: IMultipieLink, record: IRecord): Promise<Array<IMultipieRole>> => {
    const multipieLink: IMultipieStoreLink = link as IMultipieStoreLink;
    const authHelper = new AuthHelper();

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
    const rolesUrl = `${link.host}${link.roleEndpoint}?project=${link.projectName}&time=${moment(record.end)
      .format('YYYY-MM-DDTHH:mm:ss')}`;

    try {
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

      const { data } = rolesResult;

      if (!data.success) {
        return [];
      }

      return data.data || [];
    } catch (err: any) {
      delete err.config;
      delete err.request;
      delete err.response;
      LogHelper.debug("Loading roles request failed", err);
      throw new Error("Loading roles request failed");
    }
  }
}
