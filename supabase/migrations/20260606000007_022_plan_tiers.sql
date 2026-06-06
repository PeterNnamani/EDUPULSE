/*
  # 022 - Subscription plan tiers restructure

  New tiers: starter | growth | enterprise | enterprise_plus
  Legacy values (professional, lifetime) are kept temporarily so existing rows
  remain valid, then mapped onto the new tiers.

  Also adds `annual` to billing_cycle.
*/

-- Relax CHECK constraints to allow both legacy + new values during migration.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (
  plan IN (
    'starter', 'growth', 'enterprise', 'enterprise_plus',
    -- legacy values (mapped below; retained for safety)
    'professional', 'lifetime'
  )
);

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_cycle_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_cycle_check CHECK (
  billing_cycle IN ('monthly', 'biannual', 'yearly', 'annual', 'lifetime')
);

-- Map legacy plans to the closest new tier.
UPDATE subscriptions SET plan = 'growth' WHERE plan = 'professional';
UPDATE subscriptions SET plan = 'enterprise_plus' WHERE plan = 'lifetime';
