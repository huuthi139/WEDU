-- =============================================
-- 014: Affiliate / Referral System
-- =============================================

-- 1. BACKFILL orders.user_id từ user_email
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.orders o
  SET user_id = u.id
  FROM public.users u
  WHERE u.email = o.user_email
    AND o.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);

-- 2. Add referrer_id to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_referrer_id ON public.orders(referrer_id);

-- 3. REFERRALS — ai giới thiệu ai, first referrer wins (UNIQUE referee_id)
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);

-- 4. AFFILIATE WALLETS — mỗi user 1 ví
CREATE TABLE IF NOT EXISTS public.affiliate_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance NUMERIC DEFAULT 0,
  total_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 5. AFFILIATE TRANSACTIONS — lịch sử commission + withdrawal
CREATE TABLE IF NOT EXISTS public.affiliate_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.affiliate_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('commission', 'withdrawal')),
  amount NUMERIC NOT NULL,
  order_id TEXT,
  description TEXT DEFAULT '',
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_transactions_wallet_id ON public.affiliate_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_transactions_type ON public.affiliate_transactions(type);

-- 6. RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_transactions ENABLE ROW LEVEL SECURITY;

-- Policies: service_role bypasses RLS; app uses service_role key
DO $$ BEGIN CREATE POLICY "allow_all_referrals" ON public.referrals FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "allow_all_affiliate_wallets" ON public.affiliate_wallets FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "allow_all_affiliate_transactions" ON public.affiliate_transactions FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT '014_affiliate migration completed!' as result;
