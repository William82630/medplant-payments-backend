import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

/**
 * GET /api/verify-payment?order_id=order_xxx
 *
 * After UPI / Google Pay, the in-app browser (Chrome Custom Tab) is often
 * dismissed by Android before the deep-link redirect fires.  The mobile
 * app calls this endpoint to check whether the payment actually went through.
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

    return res.status(200).json({
      paid: order.status === 'paid',
      status: order.status,
    });
  } catch (err: any) {
    console.error('[verify-payment] Error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
}
