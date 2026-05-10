# Plex API — Authentication Reference

> Extracted from `https://developer.plex.tv/pms/` (May 2026).
> The docs page is a Redoc SPA — WebFetch returns only a skeleton.
> To re-extract: `curl -s "https://developer.plex.tv/pms/" | python3 -c "import sys,html,re; c=sys.stdin.read(); idx=c.find('MARKER'); print(re.sub(r'<[^>]+>','',html.unescape(c[idx:idx+50000])))"`.

---

## X-Plex-* Request Headers

PMS accepts a variety of custom headers that follow the pattern `X-Plex-{name}`. All `X-Plex-*` headers can also be sent as query string arguments. `X-Plex-Client-Identifier` and `X-Plex-Token` are typically required.

| Header | Description | Sample |
|---|---|---|
| `X-Plex-Client-Identifier` | Opaque identifier unique to the client (UUID, stable per device) | `abc123` |
| `X-Plex-Token` | Authentication token obtained from plex.tv | `XXXXXXXXXXXX` |
| `X-Plex-Product` | Name of the client product | `Plex for Roku` |
| `X-Plex-Version` | Version of the client application | `2.4.1` |
| `X-Plex-Platform` | Platform of the client | `Roku` |
| `X-Plex-Platform-Version` | Version of the platform | `4.3 build 1057` |
| `X-Plex-Device` | Friendly name for the client device | `Roku 3` |
| `X-Plex-Model` | Less-friendly device model identifier | `4200X` |
| `X-Plex-Device-Vendor` | Device vendor | `Roku` |
| `X-Plex-Device-Name` | Friendly name for the client | `Living Room TV` |
| `X-Plex-Marketplace` | Marketplace where the client is distributed | `googlePlay` |

Non-ASCII values (e.g. in `X-Plex-Device-Name`): use UTF-8 where possible.

---

## Authentication

Most endpoints require token-based authentication via the `X-Plex-Token` header.
Plex supports two methods:

1. **JWT Authentication** (recommended for new apps) — tokens expire after 7 days, require an Ed25519 key pair per device.
2. **Legacy opaque token authentication** — tokens obtained from the old `plex.tv/api/v2/pins` flow; do not expire automatically.

---

## JWT Authentication (Recommended for New Apps)

Plex now supports JSON Web Token (JWT) authentication with better security,
7-day token rotation, individual device revocation, and Ed25519/RSA signatures.

Base URL: `https://clients.plex.tv/api/v2`

### Option 1: PIN Authentication Flow (for new apps without an existing token)

#### Step 1 — Generate a PIN with JWK

```
POST https://clients.plex.tv/api/v2/pins
X-Plex-Client-Identifier: your-device-identifier

{
  "jwk": {
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "your-public-key-data",
    "kid": "your-key-id",
    "alg": "EdDSA"
  },
  "strong": true
}
```

#### Step 2 — User Authentication

Construct the Auth App URL and have the user authenticate:

```
https://app.plex.tv/auth#?clientID=<clientIdentifier>&code=<pinCode>&context%5Bdevice%5D%5Bproduct%5D=My%20Cool%20Plex%20App&forwardUrl=https%3A%2F%2Fmy-cool-plex-app.com
```

For 4-digit PINs, use the link page: `https://plex.tv/link/?pin=<code>`

#### Step 3 — Exchange PIN for JWT Token

```
GET https://clients.plex.tv/api/v2/pins/<pinID>?deviceJWT=<signedJWT>
```

The signed JWT must include:
- `"aud": "plex.tv"`
- `"iss": "<clientIdentifier>"`
- `"kid"` and `"alg"` in the header

The response's `authToken` field contains the Plex JWT.

---

### Option 2: Register public key with existing legacy token (for existing apps)

```
POST https://clients.plex.tv/api/v2/auth/jwk
X-Plex-Client-Identifier: your-device-identifier
X-Plex-Token: your-existing-legacy-token

{
  "jwk": {
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "your-public-key-data",
    "kid": "your-key-id",
    "use": "sig",
    "alg": "EdDSA"
  }
}
```

After registering, follow the Token Refresh process below to get the first JWT.
The legacy token expires after this process completes.

---

### Token Refresh Process (every 7 days)

#### Step 1 — Get a Nonce

```
GET https://clients.plex.tv/api/v2/auth/nonce
X-Plex-Client-Identifier: your-device-identifier
```

Returns a nonce valid for **5 minutes**:
```json
{ "nonce": "7c415b56-8f48-488a-98ab-847ef4460442" }
```

#### Step 2 — Create a Device JWT

JWT header:
```json
{ "kid": "your-key-id", "alg": "EdDSA", "typ": "JWT" }
```

JWT payload:
```json
{
  "nonce": "7c415b56-8f48-488a-98ab-847ef4460442",
  "scope": "username,email,friendly_name",
  "aud": "plex.tv",
  "iss": "your-client-identifier",
  "iat": 1705785603,
  "exp": 1705789203
}
```

