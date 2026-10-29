import mongoose from "mongoose";
import Inventory from "../../models/inventory.js";
import Product from "../../models/products.js";
import { findNearestBuddy, isValidCoordinates, parseCoordinates } from "../../services/fulfillment.js";

const allowedFields = ["name", "image", "price", "discountPrice", "quantity", "category", "isActive"];
const productFields = (body = {}) => Object.fromEntries(
  allowedFields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]])
);

export const getProducts = async (request, reply) => {
  const filter = { isActive: true };
  if (request.query.categoryId) {
    if (!mongoose.isValidObjectId(request.query.categoryId)) {
      return reply.code(400).send({ message: "A valid category ID is required." });
    }
    filter.category = request.query.categoryId;
  }
  const products = await Product.find(filter).populate("category", "name image").sort({ name: 1 }).lean();
  return reply.send({ products });
};

export const getProductById = async (request, reply) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return reply.code(400).send({ message: "A valid product ID is required." });
  }
  const product = await Product.findOne({ _id: request.params.id, isActive: true })
    .populate("category", "name image")
    .lean();
  if (!product) return reply.code(404).send({ message: "Product not found." });
  return reply.send({ product });
};

export const getUfdProducts = async (request, reply) => {
  const point = parseCoordinates(request.query.latitude, request.query.longitude);
  if (!isValidCoordinates(point.latitude, point.longitude)) {
    return reply.code(400).send({ message: "Valid latitude and longitude are required." });
  }
  const nearest = await findNearestBuddy(point);
  if (!nearest) return reply.code(404).send({ message: "UFD is not available around this location." });

  const inventory = await Inventory.find({
    buddy: nearest.buddy._id,
    isActive: true,
    availableQuantity: { $gt: 0 },
  }).lean();
  const quantities = new Map(inventory.map((row) => [String(row.product), row.availableQuantity]));
  const products = await Product.find({
    _id: { $in: inventory.map((row) => row.product) },
    isActive: true,
  }).populate("category", "name image").sort({ name: 1 }).lean();

  return reply.send({
    buddy: {
      id: String(nearest.buddy._id),
      name: nearest.buddy.name,
      location: nearest.buddy.location,
      distanceKm: nearest.distanceKm,
    },
    products: products.map((product) => ({
      ...product,
      availableQuantity: quantities.get(String(product._id)),
    })),
  });
};

export const createProduct = async (request, reply) => {
  const payload = productFields(request.body);
  if (!payload.name || !payload.image || !payload.quantity || !payload.category) {
    return reply.code(400).send({ message: "Product name, image, price, quantity, and category are required." });
  }
  if (!mongoose.isValidObjectId(payload.category)) {
    return reply.code(400).send({ message: "A valid product category is required." });
  }
  try {
    const product = await Product.create(payload);
    await product.populate("category", "name image");
    return reply.code(201).send({ product });
  } catch (error) {
    if (error.name === "ValidationError") return reply.code(400).send({ message: "Invalid product data." });
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to create product." });
  }
};

export const updateProduct = async (request, reply) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return reply.code(400).send({ message: "A valid product ID is required." });
  }
  const payload = productFields(request.body);
  if (payload.category && !mongoose.isValidObjectId(payload.category)) {
    return reply.code(400).send({ message: "A valid product category is required." });
  }
  try {
    const product = await Product.findByIdAndUpdate(
      request.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    ).populate("category", "name image");
    if (!product) return reply.code(404).send({ message: "Product not found." });
    return reply.send({ product });
  } catch (error) {
    if (error.name === "ValidationError") return reply.code(400).send({ message: "Invalid product data." });
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to update product." });
  }
};
