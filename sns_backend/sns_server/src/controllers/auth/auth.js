import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin, Buddy, Customer } from "../../models/user.js";
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  isProductionEnvironment,
} from "../../config/config.js";
import { issueTokens } from "../../middleware/auth.js";

const publicAccount = (account) => {
  const user = account.toObject ? account.toObject() : { ...account };
  delete user.passwordHash;
  delete user.__v;
  return user;
};

const sendTokens = (reply, account) => {
  const user = publicAccount(account);
  return reply.send({ ...issueTokens(account), user });
};

export const authenticateAdmin = async (email, password) => {
  if (typeof email !== "string" || typeof password !== "string") return null;
  const account = await Admin.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!account || !account.isActive || !(await bcrypt.compare(password, account.passwordHash))) return null;
  return { id: String(account._id), email: account.email, title: account.name };
};

export const loginCustomer = async (request, reply) => {
  if (isProductionEnvironment || process.env.CUSTOMER_DEV_LOGIN !== "true") {
    return reply.code(403).send({ message: "Customer phone login is not enabled. OTP authentication is required." });
  }
  const phone = typeof request.body?.phone === "string" ? request.body.phone.trim() : "";
  if (!/^[+()\d -]{8,20}$/.test(phone)) {
    return reply.code(400).send({ message: "A valid phone number is required." });
  }
  const normalizedPhone = phone.replace(/\s+/g, "");
  try {
    const account = await Customer.findOneAndUpdate(
      { phone: normalizedPhone },
      { $setOnInsert: { phone: normalizedPhone, isActive: true, isActivated: true } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (!account.isActive || account.isActivated === false) {
      return reply.code(403).send({ message: "This customer account is not active." });
    }
    return sendTokens(reply, account);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to sign in right now." });
  }
};

export const loginBuddy = async (request, reply) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!email || !password) return reply.code(400).send({ message: "Buddy email and password are required." });
  try {
    const account = await Buddy.findOne({ email }).select("+passwordHash");
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      return reply.code(401).send({ message: "Invalid email or password." });
    }
    if (!account.isApproved || !account.isActive) {
      return reply.code(403).send({ message: "This Buddy account is not approved or active." });
    }
    return sendTokens(reply, account);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to sign in right now." });
  }
};

export const loginAdmin = async (request, reply) => {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!email || !password) return reply.code(400).send({ message: "Administrator email and password are required." });
  try {
    const account = await Admin.findOne({ email }).select("+passwordHash");
    if (!account || !account.isActive || !(await bcrypt.compare(password, account.passwordHash))) {
      return reply.code(401).send({ message: "Invalid administrator credentials." });
    }
    return sendTokens(reply, account);
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to sign in right now." });
  }
};

export const refreshToken = async (request, reply) => {
  const token = request.body?.refreshToken;
  if (typeof token !== "string" || !token) {
    return reply.code(401).send({ message: "A valid refresh token is required." });
  }
  try {
    const claims = jwt.verify(token, REFRESH_TOKEN_SECRET, {
      issuer: "buddyyaa-api",
      audience: "buddyyaa-client",
    });
    const model = { Customer, Buddy, Admin }[claims.role];
    if (!model || claims.tokenUse !== "refresh") {
      return reply.code(401).send({ message: "Invalid refresh token." });
    }
    const account = await model.findById(claims.sub);
    if (!account || account.isActive === false || account.isApproved === false || account.isActivated === false) {
      return reply.code(401).send({ message: "This account is unavailable." });
    }
    return sendTokens(reply, account);
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return reply.code(401).send({ message: "Refresh token is invalid or expired." });
    }
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to refresh this session." });
  }
};

export const getCurrentUser = async (request, reply) =>
  reply.send({ user: publicAccount(request.user.account) });

export { ACCESS_TOKEN_SECRET };
