import mongoose from "mongoose";

const fulfillmentIssueSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    deliveryType: { type: String, enum: ["UFD", "NORMAL"], required: true },
    selectedBuddy: { type: mongoose.Schema.Types.ObjectId, ref: "Buddy" },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, min: 1 },
      },
    ],
    location: {
      latitude: Number,
      longitude: Number,
    },
    reason: { type: String, required: true, maxlength: 500 },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

const FulfillmentIssue =
  mongoose.models.FulfillmentIssue ||
  mongoose.model("FulfillmentIssue", fulfillmentIssueSchema);

export default FulfillmentIssue;
