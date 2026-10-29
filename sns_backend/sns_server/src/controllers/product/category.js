import mongoose from "mongoose";
import Category from "../../models/category.js";

const allowedFields = ["name", "image", "isActive"];

function categoryFields(body = {}) {
  return Object.fromEntries(allowedFields
    .filter((field) => Object.hasOwn(body, field))
    .map((field) => [field, body[field]]));
}

export const getCategories = async (_request, reply) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
  return reply.send({ categories });
};

export const getCategoryById = async (request, reply) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return reply.code(400).send({ message: "A valid category ID is required." });
  }
  const category = await Category.findOne({ _id: request.params.id, isActive: true }).lean();
  if (!category) return reply.code(404).send({ message: "Category not found." });
  return reply.send({ category });
};

export const createCategory = async (request, reply) => {
  const payload = categoryFields(request.body);
  if (typeof payload.name !== "string" || !payload.name.trim() || typeof payload.image !== "string" || !payload.image.trim()) {
    return reply.code(400).send({ message: "Category name and image are required." });
  }
  try {
    const category = await Category.create({ ...payload, name: payload.name.trim(), image: payload.image.trim() });
    return reply.code(201).send({ category });
  } catch (error) {
    if (error.code === 11000) return reply.code(409).send({ message: "A category with this name already exists." });
    if (error.name === "ValidationError") return reply.code(400).send({ message: "Invalid category data." });
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to create category." });
  }
};

export const updateCategory = async (request, reply) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return reply.code(400).send({ message: "A valid category ID is required." });
  }
  try {
    const category = await Category.findByIdAndUpdate(
      request.params.id,
      { $set: categoryFields(request.body) },
      { new: true, runValidators: true }
    );
    if (!category) return reply.code(404).send({ message: "Category not found." });
    return reply.send({ category });
  } catch (error) {
    if (error.code === 11000) return reply.code(409).send({ message: "A category with this name already exists." });
    if (error.name === "ValidationError") return reply.code(400).send({ message: "Invalid category data." });
    request.log.error(error);
    return reply.code(500).send({ message: "Unable to update category." });
  }
};
