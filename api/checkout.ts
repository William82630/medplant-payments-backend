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
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
var params = new URLSearchParams(window.location.search);
var key = params.get('key');
var order_id = params.get('order_id');
var name = params.get('name') || 'MedPlant';
var description = params.get('description') || 'Payment';
var email = params.get('email') || '';
var redirect_url = params.get('redirect_url');

function showError(msg) {
  document.getElementById('content').innerHTML =
    '<h2>Payment Error</h2>' +
    '<p class="error">' + msg + '</p>';
}

function startPayment() {
  if (!key || !order_id) {
    showError('Missing payment details.');
    return;
  }

  var options = {
    key: key,
    order_id: order_id,
    name: name,
    description: description,
    prefill: { email: email },
    theme: { color: '#00C896' },
    modal: {
      ondismiss: function () {
        showError('Payment cancelled.');
      }
    }
  };

  /* ✅ CRITICAL FIX */
  if (redirect_url) {
    options.callback_url = redirect_url;
    options.callback_method = "get";
    console.log("[Checkout] Using callback_url + callback_method");
  }

  var rzp = new Razorpay(options);

  rzp.on('payment.failed', function(response) {
    showError(response.error.description);
  });

  rzp.open();
}

var script = document.createElement('script');
script.src = "https://checkout.razorpay.com/v1/checkout.js";
script.onload = function() {
  startPayment();
};
script.onerror = function() {
  showError('Failed to load payment gateway.');
};
document.head.appendChild(script);
</script>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}