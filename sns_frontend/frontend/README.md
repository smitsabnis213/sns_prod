# Buddyyaa frontend

Responsive React + TypeScript storefront and Buddy fulfillment portal for Buddyyaa. The site consumes the separate Buddyyaa backend; it does not contain a mock catalogue, inventory, order history, or administrator dashboard.

## Run locally

From a clean checkout of the supplied `sns_prod` repository, start MongoDB and run the backend in a PowerShell terminal:

```powershell
Set-Location sns_backend\sns_server
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev
```

Set the backend's `MONGO_URI`, JWT secrets, `ADMIN_SESSION_SECRET`, and `CLIENT_ORIGIN=http://localhost:5173` in its `.env`. For local customer phone login only, use a non-production environment and explicitly set `CUSTOMER_DEV_LOGIN=true`; this is not OTP authentication.

In another PowerShell terminal, configure and run the frontend:

```powershell
Set-Location sns_frontend\frontend
if (-not (Test-Path .env.development)) { Copy-Item .env.example .env.development }
# Set VITE_API_BASE_URL=http://localhost:3000 and VITE_ADMIN_PANEL_URL=http://localhost:3000/admin in .env.development.
npm install
npm run dev
```

Local `.env` files are ignored and must not be committed. The frontend and backend remain separate processes. Frontend verification commands are:

```powershell
npm test
npm run build
npm run preview
```

The production build is written to `frontend/dist/`.

## Configure the backend

The client follows the checked-in `sns_backend/sns_server/API.md`, route registrations, models, services, and integration-test payloads. Request construction and response normalization are centralized in `src/services/api.ts`.

| Operation | Route used by the frontend | Current payload/response expectation |
|---|---|---|
| Customer login | `POST /auth/customer/login` | `{ phone }`; login is explicitly marked as development-only and not OTP-verified |
| Buddy login | `POST /auth/buddy/login` | `{ email, password }`; requires an approved and active Buddy |
| Refresh/current user | `POST /auth/refresh`, `GET /auth/me` | `{ refreshToken }`; login and refresh return access and refresh JWTs; `/me` returns `{ user }` |
| Catalogue/categories | `GET /products`, `GET /categories` | `{ products: [...] }` and `{ categories: [...] }`; product fields include `image`, `quantity`, `discountPrice`, and populated `category` |
| UFD catalogue | `GET /products/ufd?latitude=…&longitude=…` | JSON includes the one selected Buddy and its products |
| Create order | `POST /orders/create` | `{ deliveryType: "UFD" \| "NORMAL", items: [{ productId, quantity }], deliveryLocation: { latitude, longitude, address }, selectedBuddyId?, idempotencyKey? }`; server returns `{ order }` with `totalPrice`, `orderId`, and assigned Buddy |
| Customer/Buddy orders | `GET /orders`, `GET /orders/:id`, `GET /orders/:id/tracking` | The authenticated backend scopes order access; the frontend displays persisted status |
| Buddy acceptance/status/location | `POST /orders/confirm`, `PATCH /orders/:id/status`, `PATCH /orders/:id/location` | `{ orderId }`, `{ status }`, and `{ latitude, longitude }`; valid lifecycle transitions are mirrored from `src/services/order-lifecycle.js` and are still enforced by the backend |
| Buddy inventory | `GET /buddies/me/inventory`, `PATCH /buddies/me/inventory` | Buddy sees own stock and can update the available quantity of an existing active inventory row; reserved units and reservation records are not editable |
| Profile | `PATCH /auth/me` | `{ name, address, liveLocation?, savedLocations? }`; response is `{ user }` |

For NORMAL delivery omit `selectedBuddyId`; the backend selects one Buddy that can fulfill the complete basket. UFD sends the exact Buddy selected by the location-based catalogue, and the backend rejects stale/unavailable stock instead of reassigning. The frontend submits only product IDs, quantities, delivery coordinates/address, and the idempotency key. Backend pricing, stock, order assignment, and authorization remain authoritative.

### Sessions and CORS

The frontend keeps the access token in memory and the backend-issued refresh token in `sessionStorage` (tab-scoped) because this backend returns JWTs in JSON rather than setting a refresh cookie. It exchanges `{ refreshToken }` at `/auth/refresh`, refreshes the authenticated profile, and clears both tokens on sign-out/session expiry. A refresh token is sensitive: keep HTTPS enabled, deploy a restrictive Content Security Policy, and do not log or copy tokens. The backend currently exposes no refresh-token revocation/logout endpoint, so signing out clears this browser's session only.

