# Progue.ai API Reference

Base URL: `https://api.progue.ai`
Auth: `Authorization: Bearer <api_key>`
Content-Type: `application/json`

All requests must include a valid API key. Keys are created in the Developer Dashboard.

> **Implementation note:** `/api/mcp/*` endpoints are the planned MCP REST surface.
> Dashboard API routes (`/api/keys`, `/api/logs`, `/api/usage`, `/api/billing`) are
> fully implemented in v0.6.0. MCP HTTP routes are tracked for a future PR.

---

## Authentication

### API Key format

All Progue API keys begin with `ptk_`. Include them in the `Authorization` header:

```
Authorization: Bearer ptk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are SHA-256 hashed at rest. If a key is lost, revoke it and create a new one — raw values are shown exactly once, immediately after creation.

---

## BOL Processing

### POST /api/mcp/bol/parse

Parse raw bill of lading text into structured JSON.

**Request:**
```json
{
  "rawBol": "BILL OF LADING\nShipper: Acme Corp..."
}
```

**Response:**
```json
{
  "shipper":      { "name": "Acme Corp", "address": "123 Main St, Chicago IL 60601" },
  "consignee":    { "name": "Beta Logistics", "address": "456 Oak Ave, Dallas TX 75201" },
  "carrier":      "XPO Logistics",
  "proNumber":    "123456789",
  "weight":       5000,
  "freightClass": 85,
  "declaredValue": 8500,
  "commodity":    "Electronic Components"
}
```

---

### POST /api/mcp/bol/validate

Validate a structured BOL against guardrail rules.

**Request:** Structured BOL object (output of `/parse`).

**Response:**
```json
{
  "valid":          true,
  "guardrailsFired": ["high_cost_approval"],
  "errors":         [],
  "warnings":       ["Shipment value exceeds $10,000 — approval required"]
}
```

---

## Carrier Rates

### POST /api/mcp/carrier/rates

Compare rates across FedEx, UPS, and XPO for a given shipment.

**Request:**
```json
{
  "origin":      { "zip": "60601", "city": "Chicago", "state": "IL" },
  "destination": { "zip": "75201", "city": "Dallas", "state": "TX" },
  "weight":      500,
  "freightClass": 85
}
```

**Response:**
```json
{
  "rates": [
    { "carrier": "XPO",   "baseRate": 312.50, "transitDays": 3, "score": 0.91 },
    { "carrier": "FedEx", "baseRate": 347.00, "transitDays": 2, "score": 0.87 },
    { "carrier": "UPS",   "baseRate": 329.75, "transitDays": 3, "score": 0.84 }
  ],
  "recommended":    "XPO",
  "guardrailsFired": []
}
```

---

## HTS Classification

### POST /api/mcp/hts/classify

Classify a commodity to its HS code and get applicable tariff rates.

**Request:**
```json
{
  "commodity":          "Electronic Components — printed circuit boards",
  "originCountry":      "CN",
  "destinationCountry": "US"
}
```

**Response:**
```json
{
  "hsCode":         "8534.00.00",
  "description":    "Printed circuits",
  "tariffRate":     0.0,
  "cbamApplicable": false,
  "notes":          "Section XVI — Machinery and electrical equipment"
}
```

---

## Approval Workflow

### POST /api/mcp/approval/request

Request approval for a guardrail-flagged decision.

**Request:**
```json
{
  "decisionId":    "dec_xxx",
  "reason":        "high_cost_approval",
  "details":       { "amount": 15000, "carrier": "FedEx" },
  "approverRole":  "finance_manager"
}
```

**Response:**
```json
{
  "approvalId":        "apr_xxx",
  "status":            "pending",
  "notificationSent":  true
}
```

---

## Audit Trail

### GET /api/mcp/audit/history

Get decision history for the tenant.

**Query params:** `?limit=50&offset=0&module=BOL_PROCESSING`

**Response:**
```json
{
  "decisions": [
    {
      "id":              "dec_xxx",
      "module":          "BOL_PROCESSING",
      "action":          "validate_bol",
      "guardrailsFired": ["high_cost_approval"],
      "accepted":        true,
      "latencyMs":       143,
      "createdAt":       "2026-05-23T10:00:00Z"
    }
  ],
  "total":  142,
  "limit":  50,
  "offset": 0
}
```

---

## Dashboard API

### GET /api/keys

List active API keys for the authenticated tenant. Requires Clerk JWT.

**Response:**
```json
{
  "keys": [
    { "id": "uuid", "name": "Production", "prefix": "ptk_abcdef", "createdAt": "...", "lastUsedAt": null }
  ]
}
```

### POST /api/keys

Create a new API key. Raw key returned once only.

**Request:** `{ "name": "Production" }`

**Response:** `{ "key": { "id": "...", "name": "...", "prefix": "ptk_abcdef", "createdAt": "...", "raw": "ptk_..." } }`

### DELETE /api/keys/:id

Soft-revoke an API key. Returns `204 No Content`.

### GET /api/logs

Paginated tool call logs. Query: `?page=1&limit=25&server=bol-processor`.

### GET /api/usage

Aggregated token + cost usage by MCP server. Query: `?days=30`.

### GET /api/billing/status

Current tier, subscription status, and month-to-date usage.

### POST /api/billing/checkout

Create a Stripe Checkout session. Request: `{ "priceId": "price_xxx" }`. Returns `{ "url": "https://checkout.stripe.com/..." }`.

### POST /api/billing/portal

Open the Stripe Customer Portal. Returns `{ "url": "https://billing.stripe.com/..." }`.

---

## Error Responses

All errors follow this shape:

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — check your request body |
| 401 | Missing or invalid API key |
| 403 | API key valid but access denied |
| 422 | Schema validation failed |
| 429 | Rate limit or guardrail violation |
| 500 | Internal error — contact support |

---

## Rate Limits

| Tier | Calls/month | Calls/min | Price |
|------|-------------|-----------|-------|
| Starter | 1,000 | 10 | $149/mo |
| Growth | 10,000 | 60 | $599/mo |
| Enterprise | 100,000 | 300 | $1,999/mo |

Usage warnings are sent by email at 80% of monthly limit.

---

## OpenAPI Spec

Machine-readable spec: [`docs/openapi.yaml`](openapi.yaml)
Interactive docs via `/api/docs` endpoint (returns OpenAPI JSON).
