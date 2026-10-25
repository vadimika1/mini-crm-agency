import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { AppError } from "../../lib/errors.js";
import { verifyPassword } from "../../lib/password.js";
import { parseDurationToMs } from "../../lib/time.js";
import { env } from "../../config/env.js";

type LoginResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    roles: string[];
  };
};

type RefreshTokenPayload = {
  userId: number;
  email: string;
  fullName: string;
  roles: string[];
  jti: string;
  tokenType: "refresh";
};

function parseRefreshToken(token: string): RefreshTokenPayload {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError(401, "invalid_refresh_token", "Refresh-токен недействителен или истек");
  }

  if (typeof decoded === "string") {
    throw new AppError(401, "invalid_refresh_token", "Refresh-токен недействителен или истек");
  }

  const payload = decoded as JwtPayload;
  if (
    typeof payload.userId !== "number" ||
    typeof payload.email !== "string" ||
    typeof payload.fullName !== "string" ||
    !Array.isArray(payload.roles) ||
    payload.roles.some((role) => typeof role !== "string") ||
    typeof payload.jti !== "string" ||
    payload.tokenType !== "refresh"
  ) {
    throw new AppError(401, "invalid_refresh_token", "Refresh-токен недействителен или истек");
  }

  return payload as unknown as RefreshTokenPayload;
}

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.app.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new AppError(401, "invalid_credentials", "Неверный email или пароль");
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, "invalid_credentials", "Неверный email или пароль");
    }

    const roles = user.userRoles.map((entry) => entry.role.code);
    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roles
    };

    const accessToken = this.app.jwt.sign(payload, {
      expiresIn: env.JWT_ACCESS_TTL
    });

    const refreshJti = crypto.randomUUID();
    const refreshToken = jwt.sign(
      {
        ...payload,
        jti: refreshJti,
        tokenType: "refresh"
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"] }
    );

    await this.app.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti: refreshJti,
        expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_TTL))
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_TTL,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles
      }
    };
  }

  async refresh(rawRefreshToken: string): Promise<LoginResult> {
    const decoded = parseRefreshToken(rawRefreshToken);

    const storedToken = await this.app.prisma.refreshToken.findUnique({
      where: {
        jti: decoded.jti
      }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new AppError(401, "invalid_refresh_token", "Refresh-токен недействителен или истек");
    }

    const user = await this.app.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new AppError(401, "invalid_refresh_token", "Refresh-токен недействителен или истек");
    }

    await this.app.prisma.refreshToken.update({
      where: { jti: decoded.jti },
      data: { revokedAt: new Date() }
    });

    const roles = user.userRoles.map((entry) => entry.role.code);
    const payload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roles
    };

    const accessToken = this.app.jwt.sign(payload, {
      expiresIn: env.JWT_ACCESS_TTL
    });

    const refreshJti = crypto.randomUUID();
    const refreshToken = jwt.sign(
      {
        ...payload,
        jti: refreshJti,
        tokenType: "refresh"
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"] }
    );

    await this.app.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti: refreshJti,
        expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_TTL))
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_TTL,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles
      }
    };
  }

  async logout(userId: number, rawRefreshToken: string) {
    try {
      const decoded = parseRefreshToken(rawRefreshToken);

      if (decoded.jti && decoded.userId === userId) {
        await this.app.prisma.refreshToken.updateMany({
          where: {
            userId,
            jti: decoded.jti,
            revokedAt: null
          },
          data: {
            revokedAt: new Date()
          }
        });
      }
    } catch {
      // Keep logout idempotent.
    }

    return { success: true };
  }

  async me(userId: number) {
    const user = await this.app.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new AppError(404, "user_not_found", "Пользователь не найден");
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.userRoles.map((entry) => entry.role.code)
    };
  }
}
