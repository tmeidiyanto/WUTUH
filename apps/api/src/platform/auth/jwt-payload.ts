export interface JwtPayload {
  sub: string;
  companyId: string;
  roleId: string | null;
  email: string;
  permissions: string[];
}
