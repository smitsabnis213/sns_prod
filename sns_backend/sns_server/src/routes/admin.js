import {
  createBuddy,
  getBuddyInventory,
  listBuddies,
  setInventoryStock,
  updateBuddyApproval,
} from "../controllers/buddy/buddy.js";
import { requireRole } from "../middleware/auth.js";

export default async function adminRoutes(fastify) {
  const adminOnly = { preValidation: [requireRole("Admin")] };
  fastify.get("/api/admin/buddies", adminOnly, listBuddies);
  fastify.post("/api/admin/buddies", adminOnly, createBuddy);
  fastify.patch("/api/admin/buddies/:id/status", adminOnly, updateBuddyApproval);
  fastify.get("/api/admin/inventory", adminOnly, getBuddyInventory);
  fastify.put("/api/admin/inventory", adminOnly, setInventoryStock);
}