Scope values (comma-separated): `username`, `email`, `friendly_name`, `restricted`, `anonymous`, `joinedAt`

#### Step 3 — Exchange for Plex Token

```
POST https://clients.plex.tv/api/v2/auth/token
X-Plex-Client-Identifier: your-device-identifier

{ "jwt": "your-device-signed-jwt" }
```

Response — new Plex JWT valid for **7 days**:
```json
{ "auth_token": "eyJraWQ..." }
```

**JWT tokens expire after 7 days but can be refreshed at any time, including after expiration.**

---

### Using the JWT Token

Use it exactly like a legacy token in the `X-Plex-Token` header:

```
GET http://your-plex-server:32400/library/sections
X-Plex-Token: your-jwt-token
```

---

### Error Codes (JWT)

| HTTP Status | Meaning |
|---|---|
| `498` | Token Expired — refresh needed |
| `422` | Signature Verification Failed — invalid device signature or JWT structure |
| `422` | Thumbprint Already Taken — JWK already registered by another device |
| `400` | Bad Request — invalid format or missing fields |
| `429` | Too Many Requests — nonce requests are rate-limited |

**Troubleshooting:**
- Missing `kid` in JWT header → add it matching your registered JWK
- Invalid signature → verify private key matches registered public key
- Clock drift → JWT includes timestamp validation; keep device clock accurate
- Nonce expiry → nonces are valid 5 minutes; request a new one if yours expired

---

## Traditional Token Authentication (Legacy)

> **Note:** Legacy opaque tokens (obtained via this flow) do **not** expire automatically.
> Plex only migrates a device to JWT after it registers a JWK (Option 2 above).

### High-level Steps

1. Choose a unique app name (visible in user's Authorized Devices view).
2. Generate/store a stable `X-Plex-Client-Identifier` (UUID).
3. Check storage for an existing Access Token; verify validity with `GET https://plex.tv/api/v2/user`.
4. If no valid token: create a PIN, construct the Auth App URL, send user there.
5. Poll (or await redirect) on the PIN id until claimed; extract `authToken`.

### Verify Token Validity

```bash
curl -X GET https://plex.tv/api/v2/user \
  -H 'Accept: application/json' \
  -H 'X-Plex-Product: My Cool App' \
  -H 'X-Plex-Client-Identifier: <clientIdentifier>' \
  -H 'X-Plex-Token: <userToken>'
```

- `200` → token valid
- `401` → token invalid, discard and re-authenticate
- other / unreachable → error state, token status unknown

### Generate a PIN

```bash
curl -X POST https://plex.tv/api/v2/pins \
  -H 'Accept: application/json' \
  -H 'X-Plex-Product: My Cool App' \
  -H 'X-Plex-Client-Identifier: <clientIdentifier>'
```

> **Note on `strong=true`**: omitting it returns a short 4-character PIN for manual entry
> at `plex.tv/link` (used by this adapter). `strong=true` returns a long opaque code for
> headless flows where the user never types the code themselves.

Response: `{ "id": 564964751, "code": "8lzjqnq8lye02n52jq3fqxf8e", … }`

Store `id`; use `code` to construct the Auth App URL.

### Construct Auth App URL

```
https://app.plex.tv/auth#?clientID=<clientIdentifier>&code=<pinCode>&context%5Bdevice%5D%5Bproduct%5D=My%20Cool%20Plex%20App&forwardUrl=https%3A%2F%2Fmy-cool-plex-app.com
```

### Check PIN / Poll

```bash
curl -X GET 'https://plex.tv/api/v2/pins/<pinID>' \
  -H 'Accept: application/json' \
  -H 'X-Plex-Client-Identifier: <clientIdentifier>'
```

When claimed, `authToken` in the response contains the user's Access Token.

### Talking to PMS (after obtaining a plex.tv token)

```bash
curl https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1 \
  -H 'Accept: application/json' \
  -H 'X-Plex-Product: My Cool App' \
  -H 'X-Plex-Client-Identifier: <clientIdentifier>' \
  -H 'X-Plex-Token: <userToken>'
```

The response lists available PMS instances, each with an `accessToken` and connection URLs.
Prefer `local` connections; use `relay` only as last resort (bandwidth-limited).

---

## Migration Guide

### New applications (or new users)
1. Generate an Ed25519 key pair per device.
2. Use the PIN auth flow (Option 1) to register + get initial JWT.
3. Implement the token refresh flow (Step 1–3 above).
4. Use the returned JWT in `X-Plex-Token`.

### Existing applications with legacy tokens
1. Continue using the current token.
2. Register the public key (Option 2).
3. Generate the first JWT via the token refresh process (the legacy token expires after this).
4. Implement ongoing token refresh (every ≤ 7 days).
5. Use the JWT in `X-Plex-Token`.
