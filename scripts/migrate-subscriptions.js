const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log("Applying subscription and payment table migrations...");

  await pool.query(`
    -- Subscriptions table
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan VARCHAR(30) NOT NULL DEFAULT 'basic',
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      price_paid REAL NOT NULL DEFAULT 0.0,
      tax_amount REAL NOT NULL DEFAULT 0.0,
      current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '30 days',
      trial_ends_at TIMESTAMP,
      paused_at TIMESTAMP,
      canceled_at TIMESTAMP,
      gateway VARCHAR(30) NOT NULL DEFAULT 'stripe',
      gateway_subscription_id TEXT,
      gateway_customer_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);

    -- Coupons table
    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      discount_percent INTEGER DEFAULT 0,
      discount_amount REAL DEFAULT 0.0,
      currency VARCHAR(10) DEFAULT 'USD',
      valid_until TIMESTAMP,
      max_uses INTEGER DEFAULT 1000,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      amount REAL NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      gst_rate REAL NOT NULL DEFAULT 18.0,
      gst_amount REAL NOT NULL DEFAULT 0.0,
      status VARCHAR(20) NOT NULL DEFAULT 'paid',
      payment_method VARCHAR(50),
      payment_gateway VARCHAR(30),
      transaction_id VARCHAR(100),
      billing_address JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices(created_at);

    -- Payment Transactions table
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      gateway VARCHAR(30) NOT NULL,
      gateway_transaction_id VARCHAR(255),
      gateway_payment_method VARCHAR(50),
      failure_reason TEXT,
      refund_amount REAL DEFAULT 0.0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS payment_tx_user_id_idx ON payment_transactions(user_id);
    CREATE INDEX IF NOT EXISTS payment_tx_gateway_idx ON payment_transactions(gateway);
    CREATE INDEX IF NOT EXISTS payment_tx_status_idx ON payment_transactions(status);
  `);

  // Seed default coupons if not exists
  await pool.query(`
    INSERT INTO coupons (code, discount_percent, discount_amount, valid_until, max_uses, is_active)
    VALUES 
      ('STREAM50', 50, 0, NOW() + INTERVAL '1 year', 5000, TRUE),
      ('NETFLIX20', 20, 0, NOW() + INTERVAL '1 year', 10000, TRUE),
      ('WELCOME100', 100, 0, NOW() + INTERVAL '1 month', 500, TRUE)
    ON CONFLICT (code) DO NOTHING;
  `);

  console.log("✅ Subscriptions & Payment Gateway tables created successfully!");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  pool.end();
  process.exit(1);
});
