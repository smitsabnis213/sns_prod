import mongoose from "mongoose";
import Order, { ORDER_STATUSES } from "../models/order.js";
import {
  consumeInventoryReservation,
  releaseInventoryReservation,
} from "./fulfillment.js";
import Inventory from "../models/inventory.js";

const transitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["arriving", "out_for_delivery", "cancelled"],
  arriving: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
  reserving: [],
};

const itemsForStock = (order) =>
  order.items.map((item) => ({ product: item.product, quantity: item.quantity }));

const applyInventoryCompletion = async (order) => {
  if (order.inventoryState !== "reserved") return order;
  if (order.status === "cancelled") {
    await releaseInventoryReservation(order.buddy, order._id, itemsForStock(order));
    return Order.findOneAndUpdate(
      { _id: order._id, inventoryState: "reserved" },
      { $set: { inventoryState: "released" } },
      { new: true }
    );
  }
  if (order.status === "delivered") {
    await consumeInventoryReservation(order.buddy, order._id, itemsForStock(order));
    return Order.findOneAndUpdate(
      { _id: order._id, inventoryState: "reserved" },
      { $set: { inventoryState: "consumed" } },
      { new: true }
    );
  }
  return order;
};

export class OrderLifecycleError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const transitionOrder = async ({ orderId, status, actorRole, actorId }) => {
  if (!mongoose.isValidObjectId(orderId) || !ORDER_STATUSES.includes(status)) {
    throw new OrderLifecycleError("Valid order ID and status are required.", 400);
  }
  let order = await Order.findById(orderId);
  if (!order) throw new OrderLifecycleError("Order not found.", 404);

  if (actorRole === "Buddy" && String(order.buddy) !== String(actorId)) {
    throw new OrderLifecycleError("This order belongs to another Buddy.", 403);
  }
  if (actorRole === "Customer") {
    if (String(order.customer) !== String(actorId) || status !== "cancelled") {
      throw new OrderLifecycleError("Customers may only cancel their own order.", 403);
    }
    if (order.status !== "pending") {
      throw new OrderLifecycleError("Only pending orders can be cancelled by the customer.");
    }
  }

  if (order.status !== status) {
    if (!transitions[order.status]?.includes(status)) {
      throw new OrderLifecycleError(
        `Order cannot transition from ${order.status} to ${status}.`
      );
    }
    const changed = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!changed) {
      throw new OrderLifecycleError("Order changed concurrently; refresh and retry.");
    }
    order = changed;
  }

  if (order.status === "cancelled" || order.status === "delivered") {
    order = await applyInventoryCompletion(order);
  }
  return order;
};

export const recoverIncompleteOrderReservations = async () => {
  const interrupted = await Order.find({ status: "reserving" });
  for (const order of interrupted) {
    const rows = await Inventory.find({
      buddy: order.buddy,
      reservations: { $elemMatch: { order: order._id, state: "reserved" } },
    }).lean();
    await releaseInventoryReservation(
      order.buddy,
      order._id,
      rows.map((row) => ({
        product: row.product,
        quantity: row.reservations.find(
          (reservation) =>
            String(reservation.order) === String(order._id) &&
            reservation.state === "reserved"
        )?.quantity,
      })).filter((item) => item.quantity)
    );
    await Order.deleteOne({ _id: order._id, status: "reserving" });
  }

  const terminal = await Order.find({
    status: { $in: ["cancelled", "delivered"] },
    inventoryState: "reserved",
  }).select("_id status");
  for (const order of terminal) {
    await transitionOrder({
      orderId: order._id,
      status: order.status,
      actorRole: "Admin",
      actorId: "startup-recovery",
    });
  }
};
