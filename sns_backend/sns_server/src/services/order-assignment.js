import mongoose from "mongoose";
import Order from "../models/order.js";
import { Buddy } from "../models/user.js";
import {
  releaseInventoryReservation,
  reserveInventoryForOrder,
} from "./fulfillment.js";
import { OrderLifecycleError } from "./order-lifecycle.js";

const orderItems = (order) =>
  order.items.map((item) => ({ product: item.product, quantity: item.quantity }));

const releaseBuddyReservation = async (buddyId, order) =>
  releaseInventoryReservation(buddyId, order._id, orderItems(order));

const finishPendingAssignment = async (order) => {
  const { fromBuddy, toBuddy, state } = order.reassignment;
  if (state === "requested") {
    await releaseBuddyReservation(toBuddy, order);
    await reserveInventoryForOrder(toBuddy, order._id, orderItems(order));
    order = await Order.findOneAndUpdate(
      { _id: order._id, "reassignment.state": "requested" },
      {
        $set: {
          buddy: toBuddy,
          pickupLocation: {
            ...(await Buddy.findById(toBuddy).select("location address").lean()).location,
            address: (await Buddy.findById(toBuddy).select("address").lean()).address,
          },
          "reassignment.state": "new_reserved",
        },
      },
      { new: true }
    );
    if (!order) throw new OrderLifecycleError("Reassignment changed concurrently.");
  }
  await releaseBuddyReservation(fromBuddy, order);
  return Order.findOneAndUpdate(
    { _id: order._id, "reassignment.state": "new_reserved" },
    { $unset: { reassignment: 1 } },
    { new: true }
  );
};

export const assignOrderToBuddy = async ({ orderId, buddyId }) => {
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(buddyId)) {
    throw new OrderLifecycleError("Valid order ID and Buddy ID are required.", 400);
  }
  const [order, buddy] = await Promise.all([
    Order.findById(orderId),
    Buddy.findOne({
      _id: buddyId,
      isApproved: true,
      isActive: true,
      isAvailable: true,
    }),
  ]);
  if (!order) throw new OrderLifecycleError("Order not found.", 404);
  if (!buddy) throw new OrderLifecycleError("Eligible Buddy not found.", 404);
  if (
    order.status !== "pending" ||
    order.inventoryState !== "reserved" ||
    order.reassignment?.state
  ) {
    throw new OrderLifecycleError("Only pending, reserved orders can be reassigned.");
  }
  if (String(order.buddy) === String(buddy._id)) return order;

  const intent = await Order.findOneAndUpdate(
    {
      _id: order._id,
      buddy: order.buddy,
      status: "pending",
      inventoryState: "reserved",
      "reassignment.state": { $exists: false },
    },
    {
      $set: {
        reassignment: {
          fromBuddy: order.buddy,
          toBuddy: buddy._id,
          state: "requested",
        },
      },
    },
    { new: true }
  );
  if (!intent) throw new OrderLifecycleError("Order changed concurrently; refresh and retry.");

  try {
    await reserveInventoryForOrder(buddy._id, intent._id, orderItems(intent));
    const moved = await Order.findOneAndUpdate(
      { _id: intent._id, "reassignment.state": "requested" },
      {
        $set: {
          buddy: buddy._id,
          pickupLocation: {
            latitude: buddy.location?.latitude,
            longitude: buddy.location?.longitude,
            address: buddy.address,
          },
          "reassignment.state": "new_reserved",
        },
      },
      { new: true }
    );
    if (!moved) throw new OrderLifecycleError("Order changed concurrently during reassignment.");
    await releaseBuddyReservation(intent.reassignment.fromBuddy, moved);
    return Order.findOneAndUpdate(
      { _id: moved._id, "reassignment.state": "new_reserved" },
      { $unset: { reassignment: 1 } },
      { new: true }
    );
  } catch (error) {
    const current = await Order.findById(intent._id);
    if (current?.reassignment?.state === "requested") {
      await releaseBuddyReservation(buddy._id, current);
      await Order.updateOne(
        { _id: current._id, "reassignment.state": "requested" },
        { $unset: { reassignment: 1 } }
      );
    }
    throw error;
  }
};

export const recoverPendingOrderAssignments = async () => {
  const pending = await Order.find({
    "reassignment.state": { $in: ["requested", "new_reserved"] },
  });
  for (const order of pending) {
    if (order.reassignment.state === "requested") {
      try {
        await finishPendingAssignment(order);
      } catch (error) {
        await releaseBuddyReservation(order.reassignment.toBuddy, order);
        await Order.updateOne(
          { _id: order._id, "reassignment.state": "requested" },
          { $unset: { reassignment: 1 } }
        );
      }
    } else {
      await finishPendingAssignment(order);
    }
  }
};
