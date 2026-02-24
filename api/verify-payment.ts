import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

/* ---------- Supabase (Service Role — Admin Access) ---------- */
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/* ---------- Razorpay ---------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

/**
 * GET /api/verify-payment?order_id=order_xxx
 *
 * After UPI / Google Pay, the in-app browser (Chrome Custom Tab) is often
 * dismissed by Android before the callback_url redirect fires.  This means
 * payment-redirect.ts never executes, so credits never get activated.
 *
 * This endpoint:
 *  1. Checks with Razorpay whether the order was paid
 *  2. If paid, activates the subscription / adds credits (same logic as payment-redirect.ts)
 *  3. Returns the result to the mobile app
 */
export default async function handler(req: any, res: any) {
  /* ---------- CORS ---------- */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const orderId = req.query.order_id;

  if (!orderId) {
    return res.status(400).json({ error: 'Missing order_id' });
  }

  try {
    const order = await razorpay.orders.fetch(orderId);

    console.log(`[verify-payment] order ${orderId} status=${order.status}`);

    if (order.status !== 'paid') {
      return res.status(200).json({ paid: false, status: order.status });
    }

    // ─── Order is paid — activate subscription / credits ──────────
    const userId = order.notes?.user_id as string | undefined;
    const planId = order.notes?.plan_id as string | undefined;

    if (!userId || !planId) {
      console.warn('[verify-payment] Paid but no user_id/plan_id in notes');
      return res.status(200).json({ paid: true, status: order.status, activated: false, reason: 'no_notes' });
    }

    // Fetch first successful payment for this order (for paymentId tracking)
    let paymentId = 'verify_' + orderId;
    try {
      const payments = await razorpay.orders.fetchPayments(orderId);
      const captured = (payments as any).items?.find((p: any) => p.status === 'captured');
      if (captured) paymentId = captured.id;
    } catch (e) {
      console.warn('[verify-payment] Could not fetch payments for order:', e);
    }

    // ─── Idempotency check: see if this payment was already activated ───
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('subscription_id, daily_credits')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSub?.subscription_id === paymentId) {
      console.log(`[verify-payment] Payment ${paymentId} already activated. Skipping.`);
      return res.status(200).json({ paid: true, activated: true, skipped: true });
    }

    // ─── Activate ────────────────────────────────────────────────────
    try {
      const now = new Date();

      if (planId.startsWith('pack_')) {
        // Credit Packs
        let credits = 0;
        switch (planId) {
          case 'pack_1': credits = 1; break;
          case 'pack_10': credits = 10; break;
          case 'pack_20': credits = 20; break;
          case 'pack_30': credits = 30; break;
          default: credits = 1;
        }

        const current = existingSub?.daily_credits || 0;
        const newBalance = current + credits;

        const { error: packError } = await supabase.from('user_subscriptions').upsert({
          user_id: userId,
          plan: 'pay_per_scan',
          is_pro: false,
          daily_credits: newBalance,
          subscription_id: paymentId,
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id' });

        if (packError) {
          console.error('[verify-payment] Credit pack upsert failed:', packError);
          return res.status(200).json({ paid: true, activated: false, error: packError.message });
        }

        console.log(`[verify-payment] ✅ Added ${credits} credits. New balance: ${newBalance}`);
        return res.status(200).json({ paid: true, activated: true, credits: newBalance });

      } else if (planId.startsWith('pro_')) {
        // Pro Plans
        const isYearly = planId.includes('yearly');
        const days = isYearly ? 365 : 30;
        const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const credits = planId === 'pro_basic' ? 10 : 100;

        const { error: subError } = await supabase.from('user_subscriptions').upsert({
          user_id: userId,
          plan: planId,
          is_pro: true,
          daily_credits: credits,
          subscription_id: paymentId,
          plan_start_date: now.toISOString(),
          plan_end_date: expires.toISOString(),
          updated_at: now.toISOString(),
        }, { onConflict: 'user_id' });

        if (subError) {
          console.error('[verify-payment] Subscription upsert failed:', subError);
          return res.status(200).json({ paid: true, activated: false, error: subError.message });
        }

        // Also update profile
        await supabase.from('user_profiles').update({
          is_pro: true,
          pro_since: now.toISOString(),
          pro_expires: expires.toISOString(),
        }).eq('id', userId);

        console.log(`[verify-payment] ✅ Activated ${planId}`);
        return res.status(200).json({ paid: true, activated: true, plan: planId });

      } else {
        console.warn(`[verify-payment] Unknown planId: ${planId}`);
        return res.status(200).json({ paid: true, activated: false, reason: 'unknown_plan' });
      }
    } catch (actErr: any) {
      console.error('[verify-payment] Activation error:', actErr);
      return res.status(200).json({ paid: true, activated: false, error: actErr.message });
    }

  } catch (err: any) {
    console.error('[verify-payment] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
}
