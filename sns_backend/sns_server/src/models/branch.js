import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: "Buddy" },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  address: { type: String },
  isActive: { type: Boolean, default: true },
  deliveryPartners: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buddy",
    },
  ],
  isBuddy: { type: Boolean, default: true },
});

const Branch = mongoose.model("Branch", branchSchema);
export default Branch;