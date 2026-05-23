# Stripe Webhook Rollback Runbook

## When to use this

- Webhook handler is throwing errors in production and Stripe is retrying aggressively
- A bad deployment corrupted tenant billing state
- A Stripe event was processed incorrectly (wrong tier assigned, etc.)

---

## Step 1 — Immediate mitigation: disable the webhook endpoint

1. Stripe Dashboard → Developers → Webhooks
2. Find the Progue.ai endpoint
3. Click **Disable** — Stripe queues events but stops delivering them

This stops the bleeding. Stripe retains events for **72 hours**.

---

## Step 2 — Check the idempotency table

```sql
SELECT stripe_event_id, event_type, processed_at
FROM processed_webhooks
ORDER BY processed_at DESC
LIMIT 50;
```

If the same event appears multiple times, the unique index on `stripe_event_id` prevented
duplicate DB writes — no action needed for idempotency. If it appears only once,
the handler ran exactly once.

---

## Step 3 — Inspect and correct tenant billing state

```sql
-- Inspect
SELECT id, name, tier, subscription_status,
       stripe_subscription_id, stripe_price_id
FROM tenants
WHERE id = '<tenant_id>';

-- Correct (adjust values to match actual Stripe state)
UPDATE tenants
SET tier                   = 'GROWTH',
    subscription_status    = 'active',
    stripe_price_id        = 'price_xxx',
    stripe_subscription_id = 'sub_xxx'
WHERE id = '<tenant_id>';
```

Always verify the update matches the actual subscription state in the Stripe Dashboard.

---

## Step 4 — Re-enable and replay missed events

1. Deploy the fixed webhook handler
2. Re-enable the endpoint in Stripe Dashboard
3. For events missed during the outage:
   Stripe Dashboard → Webhooks → [endpoint] → **Resend** on each failed event

---

## Prevention

- Never deploy webhook handler changes without running the full test suite
- The `ProcessedWebhook` table prevents replay attacks and double-processing
- If removing the idempotency guard for any reason, escalate to engineering lead first
- `insert-after-process` pattern: `ProcessedWebhook` is only written after the handler
  succeeds — if it throws, Stripe will retry and the event will be reprocessed
