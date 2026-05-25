# Prompturtle API Reference

**Base URL:** `https://api.prompturtle.com/api` (production) | `http://localhost:3000/api` (local)

**Authentication:** All requests require a valid Clerk JWT in the `Authorization` header:
```
Authorization: Bearer <clerk_session_token>
```

**Multi-tenancy:** All data is scoped to your Clerk organization (`org_id`). Cross-org access is blocked at the RLS layer.

---

## Health

### `GET /health`
Returns server status. No authentication required.

**Response:**
```json
{ "status": "ok", "version": "1.0.0", "timestamp": "2026-05-18T00:00:00Z" }
```

---

## MCP Tool Execution

### `POST /api/mcp/:serverName/:toolName`

Execute a tool on a registered MCP server.

**Path parameters:**
| Parameter    | Description                                                              |
|-------------|--------------------------------------------------------------------------|
| `serverName` | MCP server ID: `bol-processor`, `carrier-rates`, `hts-classifier`       |
| `toolName`   | Tool name on the server (see per-server docs below)                      |

**Request body:** Tool-specific input (see per-server schemas below)

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "model": "claude-sonnet-4-6",
    "tokensUsed": 412,
    "latencyMs": 1840
  }
}
```

**Error responses:**

| Status | Meaning |
|--------|---------|
| 400 | Invalid input — Zod schema validation failed |
| 401 | Missing or invalid JWT |
| 403 | Guardrail violation (rate limit, tenant scope, input schema) |
| 429 | Tier limit exceeded (callsPerMinute or callsPerMonth) |
| 501 | Tool is a Phase 2 stub — not yet available |
| 500 | Internal server error |

---

## BOL Processor (`bol-processor`)

### `extract_bol_fields`
Parse raw Bill of Lading text into structured fields.
- **Model:** claude-sonnet-4-6
- **Input:** `{ rawText: string (min 10, max 50,000 chars), carrierHint?: string }`
- **Output:** Structured BOL fields with `extractionConfidence` (0–1)

### `validate_bol_data`
Validate extracted BOL fields against business rules.
- **Model:** claude-haiku-4-5-20251001
- **Input:** `{ bolFields: object, strictness?: "lenient" | "standard" | "strict" }`
- **Output:** `{ isValid, errors[], missingRequiredFields[] }`

### `flag_bol_discrepancies`
Compare a BOL against a PO or shipment record.
- **Model:** claude-opus-4-6
- **Input:** `{ bolFields, referenceDoc, referenceType: "PURCHASE_ORDER" | "SHIPMENT_RECORD" | "INVOICE" }`
- **Output:** `{ hasDiscrepancies, discrepancies[], recommendedAction, summary }`

---

## Carrier Rates (`carrier-rates`)

### `get_carrier_rates`
Get freight rate quotes for a shipment.
- **Model:** claude-haiku-4-5-20251001
- **Input:** `{ originCountry, destinationCountry, weightKg, dimensions?, requiredServiceLevel? }`
- **Output:** `{ quotes[], cheapestCarrierId, fastestCarrierId }`

### `compare_carrier_options`
Score and compare carrier quotes on cost and speed.
- **Model:** claude-sonnet-4-6
- **Input:** `{ quotes[] (min 2), shipmentContext }`
- **Output:** `{ comparison[], summary }`

### `recommend_carrier`
Recommend a carrier using weighted priorities.
- **Model:** claude-sonnet-4-6
- **Input:** `{ quotes[], priorities: { costWeight, speedWeight }, constraints?, businessContext? }`
- **Output:** `{ recommendedCarrierId, confidence, rationale, alternatives[] }`
- **Note:** `costWeight + speedWeight` must not exceed 1.0

---

## HTS Classifier (`hts-classifier`)

### `classify_product`
Classify a product using semantic HTS code search + AI re-ranking.
- **Model:** claude-opus-4-6
- **Input:** `{ productDescription, context?, candidateCount? (default 5) }`
- **Output:** `{ htsCode, confidence, reasoning, alternativeCodes[] }`

### `validate_classification`
Validate an existing HTS classification for compliance issues.
- **Model:** claude-haiku-4-5-20251001
- **Input:** `{ htsCode, productDescription, declaredDutyRate? }`
- **Output:** `{ isValid, confidence, issues[], suggestedCode? }`

### `get_duty_rates`
Look up duty rate for an HTS code. **No LLM — instant DB lookup.**
- **Input:** `{ htsCode }`
- **Output:** `{ htsCode, description, dutyRate, unit?, found }`

---

## Approval Workflow

### `GET /api/approvals`
List all pending approval requests for your organization.

### `POST /api/approvals/:id/decide`
Record an approval decision.
- **Body:** `{ decision: "APPROVED" | "REJECTED" | "ESCALATED", reason?: string }`

**Approval triggers (automatic):**
| Trigger | Condition |
|---------|-----------|
| `HIGH_SHIPMENT_COST` | Carrier quote total > $50,000 |
| `LOW_HTS_CONFIDENCE` | HTS classifier confidence < 70% |
| `CARRIER_CHANGE_ON_PO` | Carrier changed on an active purchase order |

---

## Tier Limits

| Tier | Price | Calls/min | Calls/month |
|------|-------|-----------|-------------|
| Starter | $149/mo | 10 | 1,000 |
| Growth | $599/mo | 60 | 10,000 |
| Enterprise | $1,999/mo | 300 | 100,000 |

---

## OpenAPI Spec

Machine-readable spec available at:
```
GET /api/docs
```
Returns JSON conforming to OpenAPI 3.1.
