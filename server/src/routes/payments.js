const router   = require('express').Router();
const supabase = require('../supabase');
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

router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabase
      .from('invoices')
      .select('*, creator:created_by(first_name, last_name), matter:matter_id(case_number), client:client_id(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (req.user.role === 'client') query = query.eq('client_id', req.user.id);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map(i => ({
      ...i,
      created_by_name: i.creator ? `${i.creator.first_name} ${i.creator.last_name}` : null,
      client_name:     i.client  ? `${i.client.first_name} ${i.client.last_name}`   : null,
      case_number:     i.matter?.case_number,
      creator: undefined, matter: undefined, client: undefined,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/invoice', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'client') return res.status(403).json({ error: 'Forbidden' });
    const { clientId, matterId, amount, description, serviceType, dueDate } = req.body;
    if (!clientId || !amount || !description)
      return res.status(400).json({ error: 'clientId, amount, and description are required' });

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        client_id:    clientId,
        matter_id:    matterId     || null,
        created_by:   req.user.id,
        amount:       Math.round(amount * 100),
        description,
        service_type: serviceType  || 'general',
        due_date:     dueDate      || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/checkout/:invoiceId', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(501).json({ error: 'Payment processing is not configured. Contact your legal team.' });

  try {
    const { data: invoice } = await supabase
      .from('invoices').select('*').eq('id', req.params.invoiceId).maybeSingle();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.client_id !== req.user.id && req.user.role === 'client')
      return res.status(403).json({ error: 'Forbidden' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice is already paid' });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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

    await supabase.from('invoices').update({ stripe_session_id: session.id }).eq('id', invoice.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not create payment session. Please try again.' });
  }
});

router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(200).json({ received: true });

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session   = event.data.object;
      const invoiceId = session.metadata?.invoiceId;
      if (invoiceId) {
        await supabase.from('invoices').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent,
        }).eq('id', invoiceId);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.get('/confirm/:sessionId', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });

  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (session.payment_status === 'paid') {
      const invoiceId = session.metadata?.invoiceId;
      if (invoiceId) {
        await supabase.from('invoices').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent,
        }).eq('id', invoiceId).neq('status', 'paid');
      }
      const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
      return res.json({ paid: true, invoice });
    }
    res.json({ paid: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
