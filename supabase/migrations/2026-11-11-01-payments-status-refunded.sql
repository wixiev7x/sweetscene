-- 2026-11-11-01: allow payments.status = 'refunded'
--
-- The NOWPayments rail (re-added 2026-11-11 beside Stripe) records
-- refunds-after-grant by writing status='refunded' on the payments row
-- (webhook: np_payment_refunded_after_grant), and the claim guard
-- excludes 'refunded' so a refunded payment can never re-grant. The
-- payments_status_check constraint predates that flow and only allows
-- pending/confirmed/failed/expired — on a fresh database the refund
-- UPDATE would be rejected by the CHECK and the row would stay
-- 'confirmed', losing the refund signal.
--
-- Idempotent: inspects the live constraint text and only replaces it
-- when 'refunded' is missing.

DO $fix$
DECLARE
  constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO constraint_def
    FROM pg_constraint
   WHERE conname = 'payments_status_check'
     AND conrelid = 'public.payments'::regclass;

  IF constraint_def IS NOT NULL AND position('refunded' in constraint_def) = 0 THEN
    ALTER TABLE public.payments DROP CONSTRAINT payments_status_check;
    ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
      CHECK (status IN ('pending', 'confirmed', 'failed', 'expired', 'refunded'));
    RAISE NOTICE 'payments_status_check extended with refunded';
  ELSE
    RAISE NOTICE 'payments_status_check already allows refunded (or absent) — no change';
  END IF;
END
$fix$;
