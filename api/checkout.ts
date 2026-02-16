export default async function handler(req: any, res: any) {
  /* ---------- CORS ---------- */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
</head>
<body>
  <div class="container" id="content">
    <div class="loader"></div>
    <h2>Loading Payment...</h2>
    <p>Please wait while we set up your secure checkout.</p>
  </div>
  <script>
    // Redirect Razorpay's alert() calls to show as visible errors on the page
    window.alert = function(msg) {
      console.warn('[Checkout] Razorpay alert:', msg);
      var el = document.getElementById('content');
      if (el) {
        el.innerHTML =
          '<h2>Payment Error</h2>' +
          '<p class="error">' + msg + '</p>' +
          '<a class="btn" href="medplant://payment-failed?error=' + encodeURIComponent(msg) + '">Return to App</a>';
      }
    };
    window.confirm = function(msg) { console.warn('[Checkout] Suppressed confirm:', msg); return true; };
    window.prompt = function(msg) { console.warn('[Checkout] Suppressed prompt:', msg); return null; };
  <\\/script>
  <script src="https://checkout.razorpay.com/v1/checkout.js"><\\/script>
  <script>
    var params = new URLSearchParams(window.location.search);
    var key = params.get('key');
    var order_id = params.get('order_id');
    var amount = params.get('amount');
    var currency = params.get('currency') || 'INR';
    var name = params.get('name') || 'MedPlant';
    var description = params.get('description') || 'Pro Subscription';
    var email = params.get('email') || '';
    var callback = params.get('callback');
    var redirect_url = params.get('redirect_url');
    if (!callback || callback === 'null' || callback === 'undefined') {
      callback = 'medplant://payment-success';
    }
    var cancelUrl = callback.replace('payment-success', 'payment-cancelled');
    var failBaseUrl = callback.replace('payment-success', 'payment-failed');

    console.log('[Checkout] Params:', JSON.stringify({key: key, order_id: order_id, redirect_url: redirect_url, email: email}));

    function showError(msg) {
      document.getElementById('content').innerHTML =
        '<h2>Payment Error</h2>' +
        '<p class="error">' + msg + '</p>' +
        '<a class="btn" href="' + failBaseUrl + '?error=' + encodeURIComponent(msg) + '">Return to App</a>';
    }

    if (!key || !order_id) {
      showError('Missing payment details. Please try again from the app.');
    } else {
      var rzpOpened = false;
      var safetyTimeout = setTimeout(function() {
        if (!rzpOpened) {
          showError('Payment gateway timed out. Please close this page and try again.');
        }
      }, 15000);

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

        // Mobile flow: use callback_url for reliable redirect via server
        // Web flow: use handler for inline success handling
        if (redirect_url) {
          options.callback_url = redirect_url;
          console.log('[Checkout] Using callback_url (mobile):', redirect_url);
        } else {
          options.handler = function(response) {
            rzpOpened = true;
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
          var failUrl = failBaseUrl +
            '?error=' + encodeURIComponent(response.error.description) +
            '&code=' + encodeURIComponent(response.error.code);
          showError(response.error.description);
          var btn = document.querySelector('.btn');
          if (btn) btn.href = failUrl;
        });
        setTimeout(function() {
          try {
            rzp.open();
            rzpOpened = true;
            clearTimeout(safetyTimeout);
          } catch (openErr) {
            showError('Failed to open payment: ' + openErr.message);
            clearTimeout(safetyTimeout);
          }
        }, 500);
      } catch (e) {
        clearTimeout(safetyTimeout);
        showError('Failed to initialize payment: ' + e.message);
      }
    }
  <\\/script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
