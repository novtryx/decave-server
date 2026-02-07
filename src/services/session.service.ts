import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import { Request } from "express";
import { SessionData } from "../types/service.type";
import { getRedisClient } from "../config/redis";

export class SessionService {
  private SESSION_PREFIX = "session:";
  private USER_SESSIONS_PREFIX = "user_sessions:";
  private SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

  // Singleton Redis client
  private redisClient: any;

  private async getClient() {
    if (!this.redisClient) {
      this.redisClient = await getRedisClient();
      if (!this.redisClient.isOpen) await this.redisClient.connect();
    }
    return this.redisClient;
  }

  // -----------------------------
  // Device & location utilities
  // -----------------------------
  private getDeviceInfo(userAgent: string) {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    return {
      browser: `${result.browser.name || "Unknown"} ${result.browser.version || ""}`.trim(),
      os: `${result.os.name || "Unknown"} ${result.os.version || ""}`.trim(),
      device: result.device.type || "Desktop",
    };
  }

  private getLocationFromIP(ip: string) {
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
    return { city: "Unknown", region: "Unknown", country: "Unknown", timezone: "Unknown" };
  }

  private getClientIP(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return (forwarded as string).split(",")[0].trim();
    const realIP = req.headers["x-real-ip"];
    if (realIP) return realIP as string;
    return req.ip || req.socket.remoteAddress || "Unknown";
  }

  // -----------------------------
  // Create a new session
  // -----------------------------
  async createSession(userId: string, email: string, token: string, req: Request): Promise<SessionData> {
    const redis = await this.getClient();

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

    const sessionId = `${this.SESSION_PREFIX}${userId}:${Date.now()}`;

    await redis.setEx(sessionId, this.SESSION_EXPIRY, JSON.stringify(sessionData));
    await redis.sAdd(`${this.USER_SESSIONS_PREFIX}${userId}`, sessionId);
    await redis.expire(`${this.USER_SESSIONS_PREFIX}${userId}`, this.SESSION_EXPIRY);

    return sessionData;
  }

  // -----------------------------
  // Get all user sessions
  // -----------------------------
  async getUserSessions(userId: string, currentToken?: string): Promise<SessionData[]> {
    const redis = await this.getClient();
    const sessionKeys = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
    const sessions: SessionData[] = [];

    if (!sessionKeys || sessionKeys.length === 0) return sessions;

    const pipeline = redis.multi();
    sessionKeys.forEach((key: string) => pipeline.get(key));
    const results = await pipeline.exec();

    for (let i = 0; i < sessionKeys.length; i++) {
      const data = results[i]?.[1];
      if (!data) {
        // Remove expired session
        await redis.sRem(`${this.USER_SESSIONS_PREFIX}${userId}`, sessionKeys[i]);
        continue;
      }
      const session: SessionData = JSON.parse(data);
      session.isCurrent = currentToken ? session.token === currentToken : false;
      sessions.push(session);
    }

    // Sort by lastActive descending
    return sessions.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
  }

  // -----------------------------
  // Verify and update session in one call
  // -----------------------------
  async verifyAndUpdateSession(userId: string, token: string): Promise<boolean> {
    const redis = await this.getClient();
    const sessionKeys = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);

    for (const key of sessionKeys) {
      const data = await redis.get(key);
      if (!data) {
        await redis.sRem(`${this.USER_SESSIONS_PREFIX}${userId}`, key);
        continue;
      }

      const session: SessionData = JSON.parse(data);
      if (session.token === token) {
        session.lastActive = new Date().toISOString();
        await redis.setEx(key, this.SESSION_EXPIRY, JSON.stringify(session));
        return true;
      }
    }

    return false;
  }

  // -----------------------------
  // Revoke specific session
  // -----------------------------
  async revokeSession(userId: string, token: string): Promise<boolean> {
    const redis = await this.getClient();
    const sessionKeys = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);

    for (const key of sessionKeys) {
      const data = await redis.get(key);
      if (!data) continue;
      const session: SessionData = JSON.parse(data);
      if (session.token === token) {
        await redis.del(key);
        await redis.sRem(`${this.USER_SESSIONS_PREFIX}${userId}`, key);
        return true;
      }
    }
    return false;
  }

  // -----------------------------
  // Revoke all other sessions except current
  // -----------------------------
  async revokeAllOtherSessions(userId: string, currentToken: string): Promise<number> {
    const redis = await this.getClient();
    const sessionKeys = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
    let revoked = 0;

    for (const key of sessionKeys) {
      const data = await redis.get(key);
      if (!data) continue;
      const session: SessionData = JSON.parse(data);
      if (session.token !== currentToken) {
        await redis.del(key);
        await redis.sRem(`${this.USER_SESSIONS_PREFIX}${userId}`, key);
        revoked++;
      }
    }
    return revoked;
  }

  // -----------------------------
  // Revoke all sessions
  // -----------------------------
  async revokeAllSessions(userId: string): Promise<number> {
    const redis = await this.getClient();
    const sessionKeys = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
    if (!sessionKeys) return 0;

    const pipeline = redis.multi();
    sessionKeys.forEach((key: any) => pipeline.del(key));
    pipeline.del(`${this.USER_SESSIONS_PREFIX}${userId}`);
    await pipeline.exec();

    return sessionKeys.length;
  }

  // -----------------------------
  // Get active sessions count
  // -----------------------------
  async getActiveSessionsCount(userId: string): Promise<number> {
    const redis = await this.getClient();
    const sessionKeys = await redis.sMembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
    if (!sessionKeys || sessionKeys.length === 0) return 0;

    const pipeline = redis.multi();
    sessionKeys.forEach((key: any) => pipeline.exists(key));
    const results = await pipeline.exec();

    let count = 0;
    for (const res of results) {
      if (res[1]) count++;
    }

    return count;
  }
}

export default new SessionService();
