# Vendor Onboarding Guide

Welcome to Prompturtle. This guide gets you from zero to first API call in under 15 minutes.

## Prerequisites

- A Clerk account (free at [clerk.com](https://clerk.com))
- An HTTP client (curl, Postman, or your preferred SDK)
- Your Prompturtle API credentials (from your welcome email)

## Step 1 — Create your Clerk organization

1. Sign in to your Clerk dashboard
2. Create a new organization — this is your tenant
3. Note your `org_id` — it appears in all JWT claims

## Step 2 — Generate a session token

Use Clerk's frontend SDK or the dashboard to generate a short-lived JWT. The token is valid for 60 seconds — your application should refresh it before each API call or use Clerk's session management.

## Step 3 — Make your first call

```bash
curl -X POST https://api.prompturtle.com/api/mcp/hts-classifier/get_duty_rates \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"htsCode": "8471.30.01"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "htsCode": "8471.30.01",
    "description": "Portable automatic data processing machines",
    "dutyRate": "Free",
    "chapter": "84",
    "found": true
  }
}
```

## Step 4 — Monitor usage

Visit your dashboard at `https://dashboard.prompturtle.com` to see:
- Real-time call logs with latency and token usage
- Monthly cost breakdown by MCP server and tool
- Approaching-limit alerts (email at 80% of monthly quota)

## Step 5 — Configure approval workflows

If your use case involves high-value shipments (>$50K) or HTS classification, configure who receives approval request notifications in your dashboard settings.

## Support

- **Docs:** [docs.prompturtle.com](https://docs.prompturtle.com)
- **Email:** support@prompturtle.com
- **Sales:** sales@prompturtle.com
