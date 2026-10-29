import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = "http-e2e-access-secret-that-is-at-least-32-characters";
process.env.REFRESH_TOKEN_SECRET = "http-e2e-refresh-secret-that-is-at-least-32-characters";
process.env.ADMIN_SESSION_SECRET = "http-e2e-admin-session-secret-at-least-32-characters";
process.env.CUSTOMER_DEV_LOGIN = "true";
process.env.CLIENT_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173";

const { buildApp } = await import("../app.js");
const { Admin, Buddy } = await import("../src/models/user.js");
const Category = (await import("../src/models/category.js")).default;
const Inventory = (await import("../src/models/inventory.js")).default;
const Product = (await import("../src/models/products.js")).default;

const deliveryLocation = {
  latitude: 12.972,
  longitude: 77.5955,
  address: "HTTP test delivery address",
};

let mongoServer;
let app;
let baseUrl;
let fixture;

async function call(path, { method = "GET", token, body, rawBody, headers = {}, redirect } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    ...(redirect ? { redirect } : {}),
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : rawBody !== undefined ? { body: rawBody } : {}),
  });
  const text = await response.text();
  return {
    response,
    body: text
      ? response.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(text)
        : text
      : null,
  };
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  app = await buildApp({ mongoUri: mongoServer.getUri() });

  const category = await Category.create({
    name: "HTTP Test Produce",
    image: "https://example.test/category.png",
  });
  const [apples, bread] = await Product.create([
    {
      name: "HTTP Test Apples",
      image: "https://example.test/apples.png",
      category: category._id,
      quantity: "1 kg",
      price: 100,
      isActive: true,
    },
    {
      name: "HTTP Test Bread",
      image: "https://example.test/bread.png",
      category: category._id,
      quantity: "1 pack",
      price: 50,
      isActive: true,
    },
  ]);
  const passwordHash = await bcrypt.hash("buddy-password-123", 4);
  const [nearBuddy, fullBasketBuddy, inactiveBuddy] = await Buddy.create([
    {
      name: "HTTP Near Buddy",
      phone: "9000010001",
      email: "near-http@example.test",
      passwordHash,
      isApproved: true,
      isActive: true,
      isAvailable: true,
      location: { latitude: 12.9716, longitude: 77.5946 },
      address: "Near Buddy address",
    },
    {
      name: "HTTP Full Basket Buddy",
      phone: "9000010002",
      email: "full-http@example.test",
      passwordHash,
      isApproved: true,
      isActive: true,
      isAvailable: true,
      location: { latitude: 12.9735, longitude: 77.5975 },
      address: "Full basket Buddy address",
    },
    {
      name: "HTTP Inactive Buddy",
      phone: "9000010003",
      email: "inactive-http@example.test",
      passwordHash,
      isApproved: false,
      isActive: false,
      isAvailable: true,
      location: { latitude: 12.9717, longitude: 77.5947 },
      address: "Inactive Buddy address",
    },
  ]);
  await Inventory.create([
    { buddy: nearBuddy._id, product: apples._id, availableQuantity: 3 },
    { buddy: fullBasketBuddy._id, product: apples._id, availableQuantity: 8 },
    { buddy: fullBasketBuddy._id, product: bread._id, availableQuantity: 5 },
    { buddy: inactiveBuddy._id, product: apples._id, availableQuantity: 20 },
  ]);
  const admin = await Admin.create({
    name: "HTTP Test Admin",
    email: "admin-http@example.test",
    passwordHash: await bcrypt.hash("admin-password-123", 4),
  });

  fixture = { apples, bread, nearBuddy, fullBasketBuddy, admin };
  baseUrl = await app.listen({ host: "127.0.0.1", port: 0 });
});

test.after(async () => {
  if (app) await app.close();
  if (mongoServer) await mongoServer.stop();
});

