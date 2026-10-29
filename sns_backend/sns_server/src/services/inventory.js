import mongoose from "mongoose";
import Inventory from "../models/inventory.js";
import Product from "../models/products.js";
import { Buddy } from "../models/user.js";

export class InventoryServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const setBuddyStock = async ({
  buddyId,
  productId,
  availableQuantity,
  isActive = true,
}) => {
  if (
    !mongoose.isValidObjectId(buddyId) ||
    !mongoose.isValidObjectId(productId) ||
    !Number.isSafeInteger(availableQuantity) ||
    availableQuantity < 0 ||
    typeof isActive !== "boolean"
  ) {
    throw new InventoryServiceError(
      "Buddy, product, and non-negative integer stock are required."
    );
  }
  const [buddy, product] = await Promise.all([
    Buddy.findById(buddyId),
    Product.findById(productId),
  ]);
  if (!buddy || !product) throw new InventoryServiceError("Buddy or product not found.", 404);

  return Inventory.findOneAndUpdate(
    { buddy: buddyId, product: productId },
    {
      $set: { availableQuantity, isActive },
      $setOnInsert: { reservedQuantity: 0 },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
};
