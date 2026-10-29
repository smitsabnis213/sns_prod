import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDB, disconnectDB } from "../src/config/connect.js";
import { Admin } from "../src/models/user.js";

try {
  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim();
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!name || !email || !password || password.length < 12) {
    throw new Error(
      "Set ADMIN_BOOTSTRAP_NAME, ADMIN_BOOTSTRAP_EMAIL, and ADMIN_BOOTSTRAP_PASSWORD (12+ characters) before running this command."
    );
  }

  await connectDB();
  if (await Admin.exists({ email })) {
    throw new Error(`An administrator with email ${email} already exists; no account was changed.`);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ name, email, passwordHash, role: "Admin", isActive: true });
  console.log(`Administrator ${email} created.`);
} catch (error) {
  console.error("Admin bootstrap failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
