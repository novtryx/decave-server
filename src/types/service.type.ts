export interface SessionData {
  userId: string;
  email: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
  };
  location: {
    city: string;
    region: string;
    country: string;
    timezone: string;
  };
  ipAddress: string;
  loginTime: string;
  lastActive: string;
  token: string;
  isCurrent: boolean;
}