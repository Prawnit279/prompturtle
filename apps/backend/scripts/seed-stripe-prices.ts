/**
 * Run once to create Progue.ai products and prices in Stripe TEST mode.
 * Usage: npx tsx scripts/seed-stripe-prices.ts
 *
 * After running, copy the price IDs printed to stdout into your .env or dashboard config.
 * NOTE: Do NOT run this in CI. Run manually after enabling Customer Portal in the Stripe dashboard.
 */
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  process.stderr.write('Error: STRIPE_SECRET_KEY is required\n');
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  process.stderr.write('Error: STRIPE_SECRET_KEY must be a TEST key (sk_test_)\n');
  process.exit(1);
}

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

const TIERS = [
  { name: 'Starter',    price: 14900,  calls: 1_000    },
  { name: 'Growth',     price: 59900,  calls: 10_000   },
  { name: 'Enterprise', price: 199900, calls: 100_000  },
];

async function seed(): Promise<void> {
  process.stdout.write('Seeding Stripe products and prices (TEST mode)...\n\n');

  for (const tier of TIERS) {
    const product = await stripeClient.products.create({
      name:     `Progue.ai ${tier.name}`,
      metadata: { calls: String(tier.calls) },
    });

    const price = await stripeClient.prices.create({
      product:   product.id,
      unit_amount: tier.price,
      currency:  'usd',
      recurring: { interval: 'month' },
    });

    process.stdout.write(`${tier.name}: product=${product.id} price=${price.id}\n`);
  }

  process.stdout.write('\nDone. Add price IDs to .env as VITE_STRIPE_PRICE_* vars.\n');
}

seed().catch((err: unknown) => {
  process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
