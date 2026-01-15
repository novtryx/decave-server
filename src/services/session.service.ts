import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import { Request } from "express";
import { SessionData } from "../types/service.type";
import { getRedisClient } from './../config/redis';



export class SessionService {
  private SESSION_PREFIX = "session:";
  private USER_SESSIONS_PREFIX = "user_sessions:";
  private SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

  private async ensureRedisConnection(): Promise<void> {
    const redisClient = await getRedisClient(); // Get client on demand

    if (!redisClient) {
      throw new Error("Redis client is not initialized");
    }

    // Check if client is ready
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  }
  // Extract device info from User-Agent
  private getDeviceInfo(userAgent: string) {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    return {
      browser: `${result.browser.name || "Unknown"} ${result.browser.version || ""}`.trim(),
      os: `${result.os.name || "Unknown"} ${result.os.version || ""}`.trim(),
      device: result.device.type || "Desktop",
    };
  }

  // Get location from IP address
  private getLocationFromIP(ip: string) {
    // Remove IPv6 prefix if present
    const cleanIP = ip.replace(/^::ffff:/, "");

    const geo = geoip.lookup(cleanIP);

    if (geo) {
      return {
        city: geo.city || "Unknown",
        region: geo.region || "Unknown",
        country: geo.country || "Unknown",
        timezone: geo.timezone || "Unknown",
      };
    }

    // Default location if IP lookup fails
    return {
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      timezone: "Unknown",
    };
  }

  // Get client IP address
  private getClientIP(req: Request): string {
    // Check various headers for real IP
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      return (forwarded as string).split(",")[0].trim();
    }

    const realIP = req.headers["x-real-ip"];
    if (realIP) {
      return realIP as string;
    }

    return req.ip || req.socket.remoteAddress || "Unknown";
  }

  // Create new session
  async createSession(
    userId: string,
    email: string,
    token: string,
    req: Request
  ): Promise<SessionData> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand



      const userAgent = req.headers["user-agent"] || "Unknown";
      const ipAddress = this.getClientIP(req);
      const deviceInfo = this.getDeviceInfo(userAgent);
      const location = this.getLocationFromIP(ipAddress);
      const now = new Date().toISOString();

      const sessionData: SessionData = {
        userId,
        email,
        deviceInfo,
        location,
        ipAddress,
        loginTime: now,
        lastActive: now,
        token,
        isCurrent: true,
      };

      // Generate unique session ID
      const sessionId = `${this.SESSION_PREFIX}${userId}:${Date.now()}`;

      // Store session data
      await redisClient.setEx(
        sessionId,
        this.SESSION_EXPIRY,
        JSON.stringify(sessionData)
      );

      // Add session to user's session list
      await redisClient.sAdd(`${this.USER_SESSIONS_PREFIX}${userId}`, sessionId);

      // Set expiry on user sessions set
      await redisClient.expire(
        `${this.USER_SESSIONS_PREFIX}${userId}`,
        this.SESSION_EXPIRY
      );

      return sessionData;
    } catch (error: any) {
      throw new Error(`Error creating session: ${error.message}`);
    }
  }

  // Get all user sessions
  async getUserSessions(userId: string, currentToken?: string): Promise<SessionData[]> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand


      const sessionKeys = await redisClient.sMembers(
        `${this.USER_SESSIONS_PREFIX}${userId}`
      );

      const sessions: SessionData[] = [];

      for (const sessionKey of sessionKeys) {
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);

          // Mark current session
          session.isCurrent = currentToken ? session.token === currentToken : false;

          sessions.push(session);
        } else {
          // Remove expired session from set
          await redisClient.sRem(
            `${this.USER_SESSIONS_PREFIX}${userId}`,
            sessionKey
          );
        }
      }

      // Sort by last active (most recent first)
      return sessions.sort(
        (a, b) =>
          new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      );
    } catch (error: any) {
      throw new Error(`Error getting user sessions: ${error.message}`);
    }
  }

  // Update session last active time
  async updateSessionActivity(userId: string, token: string): Promise<void> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand


      const sessionKeys = await redisClient.sMembers(
        `${this.USER_SESSIONS_PREFIX}${userId}`
      );

      for (const sessionKey of sessionKeys) {
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);

          if (session.token === token) {
            session.lastActive = new Date().toISOString();

            await redisClient.setEx(
              sessionKey,
              this.SESSION_EXPIRY,
              JSON.stringify(session)
            );
            break;
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Error updating session activity: ${error.message}`);
    }
  }

  // Revoke specific session
  async revokeSession(userId: string, token: string): Promise<boolean> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand


      const sessionKeys = await redisClient.sMembers(
        `${this.USER_SESSIONS_PREFIX}${userId}`
      );

      for (const sessionKey of sessionKeys) {
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);

          if (session.token === token) {
            await redisClient.del(sessionKey);
            await redisClient.sRem(
              `${this.USER_SESSIONS_PREFIX}${userId}`,
              sessionKey
            );
            return true;
          }
        }
      }

      return false;
    } catch (error: any) {
      throw new Error(`Error revoking session: ${error.message}`);
    }
  }

  // Revoke all sessions except current
  async revokeAllOtherSessions(userId: string, currentToken: string): Promise<number> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand


      const sessionKeys = await redisClient.sMembers(
        `${this.USER_SESSIONS_PREFIX}${userId}`
      );

      let revokedCount = 0;

      for (const sessionKey of sessionKeys) {
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);

          if (session.token !== currentToken) {
            await redisClient.del(sessionKey);
            await redisClient.sRem(
              `${this.USER_SESSIONS_PREFIX}${userId}`,
              sessionKey
            );
            revokedCount++;
          }
        }
      }

      return revokedCount;
    } catch (error: any) {
      throw new Error(`Error revoking other sessions: ${error.message}`);
    }
  }

  // Revoke all user sessions
  async revokeAllSessions(userId: string): Promise<number> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand

      const sessionKeys = await redisClient.sMembers(
        `${this.USER_SESSIONS_PREFIX}${userId}`
      );

      for (const sessionKey of sessionKeys) {
        await redisClient.del(sessionKey);
      }

      await redisClient.del(`${this.USER_SESSIONS_PREFIX}${userId}`);

      return sessionKeys.length;
    } catch (error: any) {
      throw new Error(`Error revoking all sessions: ${error.message}`);
    }
  }

  // Check if session exists
  async sessionExists(userId: string, token: string): Promise<boolean> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand

      const sessionKeys = await redisClient.sMembers(
        `${this.USER_SESSIONS_PREFIX}${userId}`
      );

      for (const sessionKey of sessionKeys) {
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          if (session.token === token) {
            return true;
          }
        }
      }

      return false;
    } catch (error: any) {
      throw new Error(`Error checking session: ${error.message}`);
    }
  }

  // Get active sessions count
  async getActiveSessionsCount(userId: string): Promise<number> {
    try {
      const redisClient = await getRedisClient(); // Get client on demand


      const sessionKeys = await redisClient.sMembers(
        `${this.USER_SESSIONS_PREFIX}${userId}`
      );

      let activeCount = 0;

      for (const sessionKey of sessionKeys) {
        const exists = await redisClient.exists(sessionKey);
        if (exists) {
          activeCount++;
        } else {
          // Clean up expired session
          await redisClient.sRem(
            `${this.USER_SESSIONS_PREFIX}${userId}`,
            sessionKey
          );
        }
      }

      return activeCount;
    } catch (error: any) {
      throw new Error(`Error getting active sessions count: ${error.message}`);
    }
  }
}

export default new SessionService();