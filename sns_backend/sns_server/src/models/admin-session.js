import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    sid: { type: String, required: true, unique: true },
    session: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminSession =
  mongoose.models.AdminSession || mongoose.model("AdminSession", adminSessionSchema);
export default AdminSession;
