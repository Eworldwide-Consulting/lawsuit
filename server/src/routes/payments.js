const router  = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

const SERVICE_LABELS = {
  consultation:  'Initial Consultation',
  retainer:      'Monthly Retainer',
  filing:        'Document Filing Fee',
  annual_return: 'Annual Return Filing',
  general:       'Legal Services',
};

// ── List invoices ──────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  let rows;
  if (req.user.role === 'client') {
    rows = db.prepare(`
      SELECT i.*, u.first_name || ' ' || u.last_name AS created_by_name,
             m.case_number
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN matters m ON i.matter_id = m.id
      WHERE i.client_id = ?
      ORDER BY i.created_at DESC
    `).all(req.user.id);
  } else {
    rows = db.prepare(`
      SELECT i.*, c.first_name || ' ' || c.last_name AS client_name,
             m.case_number
      FROM invoices i
      LEFT JOIN users c ON i.client_id = c.id
      LEFT JOIN matters m ON i.matter_id = m.id
      ORDER BY i.created_at DESC
    `).all();
  }
  res.json(rows);
});

// ── Create invoice (attorney / partner only) ───────────────────────────────────
router.post('/invoice', requireAuth, (req, res) => {
  if (req.user.role === 'client') return res.status(403).json({ error: 'Forbidden' });
  const { clientId, matterId, amount, description, serviceType, dueDate } = req.body;
  if (!clientId || !amount || !description) {
    return res.status(400).json({ error: 'clientId, amount, and description are required' });
  }
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO invoices (client_id, matter_id, created_by, amount, description, service_type, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(clientId, matterId || null, req.user.id, Math.round(amount * 100), description,
         serviceType || 'general', dueDate || null);
  res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid));
});

// ── Create Stripe Checkout session ────────────────────────────────────────────
router.post('/checkout/:invoiceId', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(501).json({ error: 'Payment processing is not configured. Contact your legal team.' });
  }

  const db = getDb();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.invoiceId);

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.client_id !== req.user.id && req.user.role === 'client') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (invoice.status === 'paid') {
    return res.status(400).json({ error: 'Invoice is already paid' });
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency:     invoice.currency || 'usd',
          unit_amount:  invoice.amount,
          product_data: {
            name:        SERVICE_LABELS[invoice.service_type] || 'Legal Services',
            description: invoice.description,
          },
        },
        quantity: 1,
      }],
      metadata:    { invoiceId: String(invoice.id) },
      success_url: `${clientUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${clientUrl}/payments?cancelled=1`,
      customer_email: req.user.email,
    });

    db.prepare('UPDATE invoices SET stripe_session_id = ? WHERE id = ?')
      .run(session.id, invoice.id);

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not create payment session. Please try again.' });
  }
});

// ── Stripe Webhook (raw body parsed in index.js) ───────────────────────────────
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(200).json({ received: true });

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoiceId;
    if (invoiceId) {
      const db = getDb();
      db.prepare(`
        UPDATE invoices
        SET status = 'paid', paid_at = datetime('now'),
            stripe_payment_intent_id = ?
        WHERE id = ?
      `).run(session.payment_intent, invoiceId);
    }
  }

  res.json({ received: true });
});

// ── Confirm payment after Stripe redirect ─────────────────────────────────────
router.get('/confirm/:sessionId', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });

  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (session.payment_status === 'paid') {
      const db = getDb();
      const invoiceId = session.metadata?.invoiceId;
      if (invoiceId) {
        db.prepare(`
          UPDATE invoices
          SET status = 'paid', paid_at = datetime('now'),
              stripe_payment_intent_id = ?
          WHERE id = ? AND status != 'paid'
        `).run(session.payment_intent, invoiceId);
      }
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
      return res.json({ paid: true, invoice });
    }
    res.json({ paid: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
