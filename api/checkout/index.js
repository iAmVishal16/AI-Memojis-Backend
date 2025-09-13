// Simple PayPal Sandbox Checkout Page
// Query param: ?uid=<figmaUserId>

export default async function handler(req, res) {
	const uid = (req.query && (req.query.uid || req.query.user || req.query.u)) || '';
	const plan = (req.query && req.query.plan) || ''; // 'monthly' or 'lifetime'
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const env = process.env.PAYPAL_ENV || 'sandbox';

	if (!clientId) {
		res.status(500).send('Missing PAYPAL_CLIENT_ID');
		return;
	}

	// Prices
	const currency = 'USD';
	const lifetimeAmount = process.env.LIFETIME_PRICE_USD || '49.99';
	const monthlyAmount = process.env.MONTHLY_PRICE_USD || '9.99';
	const planId = process.env.PAYPAL_PLAN_ID || '';
	const title = 'AI Memojis Pro Lifetime';
	const backendBase = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Memojis Checkout</title>
<style>
	body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background:#f5f5f7; color:#1d1d1f; padding:24px; }
	.container { max-width: 520px; margin: 0 auto; background:#fff; border-radius:16px; padding:24px; box-shadow:0 8px 30px rgba(0,0,0,0.08); }
	.h { font-weight:700; font-size:20px; margin:0 0 8px; }
	.p { color:#6b7280; margin:0 0 16px; }
	.tabs { display:flex; gap:8px; margin:8px 0 14px; }
	.tab { flex:1; padding:10px 12px; border-radius:10px; border:1px solid #e5e7eb; text-align:center; cursor:pointer; user-select:none; font-weight:600; }
	.tab.active { background:#1d1d1f; color:#fff; border-color:#1d1d1f; }
	.row { display:flex; align-items:center; justify-content:space-between; margin:16px 0; }
	.badge { background:#f5f5f7; padding:6px 10px; border-radius:8px; font-weight:600; }
	.price { font-weight:800; font-size:22px; }
	.section { margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; }
	#section-lifetime, #section-monthly { display:none; }
	#paypal-btn, #paypal-sub-btn { margin-top: 16px; }
	.note { margin-top:14px; color:#6b7280; font-size:12px; }
	.ok { color: #065f46; }
	.err { color: #7f1d1d; }
	.dim { opacity: 0.5; pointer-events: none; }
</style>
<!-- Base SDK for one-time purchases (capture) -->
<script src="https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons&enable-funding=paypal" onload="console.log('PayPal SDK loaded')" onerror="console.error('PayPal SDK failed to load')"></script>
</head>
<body>
	<div class="container">
		<h1 class="h">AI Memojis – Checkout</h1>
		<p class="p">Bind purchases to your Figma user ID: <strong>${uid || 'unknown'}</strong></p>

		<div class="tabs">
			<div id="tab-lifetime" class="tab active">Lifetime</div>
			<div id="tab-monthly" class="tab${planId ? '' : ' dim'}">Monthly</div>
		</div>

		<div id="section-lifetime" class="section">
			<div class="row"><span class="badge">Lifetime</span><span class="price">${currency} ${lifetimeAmount}</span></div>
			<div id="paypal-btn"></div>
		</div>

		${planId ? `<div id=\"section-monthly\" class=\"section\">\n\t\t\t<div class=\"row\"><span class=\"badge\">Monthly<\/span><span class=\"price\">${currency} ${monthlyAmount}\/mo<\/span><\/div>\n\t\t\t<div id=\"paypal-sub-btn\"><\/div>\n\t\t<\/div>` : ''}

		<div id="msg" class="note"></div>
	</div>
<script>
(function(){
	const uid = ${JSON.stringify(uid)};
	const backendBase = ${JSON.stringify(backendBase)};
	const currency = ${JSON.stringify(currency)};
	const amount = ${JSON.stringify(lifetimeAmount)};
	const title = ${JSON.stringify(title)};
	const planId = ${JSON.stringify(planId)};

	function setMsg(text, cls){ var m=document.getElementById('msg'); m.textContent=text; m.className='note '+(cls||''); }
	function show(section){
		var sl=document.getElementById('section-lifetime');
		var sm=document.getElementById('section-monthly');
		var tl=document.getElementById('tab-lifetime');
		var tm=document.getElementById('tab-monthly');
		sl && (sl.style.display = section==='lifetime' ? 'block' : 'none');
		sm && (sm.style.display = section==='monthly' ? 'block' : 'none');
		tl && tl.classList.toggle('active', section==='lifetime');
		tm && tm.classList.toggle('active', section==='monthly');
	}

	// Init view - use plan parameter or default to lifetime
	const urlParams = new URLSearchParams(window.location.search);
	const planParam = urlParams.get('plan') || 'lifetime';
	show(planParam);

	// Tab handlers
	document.getElementById('tab-lifetime').addEventListener('click', function(){ show('lifetime'); });
	var tabMonthly = document.getElementById('tab-monthly');
	if (tabMonthly && !tabMonthly.classList.contains('dim')) {
		tabMonthly.addEventListener('click', function(){ show('monthly'); });
	}

	// Initialize PayPal buttons
	function initPayPalButtons() {
		console.log('initPayPalButtons called');
		console.log('paypal object:', typeof paypal, paypal);
		
		// Check if the DOM element exists
		const paypalBtnElement = document.getElementById('paypal-btn');
		console.log('paypal-btn element:', paypalBtnElement);
		
		// One-time (lifetime) button
		if (typeof paypal !== 'undefined' && paypal.Buttons && paypalBtnElement) {
			console.log('Creating PayPal buttons...');
			try {
				paypal.Buttons({
					style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
					createOrder: async function(){
						setMsg('Creating order…');
						const r = await fetch(backendBase + '/api/paypal/orders/create', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ amount, currency, title, figmaUserId: uid, type: 'lifetime' })
						});
						const j = await r.json();
						if (!r.ok) { throw new Error(j && j.error ? (j.error.message + (j.error.details ? (' - ' + j.error.details) : '')) : 'Create order failed'); }
						return j.id;
					},
					onApprove: async function(data){
						setMsg('Capturing payment…');
						const r = await fetch(backendBase + '/api/paypal/orders/capture', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ orderId: data.orderID })
						});
						const j = await r.json();
						if (!r.ok) { throw new Error(j && j.error ? j.error.message : 'Capture failed'); }
						setMsg('Payment complete. You can return to Figma.', 'ok');
					},
					onError: function(err){ setMsg('Error: '+ (err && err.message || err), 'err'); }
				}).render('#paypal-btn');
				console.log('PayPal buttons rendered successfully');
			} catch (error) {
				console.error('Error rendering PayPal buttons:', error);
				setMsg('Error rendering PayPal buttons: ' + error.message, 'err');
			}
		} else {
			console.log('PayPal SDK or DOM element not ready:', {
				paypal: typeof paypal,
				paypalButtons: typeof paypal?.Buttons,
				paypalBtnElement: !!paypalBtnElement
			});
			setMsg('PayPal SDK not loaded or DOM not ready. Please refresh the page.', 'err');
		}
	}

	// Wait for PayPal SDK to load, then initialize buttons
	let retryCount = 0;
	const maxRetries = 50; // 5 seconds max
	
	function waitForPayPal() {
		console.log('waitForPayPal called, checking conditions... (attempt', retryCount + 1, ')');
		const paypalReady = typeof paypal !== 'undefined' && paypal.Buttons;
		const domReady = document.getElementById('paypal-btn') !== null;
		
		console.log('Conditions:', { paypalReady, domReady });
		
		if (paypalReady && domReady) {
			console.log('Both PayPal SDK and DOM ready, initializing buttons');
			initPayPalButtons();
		} else if (retryCount < maxRetries) {
			retryCount++;
			console.log('Not ready yet, retrying in 100ms');
			setTimeout(waitForPayPal, 100);
		} else {
			console.error('PayPal SDK failed to load after', maxRetries, 'attempts');
			setMsg('PayPal SDK failed to load. Please refresh the page and try again.', 'err');
		}
	}
	
	// Start waiting for PayPal SDK
	waitForPayPal();

	// Subscription (monthly) button, only if planId present
	if (planId) {
		function loadScript(src){ return new Promise(function(resolve, reject){ var s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); }); }
		// Load SDK with subscription intent
		loadScript('https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(${JSON.stringify(clientId)}) + '&vault=true&intent=subscription&components=buttons').then(function(){
			paypal.Buttons({
				style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'subscribe' },
				createSubscription: function(data, actions) {
					return actions.subscription.create({ plan_id: planId, custom_id: uid });
				},
				onApprove: function(data, actions) {
					setMsg('Subscription started. You can return to Figma.', 'ok');
				},
				onError: function(err){ setMsg('Subscription error: ' + (err && err.message || err), 'err'); }
			}).render('#paypal-sub-btn');
		}).catch(function(err){ setMsg('Failed to load subscription SDK: ' + err, 'err'); });
	}
})();
</script>
</body>
</html>`;

	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	return res.status(200).send(html);
}
