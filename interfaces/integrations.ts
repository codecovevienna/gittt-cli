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

export interface IMultipieRole {
  role: string,
  // format: 2021-01-01
  start_date: string,
  end_date: string,
  // actually a float
  factor: string
}

export interface IMultipieRolesResult {
  success: boolean;
  data?: IMultipieRole[];
  message?: string;
}
