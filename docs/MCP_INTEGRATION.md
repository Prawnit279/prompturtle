# MCP Integration Guide

This guide covers embedding Prompturtle's Context Engine into your supply chain software via API.

## How it works

```
Your App → POST /api/mcp/{server}/{tool} → Prompturtle API → Claude AI → Structured JSON
```

Prompturtle handles: model routing, cost tracking, guardrails, tenant isolation, audit logging.
You handle: your UI, your data, your users.

## Authentication

1. Create a Clerk account at [clerk.com](https://clerk.com)
2. Create an organization for your tenant
3. Generate a session token — include it in every request:

```http
POST /api/mcp/bol-processor/extract_bol_fields
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
Content-Type: application/json

{
  "rawText": "BILL OF LADING\nBOL NUMBER: BL-2026-001\n..."
}
```

## Quickstart — BOL extraction in 3 minutes

```typescript
const response = await fetch('https://api.prompturtle.com/api/mcp/bol-processor/extract_bol_fields', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clerkSessionToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    rawText: bolDocumentText,
  }),
})

const { success, data } = await response.json()

if (success) {
  console.log(data.bolNumber)            // "BL-2026-001"
  console.log(data.originPort)           // "USLAX"
  console.log(data.extractionConfidence) // 0.94
}
```

## Error handling

All errors follow the same shape:
```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "TIER_LIMIT_EXCEEDED"
}
```

| Code | What to do |
|------|-----------|
| `INVALID_INPUT` | Check your request body against the schema |
| `TIER_LIMIT_EXCEEDED` | Slow down or upgrade your plan |
| `GUARDRAIL_VIOLATION` | Request was blocked — check audit logs |
| `NOT_IMPLEMENTED` | Feature is Phase 2 — contact sales |
| `APPROVAL_REQUIRED` | Action flagged for review — check `/api/approvals` |

## Available MCP servers

| Server | Tools | Use case |
|--------|-------|----------|
| `bol-processor` | extract, validate, flag | Document processing |
| `carrier-rates` | get rates, compare, recommend | Freight decisions |
| `hts-classifier` | classify, validate, duty lookup | Customs compliance |
| `carbon-tracking` | *(Phase 2)* | Emissions tracking |
| `supplier-risk` | *(Phase 2)* | Vendor risk scoring |

## Rate limits & costs

Limits are enforced per organization per minute and per month. If you hit a limit, the API returns `429` with a `Retry-After` header. Upgrade plans at the dashboard.

## Webhooks (coming in v1.1)

Approval workflow decisions will be deliverable via webhook. Contact sales to join the beta.