test("live HTTP customer, Buddy, inventory, order, tracking, and AdminJS journey", async () => {
  const health = await call("/health", {
    headers: { origin: "http://127.0.0.1:5173" },
  });
  assert.equal(health.response.status, 200);
  assert.equal(health.body.database.connected, true);
  assert.equal(health.response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173");
  assert.deepEqual((await call("/ready")).body, {
    status: "ready",
    database: { connected: true },
  });
  assert.equal((await call("/", { headers: { origin: "https://untrusted.example" } })).response.status, 200);
  assert.equal((await call("/orders", {
    method: "OPTIONS",
    headers: { origin: "https://untrusted.example" },
  })).response.status, 403);

  const catalogue = await call("/products");
  assert.equal(catalogue.response.status, 200);
  assert.equal(catalogue.body.products.length, 2);
  assert.equal((await call("/categories")).response.status, 200);

  const login = await call("/auth/customer/login", {
    method: "POST",
    body: { phone: "+1 900 000 1000" },
  });
  assert.equal(login.response.status, 200);
  const customerToken = login.body.accessToken;
  assert.ok(customerToken);
  assert.equal((await call("/auth/customer/login", {
    method: "POST",
    body: { phone: "invalid" },
  })).response.status, 400);

  const ufdCatalogue = await call(
    `/products/ufd?latitude=${deliveryLocation.latitude}&longitude=${deliveryLocation.longitude}`,
  );
  assert.equal(ufdCatalogue.response.status, 200);
  assert.equal(ufdCatalogue.body.buddy.id, String(fixture.nearBuddy._id));
  assert.equal(ufdCatalogue.body.products[0].availableQuantity, 3);

  const ufdPayload = {
    deliveryType: "UFD",
    selectedBuddyId: String(fixture.nearBuddy._id),
    items: [{ productId: String(fixture.apples._id), quantity: 1 }],
    deliveryLocation,
    idempotencyKey: "http-ufd-same-payload",
  };
  const ufdOrder = await call("/orders/create", {
    method: "POST",
    token: customerToken,
    body: ufdPayload,
  });
  assert.equal(ufdOrder.response.status, 201);
  assert.equal(ufdOrder.body.order.buddy._id, String(fixture.nearBuddy._id));
  const duplicateUfdOrder = await call("/orders/create", {
    method: "POST",
    token: customerToken,
    body: ufdPayload,
  });
  assert.equal(duplicateUfdOrder.response.status, 200);
  assert.equal(duplicateUfdOrder.body.order._id, ufdOrder.body.order._id);
  assert.equal((await Inventory.findOne({
    buddy: fixture.nearBuddy._id,
    product: fixture.apples._id,
  })).availableQuantity, 2);
  assert.equal((await call("/orders/create", {
    method: "POST",
    token: customerToken,
    body: { ...ufdPayload, items: [{ productId: String(fixture.apples._id), quantity: 2 }] },
  })).response.status, 409);

  const normalOrder = await call("/orders/create", {
    method: "POST",
    token: customerToken,
    body: {
      deliveryType: "NORMAL",
      items: [
        { productId: String(fixture.apples._id), quantity: 2 },
        { productId: String(fixture.bread._id), quantity: 1 },
      ],
      deliveryLocation,
      idempotencyKey: "http-normal-basket",
    },
  });
  assert.equal(normalOrder.response.status, 201);
  assert.equal(normalOrder.body.order.buddy._id, String(fixture.fullBasketBuddy._id));
  const orderId = normalOrder.body.order._id;
  assert.equal((await call(`/orders/${orderId}`, { token: customerToken })).response.status, 200);

  const otherCustomer = await call("/auth/customer/login", {
    method: "POST",
    body: { phone: "+1 900 000 1001" },
  });
  assert.equal((await call(`/orders/${orderId}`, {
    token: otherCustomer.body.accessToken,
  })).response.status, 403);
  assert.equal((await call(`/orders/${orderId}/status`, {
    method: "PATCH",
    token: customerToken,
    body: { status: "delivered" },
  })).response.status, 403);

  const failedBuddyLogin = await call("/auth/buddy/login", {
    method: "POST",
    body: { email: "inactive-http@example.test", password: "buddy-password-123" },
  });
  assert.equal(failedBuddyLogin.response.status, 403);
  const buddyLogin = await call("/auth/buddy/login", {
    method: "POST",
    body: { email: "full-http@example.test", password: "buddy-password-123" },
  });
  assert.equal(buddyLogin.response.status, 200);
  const buddyToken = buddyLogin.body.accessToken;
  assert.equal((await call(`/orders/${orderId}/status`, {
    method: "PATCH",
    token: buddyToken,
    body: { status: "delivered" },
  })).response.status, 409);
  const buddyOrders = await call("/orders", { token: buddyToken });
  assert.deepEqual(buddyOrders.body.orders.map((order) => order._id), [orderId]);
  assert.equal((await call(`/orders/${ufdOrder.body.order._id}`, {
    token: buddyToken,
  })).response.status, 403);

  const stockUpdate = await call("/buddies/me/inventory", {
    method: "PATCH",
    token: buddyToken,
    body: {
      buddyId: String(fixture.nearBuddy._id),
      productId: String(fixture.bread._id),
      availableQuantity: 4,
    },
  });
  assert.equal(stockUpdate.response.status, 200);
  assert.equal(stockUpdate.body.inventory.buddy, String(fixture.fullBasketBuddy._id));
  assert.equal(stockUpdate.body.inventory.availableQuantity, 4);
  assert.equal(stockUpdate.body.inventory.reservedQuantity, 1);
  assert.equal((await call("/buddies/me/inventory", { token: buddyToken })).body.inventory.length, 2);

  const accept = await call("/orders/confirm", {
    method: "POST",
    token: buddyToken,
    body: { orderId },
  });
  assert.equal(accept.response.status, 200);
  for (const status of ["preparing"]) {
    const changed = await call(`/orders/${orderId}/status`, {
      method: "PATCH",
      token: buddyToken,
      body: { status },
    });
    assert.equal(changed.response.status, 200, `could not transition to ${status}`);
  }
  const locationUpdate = await call(`/orders/${orderId}/location`, {
    method: "PATCH",
    token: buddyToken,
    body: { latitude: 12.974, longitude: 77.599 },
  });
  assert.equal(locationUpdate.response.status, 200);
  const persistedLocation = await call(`/orders/${orderId}/tracking`, { token: customerToken });
  assert.deepEqual(persistedLocation.body.tracking.deliveryPersonLocation, {
    latitude: 12.974,
    longitude: 77.599,
  });
  for (const status of ["arriving", "out_for_delivery", "delivered"]) {
    const changed = await call(`/orders/${orderId}/status`, {
      method: "PATCH",
      token: buddyToken,
      body: { status },
    });
    assert.equal(changed.response.status, 200, `could not transition to ${status}`);
  }
  assert.equal((await call(`/orders/${orderId}/location`, {
    method: "PATCH",
    token: buddyToken,
    body: { latitude: 12.974, longitude: 77.599 },
  })).response.status, 404);

  const tracking = await call(`/orders/${orderId}/tracking`, { token: customerToken });
  assert.equal(tracking.response.status, 200);
  assert.equal(tracking.body.tracking.status, "delivered");
  const history = await call("/orders", { token: customerToken });
  assert.equal(history.body.orders.length, 2);

  const cancelled = await call(`/orders/${ufdOrder.body.order._id}/status`, {
    method: "PATCH",
    token: customerToken,
    body: { status: "cancelled" },
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal((await Inventory.findOne({
    buddy: fixture.nearBuddy._id,
    product: fixture.apples._id,
  })).availableQuantity, 3);

  const adminLogin = await call("/auth/admin/login", {
    method: "POST",
    body: { email: "admin-http@example.test", password: "wrong-password" },
  });
  assert.equal(adminLogin.response.status, 401);
  const validAdminLogin = await call("/auth/admin/login", {
    method: "POST",
    body: { email: "admin-http@example.test", password: "admin-password-123" },
  });
  assert.equal(validAdminLogin.response.status, 200);
  assert.equal((await call("/api/admin/buddies", {
    token: validAdminLogin.body.accessToken,
  })).response.status, 200);
  const panelLogin = await call("/admin/login");
  assert.equal(panelLogin.response.status, 200);
  const panelSession = await call("/admin/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    rawBody: new URLSearchParams({
      email: "admin-http@example.test",
      password: "admin-password-123",
    }).toString(),
    redirect: "manual",
  });
  assert.ok([302, 303].includes(panelSession.response.status));
  const cookie = panelSession.response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("buddyyaa-admin="));
  assert.equal((await call("/admin", { headers: { cookie } })).response.status, 200);
  assert.ok(mongoose.connection.readyState === 1);
});
