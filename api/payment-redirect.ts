import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Supabase with Service Role Key for Admin Access
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

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

/* ---------- ACTIVATION LOGIC ---------- */
async function activateSubscription(userId: string, planId: string, paymentId: string) {
  console.log(`[payment-redirect] Activating ${planId} for ${userId}`);
  const now = new Date();

  // 1. Credit Packs
  if (planId.startsWith('pack_')) {
    let credits = 0;
    switch (planId) {
      case 'pack_1': credits = 1; break;
      case 'pack_10': credits = 10; break;
      case 'pack_20': credits = 20; break;
      case 'pack_30': credits = 30; break;
      default: credits = 1;
    }

    // Fetch current
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('daily_credits') // Using daily_credits as balance based on app logic
      .eq('user_id', userId)
      .maybeSingle();

    const current = sub?.daily_credits || 0;
    const newBalance = current + credits;

    // Update
    await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      daily_credits: newBalance,
      updated_at: now.toISOString()
    }, { onConflict: 'user_id' });

    console.log(`[payment-redirect] Added ${credits} credits. New balance: ${newBalance}`);
  }

  // 2. Pro Plans
  else if (planId.startsWith('pro_')) {
    const isYearly = planId.includes('yearly');
    const days = isYearly ? 365 : 30;
    const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const credits = planId === 'pro_basic' ? 30 : 999999; // 30 for basic, unlimited for others

    // Update Subscription
    await supabase.from('user_subscriptions').upsert({
      user_id: userId,
      plan: planId,
      is_pro: true,
      daily_credits: credits,
      subscription_id: paymentId,
      plan_start_date: now.toISOString(),
      plan_end_date: expires.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });

    // Update Profile
    await supabase.from('user_profiles').update({
      is_pro: true,
      pro_since: now.toISOString(),
      pro_expires: expires.toISOString(),
    }).eq('id', userId);

    console.log(`[payment-redirect] Activated ${planId}`);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Razorpay sends payment details as POST form data or query params
  const params = req.method === 'POST' ? req.body : req.query;

  const paymentId = params.razorpay_payment_id || '';
  const orderId = params.razorpay_order_id || '';
  const signature = params.razorpay_signature || '';
  const error = params.error || '';
  const status = params.status || '';

  console.log('[payment-redirect] Received:', JSON.stringify({ paymentId, orderId, signature, error, status }));

  let deepLink: string;
  let debugStatus = 'Init';

  if (error || status === 'failed') {
    deepLink = `medplant://payment-failed?error=${encodeURIComponent(error || 'Payment failed')}`;
  } else if (paymentId) {
    // ---------------------------------------------------------
    // SERVER-SIDE ACTIVATION (SECURE)
    // ---------------------------------------------------------
    try {
      // 1. Verify Signature
      const body = orderId + "|" + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature === signature) {
        debugStatus = 'SigVerified';
        console.log('[payment-redirect] Signature Verified. Fetching order...');

        // 2. Fetch Order to get User Context
        const order = await razorpay.orders.fetch(orderId);

        if (order.notes && order.notes.user_id && order.notes.plan_id) {
          debugStatus = 'NotesFound';
          // 3. Activate Subscription
          try {
            await activateSubscription(
              order.notes.user_id as string,
              order.notes.plan_id as string,
              paymentId
            );
            debugStatus = 'ActivationSuccess';
          } catch (actErr: any) {
            console.error('Activation error:', actErr);
            debugStatus = 'ActivationFailed_' + (actErr.message || 'Unknown');
          }
        } else {
          console.warn('[payment-redirect] No user_id/plan_id in order notes');
          debugStatus = 'NoNotes_' + JSON.stringify(order.notes);
        }
      } else {
        console.error('[payment-redirect] Invalid Signature');
        debugStatus = 'SigFailed';
      }
    } catch (err: any) {
      console.error('[payment-redirect] Error processing success:', err);
      debugStatus = 'ProcessingError_' + (err.message || 'Unknown');
    }

    deepLink = `medplant://payment-success?razorpay_payment_id=${encodeURIComponent(paymentId)}&razorpay_order_id=${encodeURIComponent(orderId)}&razorpay_signature=${encodeURIComponent(signature)}&debug_status=${encodeURIComponent(debugStatus)}`;
  } else {
    deepLink = `medplant://payment-cancelled`;
  }

  console.log('[payment-redirect] Redirecting to:', deepLink);

  // Serve an HTML page that attempts both methods:
  // 1. Immediate redirect via meta refresh + JS
  // 2. Clickable "Return to App" button as fallback
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=${deepLink}">
  <title>Returning to MedPlant...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f3d2e;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 20px;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 14px 36px;
      background: #00C896;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      text-decoration: none;
      font-weight: 600;
    }
    h2 { margin-bottom: 10px; }
    p { opacity: 0.7; }
  </style>
</head>
<body>
  <div>
    <h2>${paymentId ? '✅ Payment Successful!' : (error ? '❌ Payment Failed' : 'Returning to App...')}</h2>
    <p style="font-size: 12px; margin-top: 5px; opacity: 0.8">${debugStatus}</p>
    <p>Redirecting back to MedPlant...</p>
    <a class="btn" href="${deepLink}">Return to App</a>
  </div>
  <script>
    // Attempt JS redirect immediately
    window.location.href = "${deepLink}";
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
