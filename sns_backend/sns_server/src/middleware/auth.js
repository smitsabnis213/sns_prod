import jwt from "jsonwebtoken";
import { Admin, Buddy, Customer } from "../models/user.js";
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
} from "../config/config.js";

const modelsByRole = { Customer, Buddy, Admin };

export const issueTokens = (account) => {
  const claims = { sub: String(account._id), role: account.role };
  return {
    accessToken: jwt.sign(claims, ACCESS_TOKEN_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
      issuer: "buddyyaa-api",
      audience: "buddyyaa-client",
    }),
    refreshToken: jwt.sign({ ...claims, tokenUse: "refresh" }, REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_TTL || "30d",
      issuer: "buddyyaa-api",
      audience: "buddyyaa-client",
    }),
  };
};

export const requireAuth = async (request, reply) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({ message: "Authentication required." });
  }

  let claims;
  try {
    claims = jwt.verify(header.slice(7), ACCESS_TOKEN_SECRET, {
      issuer: "buddyyaa-api",
      audience: "buddyyaa-client",
    });
    if (claims.tokenUse === "refresh" || !modelsByRole[claims.role]) {
      return reply.code(401).send({ message: "Invalid access token." });
    }
  } catch {
    return reply.code(401).send({ message: "Invalid or expired access token." });
  }
  try {
    const model = modelsByRole[claims.role];
    const account = await model.findById(claims.sub);
    if (!account || account.isActive === false || account.isApproved === false) {
      return reply.code(401).send({ message: "Account is unavailable." });
    }

    request.user = {
      id: String(account._id),
      role: account.role,
      account,
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to validate authentication." });
  }
};

export const requireRole = (...roles) => async (request, reply) => {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (!roles.includes(request.user.role)) {
    return reply.code(403).send({ message: "You are not permitted to perform this action." });
  }
};