`app.js` restricts REST and Socket.IO CORS to the exact comma-separated origins in backend `CLIENT_ORIGIN`; do not use `*`. For production, set this to the deployed website origin(s), e.g. `https://shop.example.com`, and restart the backend. The frontend sends bearer authorization and JSON; allow `GET`, `POST`, `PATCH`, `PUT`, `OPTIONS` and `Accept`, `Authorization`, `Content-Type`, and `Idempotency-Key`.

### Realtime contract

`src/services/realtime.ts` uses the backend's literal Socket.IO contract: `auth.token`, `order:join` with `{ orderId }` and acknowledgement, and authorized-room listeners for `order:status`, `order:assignment`, and `delivery:location`. The socket reconnects and re-joins the order room; each event triggers a persisted API refresh. The backend authorizes room access against the customer, assigned Buddy, or Admin identity. Set `VITE_SOCKET_URL` only when Socket.IO uses a different origin from the API.

The frontend never subscribes to global order broadcasts. Stop/cleanup disconnects the socket and removes handlers when leaving the tracking screen.

## Maps

Order previews use Leaflet and OpenStreetMap tiles with attribution. No private map key is needed for this default map. Browser geolocation requires HTTPS (localhost is the development exception) and explicit user permission. Location sharing starts only when a Buddy chooses it for a non-final assigned order, sends genuine browser coordinates, and throttles updates to roughly 200 metres of movement. No route or ETA is fabricated. If replacing the tile provider, configure a public, origin-restricted browser key and follow that provider's usage policy.

## AdminJS

`/admin-access` is only an entry page. The backend mounts its authenticated AdminJS at `/admin`; local development uses `http://localhost:3000/admin`. Set `VITE_ADMIN_PANEL_URL` to the deployed backend's public AdminJS URL before building. AdminJS keeps its own session authentication; this frontend does not emulate its dashboard or expose admin APIs.

## Hostinger static deployment

1. Deploy the backend to a publicly reachable HTTPS origin and verify MongoDB readiness.
2. Set backend `CLIENT_ORIGIN` to the exact HTTPS website origin. Use independently generated production JWT and AdminJS secrets; never expose them to Vite.
3. Copy `.env.example` to `.env.production` and set `VITE_API_BASE_URL`, `VITE_ADMIN_PANEL_URL`, and (if needed) `VITE_SOCKET_URL` to their real public HTTPS URLs. These `VITE_*` settings are bundled into the public site; never put database credentials, JWT signing keys, refresh tokens, or AdminJS secrets here.
4. From `frontend/`, run `npm install`, `npm test`, and `npm run build`.
5. Upload the **contents** of `frontend/dist/` to the Hostinger site's document root (commonly `public_html/`), including the generated `.htaccess`.
6. The supplied Apache rules route client-side routes such as `/orders/:id` and `/buddy/orders/:id` to `index.html`, while leaving `/api`, `/admin`, `/adminjs`, and `/socket.io` to their own handlers. Keep the backend on its own host unless a reverse proxy is deliberately configured.
7. Enable HTTPS for the website and API. Browser geolocation and production AdminJS sessions require HTTPS.
8. Verify that products/categories load, place a NORMAL order and UFD order, and confirm the totals, Buddy assignment, and status are returned from the backend.
9. Test the configured AdminJS URL in a fresh browser session and verify its own login/permissions.
10. Allow location access and verify the map uses returned coordinates and persisted Buddy updates.
11. Verify authorized Socket.IO joins, reconnection, event delivery, and persisted-state refresh.

## Integration boundaries

Customer phone sign-in is an explicitly development-only convenience, not OTP authentication. No OTP provider or production customer registration flow is configured. Backend tests use an isolated temporary MongoDB server; they do not prove connectivity to a separately configured Atlas deployment. Add the backend host's authorized egress IP to the Atlas project's Network Access list (prefer a single-IP CIDR over a wildcard) and verify `/ready` before claiming the deployed API is ready.

Hostinger deployment is not performed by this project. A publicly reachable HTTPS backend origin, MongoDB, populated Buddy inventory, and production environment settings are required before launch.
