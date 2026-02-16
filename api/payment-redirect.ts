/**
 * Payment Redirect Handler
 * 
 * Razorpay POSTs here after payment success (via callback_url).
 * This endpoint does a 302 redirect to the medplant:// deep link,
 * which Chrome Custom Tabs intercepts and returns control to the app.
 * 
 * This is more reliable than client-side window.location.href for
 * custom scheme redirects on Android.
 */
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

  // Build deep link URL
  let deepLink: string;

  if (error || status === 'failed') {
    deepLink = `medplant://payment-failed?error=${encodeURIComponent(error || 'Payment failed')}`;
  } else if (paymentId) {
    deepLink = `medplant://payment-success?razorpay_payment_id=${encodeURIComponent(paymentId)}&razorpay_order_id=${encodeURIComponent(orderId)}&razorpay_signature=${encodeURIComponent(signature)}`;
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
