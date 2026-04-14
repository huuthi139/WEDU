-- =============================================
-- 015: Short ref codes for affiliate (WDxxxxxx)
-- =============================================

-- 1. Add ref_code column to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ref_code TEXT UNIQUE;

-- 2. Function to generate unique ref code: WD + 6 chars (A-Z0-9, no ambiguous chars)
CREATE OR REPLACE FUNCTION generate_ref_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  done BOOL;
BEGIN
  done := FALSE;
  WHILE NOT done LOOP
    code := 'WD';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    done := NOT EXISTS (
      SELECT 1 FROM public.users WHERE ref_code = code
    );
  END LOOP;
  RETURN code;
END $$;

-- 3. Backfill existing users
UPDATE public.users
  SET ref_code = generate_ref_code()
  WHERE ref_code IS NULL;

SELECT '015_ref_code migration completed!' as result;
