import {
  getBuddyInventory,
  updateOwnInventory,
  updateBuddyAvailability,
} from "../controllers/buddy/buddy.js";
import { requireRole } from "../middleware/auth.js";

export default async function buddyRoutes(fastify) {
  fastify.get("/buddies/me/inventory", { preValidation: [requireRole("Buddy")] }, getBuddyInventory);
  fastify.patch("/buddies/me/inventory", { preValidation: [requireRole("Buddy")] }, updateOwnInventory);
  fastify.patch("/buddies/me", { preValidation: [requireRole("Buddy")] }, updateBuddyAvailability);
}
