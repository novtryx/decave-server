export interface LoginType  {
    email: string;
    password: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}
