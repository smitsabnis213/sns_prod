import {
  getCurrentUser,
  loginAdmin,
  loginBuddy,
  loginCustomer,
  refreshToken,
} from "../controllers/auth/auth.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export default async function authRoutes(fastify) {
  fastify.post("/auth/login", loginCustomer);
  fastify.post("/auth/customer/login", loginCustomer);
  fastify.post("/auth/buddy/login", loginBuddy);
  fastify.post("/auth/login-delivery-partner", loginBuddy);
  fastify.post("/auth/admin/login", loginAdmin);
  fastify.post("/auth/refresh", refreshToken);
  fastify.get("/auth/me", { preValidation: [requireAuth] }, getCurrentUser);
  fastify.patch(
    "/auth/me",
    { preValidation: [requireRole("Customer")] },
    async (request, reply) => {
      const allowed = {};
      for (const field of ["name", "address", "liveLocation", "savedLocations"]) {
        if (Object.hasOwn(request.body || {}, field)) allowed[field] = request.body[field];
      }
      try {
        const customer = await request.user.account.constructor.findByIdAndUpdate(
          request.user.id,
          { $set: allowed },
          { new: true, runValidators: true }
        );
        if (!customer) return reply.code(404).send({ message: "Customer not found." });
        const user = customer.toObject();
        delete user.__v;
        return reply.send({ user });
      } catch (error) {
        if (error.name === "ValidationError") {
          return reply.code(400).send({ message: "Invalid profile data." });
        }
        request.log.error(error);
        return reply.code(500).send({ message: "Unable to update profile." });
      }
    }
  );
}
