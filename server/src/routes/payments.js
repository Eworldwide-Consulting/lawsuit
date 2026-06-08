const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const InvoiceRepo         = require('../repositories/invoice.repository');
const { parsePagination } = require('../lib/pagination');
const config              = require('../config');
const NotificationService = require('../services/notification.service');
const AuditService        = require('../services/audit.service');
const ws                  = require('../websocket');

const stripe = config.stripe.secretKey
  ? require('stripe')(config.stripe.secretKey)
  : null;

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    res.json(
      req.user.role === 'client'
        ? await InvoiceRepo.findByClient(req.user.id, pagination)
        : await InvoiceRepo.findAll(pagination)
    );
  } catch (err) { next(err); }
});

router.post('/invoice', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'client') return res.status(403).json({ error: 'Forbidden' });
    const { clientId, matterId, amount, description, serviceType, dueDate } = req.body;
    if (!clientId || !amount || !description)
      return res.status(400).json({ error: 'clientId, amount, description required' });
    const invoice = await InvoiceRepo.create({
      clientId, matterId, createdBy: req.user.id, amount, description, serviceType, dueDate,
    });

    NotificationService.invoiceCreated(clientId, { amount, invoiceId: invoice.id });
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.INVOICE_CREATED,
      entity: 'invoice', entityId: invoice.id,
      meta: { amount, clientId },
      ip: req.ip,
    });

    res.status(201).json(invoice);
  } catch (err) { next(err); }
});

router.post('/checkout/:invoiceId', requireAuth, async (req, res, next) => {
  if (!stripe) return res.status(501).json({ error: 'Payment processing not configured.' });
  try {
    const inv = await InvoiceRepo.findById(req.params.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (req.user.role === 'client' && inv.client_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: { currency: 'usd', unit_amount: inv.amount, product_data: { name: inv.description } },
        quantity: 1,
      }],
      metadata:      { invoiceId: String(inv.id) },
      success_url:   `${config.client.url}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:    `${config.client.url}/payments?cancelled=1`,
      customer_email: req.user.email,
    });

    await InvoiceRepo.setStripeSession(inv.id, session.id);
    res.json({ url: session.url });
  } catch (err) { next(err); }
});

router.post('/webhook', async (req, res) => {
  if (!stripe) return res.json({ received: true });
  try {
    const event = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], config.stripe.webhookSecret
    );
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.metadata?.invoiceId) {
        await InvoiceRepo.markPaid(s.metadata.invoiceId, s.payment_intent);
        // Push real-time confirmation to the client's browser
        const inv = await InvoiceRepo.findById(s.metadata.invoiceId);
        if (inv?.client_id) {
          ws.emitToUser(inv.client_id, 'invoice:paid', { invoiceId: inv.id });
        }
        AuditService.log({
          userId: inv?.client_id || null, action: AuditService.ACTIONS.INVOICE_PAID,
          entity: 'invoice', entityId: s.metadata.invoiceId,
          meta: { paymentIntent: s.payment_intent },
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Read-only confirmation poll — client calls this after Stripe redirect.
// markPaid is ONLY done by the webhook; this never writes to avoid double-payment or spoofing.
router.get('/confirm/:sessionId', requireAuth, async (req, res, next) => {
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (!session.metadata?.invoiceId)
      return res.json({ paid: session.payment_status === 'paid' });

    const invoice = await InvoiceRepo.findById(session.metadata.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // M5: explicit precedence — clients see only their own invoices; staff see all
    const canView = req.user.role !== 'client' || invoice.client_id === req.user.id;
    if (!canView) return res.status(403).json({ error: 'Forbidden' });

    res.json({ paid: invoice.status === 'paid', invoice });
  } catch (err) { next(err); }
});

module.exports = router;