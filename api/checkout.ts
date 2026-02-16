export default async function handler(req: any, res: any) {
  /* ---------- CORS ---------- */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  /* ---------- HTML Response (Robust Script Loading) ---------- */
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MedPlant Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
    .container { max-width: 400px; }
    .loader {
      width: 40px; height: 40px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #00C896;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin-bottom: 10px; font-size: 20px; }
    p { opacity: 0.7; font-size: 14px; }
    .error { color: #ff6b6b; opacity: 1; margin-top: 16px; }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 32px;
      background: #00C896;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      text-decoration: none;
    }
  </style>
  <script>
    // 1. Setup Global Error Handlers & Params
    var params = new URLSearchParams(window.location.search);
    var callback = params.get('callback');
    if (!callback || callback === 'null' || callback === 'undefined') {
      callback = 'medplant://payment-success';
    }
    var cancelUrl = callback.replace('payment-success', 'payment-cancelled');
    var failBaseUrl = callback.replace('payment-success', 'payment-failed');

    function showError(msg) {
      console.error('[Checkout] Error:', msg);
      var el = document.getElementById('content');
      if (el) {
        el.innerHTML =
          '<h2>Payment Error</h2>' +
          '<p class="error">' + msg + '</p>' +
          '<a class="btn" href="' + failBaseUrl + '?error=' + encodeURIComponent(msg) + '">Return to App</a>';
      }
    }

    // Redirect Razorpay's alert() calls
    window.alert = function(msg) {
      console.warn('[Checkout] Razorpay alert:', msg);
      showError(msg);
    };
  </script>
</head>
<body>
  <div class="container" id="content">
    <div class="loader"></div>
    <h2>Loading Payment...</h2>
    <p>Please wait while we set up your secure checkout.</p>
  </div>

  <script>
    // 2. Start Safety Timeout IMMEDIATELY
    // This runs before anything else tries to load
    var safetyTimeout = setTimeout(function() {
      // If content still has loader, it means we're stuck
      var el = document.getElementById('content');
      if (el && el.innerHTML.indexOf('loader') !== -1) {
        showError('Payment gateway connection timed out. Internet issue?');
      }
    }, 15000); // 15 seconds

    // 3. Define Main Logic
    function startPayment() {
      var key = params.get('key');
      var order_id = params.get('order_id');
      var name = params.get('name') || 'MedPlant';
      var description = params.get('description') || 'Pro Subscription';
      var email = params.get('email') || '';
      var redirect_url = params.get('redirect_url');

      console.log('[Checkout] Starting with:', JSON.stringify({key, order_id, redirect_url}));

      if (!key || !order_id) {
        clearTimeout(safetyTimeout);
        showError('Missing payment details. Please try again.');
        return;
      }

      if (typeof Razorpay === 'undefined') {
        showError('Razorpay SDK failed to load.');
        return;
      }

      try {
        var options = {
          key: key,
          order_id: order_id,
          name: name,
          description: description,
          prefill: { email: email },
          theme: { color: '#00C896' },
          modal: {
            ondismiss: function() {
              clearTimeout(safetyTimeout);
              document.getElementById('content').innerHTML =
                '<h2>Payment Cancelled</h2>' +
                '<p>You cancelled the payment.</p>' +
                '<a class="btn" href="' + cancelUrl + '">Return to App</a>';
            }
          }
        };

        if (redirect_url) {
          options.callback_url = redirect_url;
          console.log('[Checkout] Using callback_url (mobile)');
        } else {
          options.handler = function(response) {
            clearTimeout(safetyTimeout);
            var successUrl = callback +
              '?razorpay_payment_id=' + encodeURIComponent(response.razorpay_payment_id) +
              '&razorpay_order_id=' + encodeURIComponent(response.razorpay_order_id) +
              '&razorpay_signature=' + encodeURIComponent(response.razorpay_signature);
            
            document.getElementById('content').innerHTML =
              '<h2>Payment Successful!</h2>' +
              '<p>Redirecting back to MedPlant...</p>' +
              '<a class="btn" href="' + successUrl + '">Return to App</a>';
            setTimeout(function() { window.location.href = successUrl; }, 1500);
          };
          console.log('[Checkout] Using handler (web)');
        }

        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          clearTimeout(safetyTimeout);
          showError(response.error.description);
        });

        // Open
        rzp.open();
        
        // Clear safety timeout only if modal opened typically... 
        // actually keep it until interaction or dismiss to be safe? 
        // No, rzp.open() is sync-ish.
        console.log('[Checkout] rzp.open() called');
        
      } catch (e) {
        showError('Init error: ' + e.message);
      }
    }
  </script>

  <!-- 4. Load Script Dynamically with Error Handling -->
  <script>
    var script = document.createElement('script');
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = function() {
      console.log('[Checkout] Script loaded');
      startPayment();
    };
    script.onerror = function() {
      console.error('[Checkout] Script load failed');
      showError('Failed to load payment gateway script. Check connection.');
    };
    document.head.appendChild(script);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
