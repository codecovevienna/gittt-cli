export interface IJiraPublishResult {
  success: boolean;
  data?: any;
  message?: string;
}

export interface IMultipiePublishResult {
  success: boolean;
  data?: any;
  message?: string;
}

export interface IMultipieRolesResult {
  success: boolean;
  data?: {
    roles: string[];
  };
  message?: string;
}
