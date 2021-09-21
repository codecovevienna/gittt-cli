import { IProject, ISelectChoice } from "../interfaces";


export class MultipieHelper {
  public static DEFAULT_ROLE = '?'

  public static getValidRoles = async (project: IProject, oldRole?: string): Promise<Array<ISelectChoice>> => {
    let roles: Array<ISelectChoice> = [
      {
        name: MultipieHelper.DEFAULT_ROLE,
        value: oldRole || MultipieHelper.DEFAULT_ROLE,
      }
    ];

    if (project === undefined) {
      return roles;
    }

    console.log(project);

    // TODO: load roles from multipie link 
    return roles;
  }
}
