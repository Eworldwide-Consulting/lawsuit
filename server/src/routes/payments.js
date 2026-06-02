const router = require('express').Router();
const { all, one, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

const getStripe = () => process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

router.get('/', requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'client') {
      rows = await all(`SELECT i.*, CONCAT(u.first_name,' ',u.last_name) AS created_by_name, m.case_number FROM invoices i LEFT JOIN users u ON i.created_by=u.id LEFT JOIN matters m ON i.matter_id=m.id WHERE i.client_id=? ORDER BY i.created_at DESC`, [req.user.id]);
    } else {
      rows = await all(`SELECT i.*, CONCAT(c.first_name,' ',c.last_name) AS client_name, m.case_number FROM invoices i LEFT JOIN users c ON i.client_id=c.id LEFT JOIN matters m ON i.matter_id=m.id ORDER BY i.created_at DESC`);
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/invoice', requireAuth, async (req, res) => {
  if (req.user.role === 'client') return res.status(403).json({ error: 'Forbidden' });
  const { clientId, matterId, amount, description, serviceType, dueDate } = req.body;
  if (!clientId || !amount || !description) return res.status(400).json({ error: 'clientId, amount, description required' });
  try {
    const r = await run('INSERT INTO invoices (client_id,matter_id,created_by,amount,description,service_type,due_date,status) VALUES (?,?,?,?,?,?,?,?)',
      [clientId, matterId||null, req.user.id, Math.round(amount*100), description, serviceType||'general', dueDate||null, 'pending']);
    res.status(201).json(await one('SELECT * FROM invoices WHERE id=?', [r.insertId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/checkout/:invoiceId', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(501).json({ error: 'Payment processing not configured.' });
  const inv = await one('SELECT * FROM invoices WHERE id=?', [req.params.invoiceId]);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.client_id !== req.user.id && req.user.role === 'client') return res.status(403).json({ error: 'Forbidden' });
  if (inv.status === 'paid') return res.status(400).json({ error: 'Already paid' });
  try {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], mode: 'payment',
      line_items: [{ price_data: { currency: 'usd', unit_amount: inv.amount, product_data: { name: inv.description } }, quantity: 1 }],
      metadata: { invoiceId: String(inv.id) },
      success_url: `${clientUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${clientUrl}/payments?cancelled=1`,
      customer_email: req.user.email,
    });
    await run('UPDATE invoices SET stripe_session_id=? WHERE id=?', [session.id, inv.id]);
    res.json({ url: session.url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.json({ received: true });
  try {
    const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.metadata?.invoiceId) await run('UPDATE invoices SET status=?,paid_at=NOW(),stripe_payment_intent_id=? WHERE id=?', ['paid', s.payment_intent, s.metadata.invoiceId]);
    }
    res.json({ received: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/confirm/:sessionId', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (session.payment_status === 'paid' && session.metadata?.invoiceId) {
      await run('UPDATE invoices SET status=?,paid_at=NOW(),stripe_payment_intent_id=? WHERE id=? AND status!=?', ['paid', session.payment_intent, session.metadata.invoiceId, 'paid']);
      return res.json({ paid: true, invoice: await one('SELECT * FROM invoices WHERE id=?', [session.metadata.invoiceId]) });
    }
    res.json({ paid: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
