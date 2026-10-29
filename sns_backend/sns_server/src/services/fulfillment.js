import { Buddy } from "../models/user.js";
import Inventory from "../models/inventory.js";

export const isValidCoordinates = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export const parseCoordinates = (latitude, longitude) => {
  const parse = (value) =>
    typeof value === "number" ||
    (typeof value === "string" && value.trim().length > 0)
      ? Number(value)
      : Number.NaN;
  return { latitude: parse(latitude), longitude: parse(longitude) };
};

export const distanceKm = (a, b) => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export const findNearestBuddy = async (coordinates) => {
  if (!isValidCoordinates(coordinates?.latitude, coordinates?.longitude)) return null;
  const buddies = await Buddy.find({
    isApproved: true,
    isActive: true,
    isAvailable: true,
    "location.latitude": { $exists: true },
    "location.longitude": { $exists: true },
  }).lean();
  const candidates = buddies
    .filter((buddy) =>
      isValidCoordinates(buddy.location?.latitude, buddy.location?.longitude)
    )
    .map((buddy) => ({
      buddy,
      distanceKm: distanceKm(coordinates, buddy.location),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm);
  return candidates[0] || null;
};

export const findEligibleBuddiesForBasket = async (coordinates, items) => {
  if (!isValidCoordinates(coordinates?.latitude, coordinates?.longitude)) return null;
  if (!items.length) return [];

  const buddies = await Buddy.find({
    isApproved: true,
    isActive: true,
    isAvailable: true,
    "location.latitude": { $exists: true },
    "location.longitude": { $exists: true },
  }).lean();
  const productIds = items.map((item) => item.product);
  const inventory = await Inventory.find({
    buddy: { $in: buddies.map((buddy) => buddy._id) },
    product: { $in: productIds },
    isActive: true,
  }).lean();
  const stocks = new Map(
    inventory.map((entry) => [
      `${entry.buddy}:${entry.product}`,
      entry.availableQuantity,
    ])
  );
  return buddies
    .filter((buddy) => isValidCoordinates(buddy.location?.latitude, buddy.location?.longitude))
    .filter((buddy) =>
      items.every(
        (item) =>
          (stocks.get(`${buddy._id}:${item.product}`) || 0) >= item.quantity
      )
    )
    .map((buddy) => ({
      buddy,
      distanceKm: distanceKm(coordinates, buddy.location),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm);
};

export const findNearestBuddyForBasket = async (coordinates, items) => {
  const eligible = await findEligibleBuddiesForBasket(coordinates, items);
  return eligible?.[0] || null;
};

export const reserveInventoryForOrder = async (buddyId, orderId, items) => {
  const reserved = [];
  try {
    for (const item of items) {
      const update = await Inventory.findOneAndUpdate(
        {
          buddy: buddyId,
          product: item.product,
          isActive: true,
          availableQuantity: { $gte: item.quantity },
          "reservations.order": { $ne: orderId },
        },
        {
          $inc: {
            availableQuantity: -item.quantity,
            reservedQuantity: item.quantity,
          },
          $push: {
            reservations: {
              order: orderId,
              quantity: item.quantity,
              state: "reserved",
            },
          },
        },
        { new: true }
      );
      if (!update) {
        throw new Error(`Insufficient or unavailable stock for product ${item.product}.`);
      }
      reserved.push(item);
    }
  } catch (error) {
    await releaseInventoryReservation(buddyId, orderId, reserved);
    throw error;
  }
};

export const releaseInventoryReservation = async (buddyId, orderId, items) => {
  for (const item of items) {
    await Inventory.findOneAndUpdate(
      {
        buddy: buddyId,
        product: item.product,
        reservations: {
          $elemMatch: { order: orderId, state: "reserved" },
        },
      },
      {
        $inc: {
          availableQuantity: item.quantity,
          reservedQuantity: -item.quantity,
        },
        $set: { "reservations.$.state": "released" },
      }
    );
  }
};

export const consumeInventoryReservation = async (buddyId, orderId, items) => {
  for (const item of items) {
    await Inventory.findOneAndUpdate(
      {
        buddy: buddyId,
        product: item.product,
        reservations: {
          $elemMatch: { order: orderId, state: "reserved" },
        },
      },
      {
        $inc: { reservedQuantity: -item.quantity },
        $set: { "reservations.$.state": "consumed" },
      }
    );
  }
};
