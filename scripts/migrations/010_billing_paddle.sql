-- 010_billing_paddle.sql
-- Billing (Paddle MoR) + free-access allowlist. One subscription per user.

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  paddle_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- active | trialing | past_due | paused | canceled
  price_id TEXT,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS free_access (
  email TEXT PRIMARY KEY,            -- always stored lowercase
  note TEXT,                         -- e.g. 'F3 guys', 'beta tester'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
