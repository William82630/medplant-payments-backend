import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

/* ---------- Supabase (Analytics Only) ---------- */
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

export default async function handler(req: any, res: any) {
  /* ---------- CORS ---------- */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency = 'INR', userId, planId } = req.body;

    if (!amount || !userId || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    /* ---------- BASE URL (IMPORTANT) ---------- */
    const BASE_URL = process.env.BASE_URL;

    if (!BASE_URL) {
      console.error('[create-order] BASE_URL not defined');
      return res.status(500).json({ error: 'Server misconfiguration: BASE_URL missing' });
    }

    /* ---------- ORDER CREATION ---------- */
    const orderParams: any = {
      amount: Number(amount),
      currency,
      notes: {
        user_id: userId,
        plan_id: planId,
      },
    };

    console.log('[create-order] Creating order with params:', JSON.stringify(orderParams));

    const order = await razorpay.orders.create(orderParams);

    console.log('[create-order] Order created:', order.id, 'amount:', order.amount);

    /* ---------- ANALYTICS (NON-BLOCKING) ---------- */
    supabase
      .from('analytics_events')
      .insert({
        event_name: 'order_created',
        source: 'create-order',
      })
      .then(({ error }) => {
        if (error) console.error('Analytics insert failed:', error);
      });

    /* ---------- RESPONSE ---------- */
    return res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      },
    });

  } catch (err: any) {
    console.error('[create-order] ERROR:', err?.error || err?.message || err);
    return res.status(500).json({
      error: 'Failed to create order',
      details: err?.error?.description || err?.message
    });
  }
}