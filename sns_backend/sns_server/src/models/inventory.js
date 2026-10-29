import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    buddy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buddy",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    reservations: [
      {
        order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
        quantity: { type: Number, required: true, min: 1 },
        state: {
          type: String,
          enum: ["reserved", "released", "consumed"],
          default: "reserved",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

inventorySchema.index({ buddy: 1, product: 1 }, { unique: true });

const Inventory = mongoose.model("Inventory", inventorySchema);
export default Inventory;
