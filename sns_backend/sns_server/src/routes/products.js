import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../controllers/product/category.js";
import {
  createProduct,
  getProductById,
  getProducts,
  getUfdProducts,
  updateProduct,
} from "../controllers/product/product.js";
import { requireRole } from "../middleware/auth.js";

export default async function productRoutes(fastify) {
  fastify.get("/categories", getCategories);
  fastify.get("/categories/:id", getCategoryById);
  fastify.post("/categories", { preValidation: [requireRole("Admin")] }, createCategory);
  fastify.patch("/categories/:id", { preValidation: [requireRole("Admin")] }, updateCategory);
  fastify.get("/products", getProducts);
  fastify.get("/products/ufd", getUfdProducts);
  fastify.get("/products/:id", getProductById);
  fastify.post("/products", { preValidation: [requireRole("Admin")] }, createProduct);
  fastify.patch("/products/:id", { preValidation: [requireRole("Admin")] }, updateProduct);
}
