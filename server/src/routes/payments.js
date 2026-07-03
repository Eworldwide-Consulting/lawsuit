const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const InvoiceRepo         = require('../repositories/invoice.repository');
const UserRepo            = require('../repositories/user.repository');
const { parsePagination } = require('../lib/pagination');
const config              = require('../config');
const NotificationService = require('../services/notification.service');
const EmailService        = require('../services/email.service');
const AuditService        = require('../services/audit.service');
const ws                  = require('../websocket');

// Stripe is lazily disabled when no key is configured (routes return 501).
// Key prefix vs NODE_ENV mismatch is caught at startup in config/index.js.
const stripe = config.stripe.secretKey
  ? require('stripe')(config.stripe.secretKey)
  : null;

// Test key → use test webhook secret; live key → use live webhook secret
const webhookSecret = config.stripe.secretKey?.startsWith('sk_test_')
  ? (config.stripe.testWebhookSecret || config.stripe.webhookSecret)
  : config.stripe.webhookSecret;

const PRIME_PLAN = {
  name:        'TriVanta Prime',
  description: 'Priority attorney access, unlimited documents, monthly strategy call',
  amount:      29900,
  currency:    'usd',
  interval:    'month',
};

// ── List invoices ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const { status, from, to } = req.query;

    if (req.user.role === 'client') {
      let rows = await InvoiceRepo.findByClient(req.user.id, pagination);
      if (status) rows = rows.filter(r => r.status === status);
      return res.json(rows);
    }

    // Staff: optional filters
    if (status || from || to) {
      const rows = await InvoiceRepo.findForExport({
        status: status || null,
        from:   from   || null,
        to:     to     || null,
      });
      return res.json(rows);
    }
    res.json(await InvoiceRepo.findAll(pagination));
  } catch (err) { next(err); }
});

// ── Create invoice ────────────────────────────────────────────────────────────
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

    // Email the client about the new invoice
    try {
      const client = await UserRepo.findById(clientId);
      if (client?.email) {
        EmailService.sendInvoiceCreated(client.email, {
          amount: invoice.amount,
          description: invoice.description,
          dueDate: invoice.due_date,
        });
      }
    } catch { /* non-fatal */ }

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.INVOICE_CREATED,
      entity: 'invoice', entityId: invoice.id,
      meta: { amount, clientId },
      ip: req.ip,
    });

    res.status(201).json(invoice);
  } catch (err) { next(err); }
});

// ── Update invoice (staff only, unpaid invoices only) ─────────────────────────
router.put('/invoice/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'client') return res.status(403).json({ error: 'Forbidden' });
    const inv = await InvoiceRepo.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Cannot edit a paid invoice' });

    const { description, amount, dueDate, serviceType } = req.body;
    const fields = {};
    if (description !== undefined) fields.description  = description;
    if (amount      !== undefined) fields.amount       = Math.round(Number(amount) * 100);
    if (dueDate     !== undefined) fields.due_date     = dueDate || null;
    if (serviceType !== undefined) fields.service_type = serviceType;

    await InvoiceRepo.update(req.params.id, fields);
    AuditService.log({
      userId: req.user.id, action: 'invoice.updated',
      entity: 'invoice', entityId: req.params.id,
      ip: req.ip,
    });
    res.json(await InvoiceRepo.findById(req.params.id));
  } catch (err) { next(err); }
});

// ── Delete invoice (staff only, pending/failed only) ──────────────────────────
router.delete('/invoice/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'client') return res.status(403).json({ error: 'Forbidden' });
    const inv = await InvoiceRepo.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'paid') return res.status(400).json({ error: 'Cannot delete a paid invoice' });

    await InvoiceRepo.delete(req.params.id);
    AuditService.log({
      userId: req.user.id, action: 'invoice.deleted',
      entity: 'invoice', entityId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Stripe checkout ───────────────────────────────────────────────────────────
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
        price_data: {
          currency: 'usd',
          unit_amount: inv.amount,
          product_data: { name: inv.description },
        },
        quantity: 1,
      }],
      metadata:      { invoiceId: String(inv.id) },
      success_url:   `${config.client.url}/payments?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:    `${config.client.url}/payments?cancelled=1`,
      customer_email: req.user.email,
    });

    await InvoiceRepo.setStripeSession(inv.id, session.id);
    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// ── Refund ────────────────────────────────────────────────────────────────────
router.post('/refund', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  if (!stripe) return res.status(501).json({ error: 'Payment processing not configured.' });
  try {
    const { invoiceId, reason } = req.body;
    if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

    const inv = await InvoiceRepo.findById(invoiceId);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status !== 'paid') return res.status(400).json({ error: 'Invoice is not paid' });
    if (inv.status === 'refunded') return res.status(400).json({ error: 'Already refunded' });
    if (!inv.stripe_payment_intent_id)
      return res.status(400).json({ error: 'No payment intent on record — cannot refund' });

    const refund = await stripe.refunds.create({
      payment_intent: inv.stripe_payment_intent_id,
      reason: 'requested_by_customer',
    });

    await InvoiceRepo.markRefunded(inv.id, {
      refundAmount:  refund.amount,
      reason:        reason || null,
      stripeRefundId: refund.id,
    });

    // Notify client
    if (inv.client_id) {
      NotificationService.create({
        userId: inv.client_id,
        type: 'invoice_refunded',
        title: 'Refund processed',
        body: `A refund of $${(refund.amount / 100).toFixed(2)} has been issued for invoice #${inv.id}.`,
        entityType: 'invoice',
        entityId: inv.id,
      });
      ws.emitToUser(inv.client_id, 'invoice:refunded', { invoiceId: inv.id });
      try {
        const client = await UserRepo.findById(inv.client_id);
        if (client?.email) {
          EmailService.sendMatterStatusChanged(client.email, {
            caseNumber: `Invoice #${inv.id}`,
            newStatus: `Refunded — $${(refund.amount / 100).toFixed(2)}`,
          });
        }
      } catch { /* non-fatal */ }
    }

    AuditService.log({
      userId: req.user.id, action: 'invoice.refunded',
      entity: 'invoice', entityId: inv.id,
      meta: { refundId: refund.id, amount: refund.amount, reason: reason || null },
      ip: req.ip,
    });

    res.json({ success: true, refundId: refund.id, amount: refund.amount });
  } catch (err) { next(err); }
});

// ── Receipt HTML page ─────────────────────────────────────────────────────────
// Opens in a new tab — browser print (Ctrl+P / Cmd+P) saves as PDF.
router.get('/receipt/:invoiceId', requireAuth, async (req, res, next) => {
  try {
    const inv = await InvoiceRepo.findWithDetails(req.params.invoiceId);
    if (!inv) return res.status(404).send('Invoice not found');

    const canView = req.user.role !== 'client' || inv.client_id === req.user.id;
    if (!canView) return res.status(403).send('Forbidden');
    if (inv.status !== 'paid' && inv.status !== 'refunded')
      return res.status(400).send('Receipt only available for paid invoices');

    const fmt    = n => `$${(n / 100).toFixed(2)}`;
    const fmtDt  = d => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const receiptNo = `RCP-${String(inv.id).padStart(6, '0')}`;
    const clientName = `${inv.client_first || ''} ${inv.client_last || ''}`.trim();
    const attyName   = `${inv.attorney_first || ''} ${inv.attorney_last || ''}`.trim();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt ${receiptNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;color:#111827;padding:40px 20px}
  .page{max-width:680px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:#0f2057;padding:32px 40px;display:flex;align-items:center;justify-content:space-between}
  .brand{color:#d4a017;font-size:22px;font-weight:800;letter-spacing:1px}
  .brand-sub{color:#93aadc;font-size:11px;letter-spacing:2px;margin-top:3px}
  .receipt-badge{background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:700;padding:6px 14px;border-radius:8px;letter-spacing:.5px}
  .body{padding:36px 40px}
  .status-banner{display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:10px;margin-bottom:28px;font-weight:600;font-size:15px}
  .status-paid{background:#d1fae5;color:#065f46}
  .status-refunded{background:#fef3c7;color:#92400e}
  .checkmark{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .checkmark-paid{background:#059669;color:#fff}
  .checkmark-refunded{background:#d97706;color:#fff}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;margin-bottom:12px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:28px}
  .info-item label{font-size:12px;color:#9ca3af;font-weight:500;display:block;margin-bottom:3px}
  .info-item span{font-size:14px;color:#111827;font-weight:600}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0}
  .line-items{width:100%;border-collapse:collapse;margin-bottom:24px}
  .line-items th{text-align:left;font-size:12px;color:#6b7280;font-weight:600;padding:8px 0;border-bottom:1px solid #e5e7eb}
  .line-items td{padding:12px 0;font-size:14px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  .line-items td.right{text-align:right;font-weight:600;color:#111827}
  .totals{margin-left:auto;width:220px}
  .total-row{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;color:#6b7280}
  .total-row.grand{font-size:17px;font-weight:800;color:#0f2057;border-top:2px solid #0f2057;margin-top:8px;padding-top:10px}
  .txn-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-top:24px;font-size:13px;color:#6b7280}
  .txn-box strong{color:#111827}
  .footer{background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">TRIVANTA</div>
      <div class="brand-sub">LEGAL PLATFORM</div>
    </div>
    <div class="receipt-badge">RECEIPT</div>
  </div>
  <div class="body">
    <div class="status-banner ${inv.status === 'paid' ? 'status-paid' : 'status-refunded'}">
      <div class="checkmark ${inv.status === 'paid' ? 'checkmark-paid' : 'checkmark-refunded'}">&#10003;</div>
      ${inv.status === 'paid' ? 'Payment Confirmed' : 'Refund Processed'}
    </div>

    <p class="section-title">Receipt Details</p>
    <div class="info-grid">
      <div class="info-item"><label>Receipt Number</label><span>${receiptNo}</span></div>
      <div class="info-item"><label>Invoice Number</label><span>#${inv.id}</span></div>
      <div class="info-item"><label>Payment Date</label><span>${fmtDt(inv.paid_at)}</span></div>
      ${inv.case_number ? `<div class="info-item"><label>Case Number</label><span>${inv.case_number}</span></div>` : ''}
    </div>

    <hr class="divider">
    <p class="section-title">Parties</p>
    <div class="info-grid">
      <div class="info-item"><label>Client</label><span>${clientName || '—'}</span></div>
      ${attyName ? `<div class="info-item"><label>Attorney</label><span>${attyName}</span></div>` : ''}
    </div>

    <hr class="divider">
    <p class="section-title">Services</p>
    <table class="line-items">
      <thead>
        <tr><th>Description</th><th>Type</th><th class="right">Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${inv.description}</td>
          <td style="color:#6b7280;font-size:13px;text-transform:capitalize">${(inv.service_type || 'general').replace(/_/g,' ')}</td>
          <td class="right">${fmt(inv.amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>${fmt(inv.amount)}</span></div>
      <div class="total-row"><span>Tax</span><span>$0.00</span></div>
      <div class="total-row grand"><span>Total Paid</span><span>${fmt(inv.amount)}</span></div>
      ${inv.status === 'refunded' ? `<div class="total-row" style="color:#d97706"><span>Refunded</span><span>-${fmt(inv.refund_amount || inv.amount)}</span></div>` : ''}
    </div>

    ${inv.stripe_payment_intent_id ? `
    <div class="txn-box">
      <div style="margin-bottom:6px"><strong>Transaction ID:</strong> ${inv.stripe_payment_intent_id}</div>
      <div><strong>Payment Method:</strong> Card (via Stripe)</div>
    </div>` : ''}
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} TriVanta Legal Platform &nbsp;&middot;&nbsp;
    This is an official payment receipt. &nbsp;&middot;&nbsp;
    <a href="${config.client.url}" style="color:#0f2057">trivanta.io</a>
  </div>
</div>
<script>window.onload=function(){window.print&&window.addEventListener('load',function(){})}</script>
</body>
</html>`);
  } catch (err) { next(err); }
});

// ── CSV export ────────────────────────────────────────────────────────────────
router.get('/export', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    const { status, from, to, clientId } = req.query;
    const rows = await InvoiceRepo.findForExport({
      status: status || null,
      from:   from   || null,
      to:     to     || null,
      clientId: clientId ? Number(clientId) : null,
    });

    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['ID','Status','Amount (USD)','Description','Service Type','Client','Email','Case #','Due Date','Created','Paid At'];
    const csvRows = rows.map(r => [
      r.id, r.status, (r.amount / 100).toFixed(2), r.description,
      r.service_type || '', r.client_name || '', r.client_email || '',
      r.case_number || '', r.due_date || '', r.created_at || '', r.paid_at || '',
    ].map(esc).join(','));

    const csv = [header.map(esc).join(','), ...csvRows].join('\r\n');
    const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM for Excel UTF-8 compatibility
  } catch (err) { next(err); }
});

// ── Stripe webhook ────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  if (!stripe) return res.json({ received: true });
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], webhookSecret
    );
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  try {
    switch (event.type) {

      // ── Checkout completed (one-time invoice or Prime subscription) ─────────
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.metadata?.invoiceId) {
          await InvoiceRepo.markPaid(s.metadata.invoiceId, s.payment_intent);
          const inv = await InvoiceRepo.findById(s.metadata.invoiceId);
          if (inv?.client_id) {
            ws.emitToUser(inv.client_id, 'invoice:paid', { invoiceId: inv.id });
            NotificationService.create({
              userId: inv.client_id,
              type: 'invoice_paid',
              title: 'Payment received',
              body: `Invoice #${inv.id} has been paid successfully.`,
              entityType: 'invoice',
              entityId: inv.id,
            });
            // Notify the attorney who created the invoice
            if (inv.created_by) {
              NotificationService.create({
                userId: inv.created_by,
                type: 'invoice_paid',
                title: 'Client payment received',
                body: `Invoice #${inv.id} ($${(inv.amount / 100).toFixed(2)}) has been paid.`,
                entityType: 'invoice',
                entityId: inv.id,
              });
            }
          }
          AuditService.log({
            userId: inv?.client_id || null, action: AuditService.ACTIONS.INVOICE_PAID,
            entity: 'invoice', entityId: s.metadata.invoiceId,
            meta: { paymentIntent: s.payment_intent, amount: s.amount_total },
          });
        }
        // Prime subscription — activate membership AND record invoice + transaction
        if (s.mode === 'subscription' && s.metadata?.plan === 'prime' && s.metadata?.userId) {
          const uid = Number(s.metadata.userId);
          await UserRepo.update(uid, { is_prime: 1 });

          // Create a paid invoice so the transaction appears in Billing history
          const primeInv = await InvoiceRepo.create({
            clientId:    uid,
            matterId:    null,
            createdBy:   uid,
            amount:      PRIME_PLAN.amount / 100,        // cents → dollars (repo multiplies by 100)
            description: 'TriVanta Prime — Monthly Subscription',
            serviceType: 'prime_subscription',
            dueDate:     null,
          });
          // Mark paid with the Stripe payment_intent from the checkout session
          await InvoiceRepo.markPaid(primeInv.id, s.payment_intent || s.id);

          ws.emitToUser(uid, 'prime:activated', { invoiceId: primeInv.id });
          NotificationService.create({
            userId:     uid,
            type:       'invoice_paid',
            title:      'TriVanta Prime activated',
            body:       `Your Prime membership is active. Receipt available for invoice #${primeInv.id}.`,
            entityType: 'invoice',
            entityId:   primeInv.id,
          });
          AuditService.log({
            userId: uid, action: 'user.prime_activated',
            entity: 'invoice', entityId: primeInv.id,
            meta: { subscriptionId: s.subscription, amount: PRIME_PLAN.amount },
          });
        }
        break;
      }

      // ── Payment intent succeeded (alternative to checkout.session.completed) ─
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const inv = await require('../db').one(
          "SELECT * FROM invoices WHERE stripe_payment_intent_id = ?", [pi.id]
        );
        if (inv && inv.status !== 'paid') {
          await InvoiceRepo.markPaid(inv.id, pi.id);
          if (inv.client_id) {
            ws.emitToUser(inv.client_id, 'invoice:paid', { invoiceId: inv.id });
          }
        }
        break;
      }

      // ── Payment failed ────────────────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const inv = await require('../db').one(
          "SELECT * FROM invoices WHERE stripe_payment_intent_id = ? OR stripe_session_id IN (SELECT id FROM invoices WHERE stripe_payment_intent_id = ?)",
          [pi.id, pi.id]
        ).catch(() => null);
        if (inv) {
          await InvoiceRepo.markFailed(inv.id, pi.last_payment_error?.message || 'Payment failed');
          if (inv.client_id) {
            ws.emitToUser(inv.client_id, 'invoice:failed', { invoiceId: inv.id });
            NotificationService.create({
              userId: inv.client_id,
              type: 'payment_failed',
              title: 'Payment failed',
              body: `Payment for invoice #${inv.id} failed. Please try again.`,
              entityType: 'invoice',
              entityId: inv.id,
            });
          }
          AuditService.log({
            userId: inv.client_id || null, action: 'invoice.payment_failed',
            entity: 'invoice', entityId: inv.id,
            meta: { reason: pi.last_payment_error?.message },
          });
        }
        break;
      }

      // ── Charge refunded (can come from Stripe dashboard or API) ──────────────
      case 'charge.refunded': {
        const charge = event.data.object;
        const inv = await require('../db').one(
          "SELECT * FROM invoices WHERE stripe_payment_intent_id = ?", [charge.payment_intent]
        ).catch(() => null);
        if (inv && inv.status !== 'refunded') {
          await InvoiceRepo.markRefunded(inv.id, {
            refundAmount:   charge.amount_refunded,
            reason:         'refunded_via_stripe',
            stripeRefundId: charge.refunds?.data?.[0]?.id || null,
          });
          if (inv.client_id) {
            ws.emitToUser(inv.client_id, 'invoice:refunded', { invoiceId: inv.id });
            NotificationService.create({
              userId: inv.client_id,
              type: 'invoice_refunded',
              title: 'Refund processed',
              body: `$${(charge.amount_refunded / 100).toFixed(2)} has been refunded for invoice #${inv.id}.`,
              entityType: 'invoice',
              entityId: inv.id,
            });
          }
        }
        break;
      }

      // ── Prime subscription cancelled / paused ─────────────────────────────────
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const sub = event.data.object;
        if (sub.metadata?.userId) {
          await UserRepo.update(Number(sub.metadata.userId), { is_prime: 0 });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    require('../logger').error({ err, eventType: event?.type }, 'Webhook handler error');
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

// ── Prime subscription checkout ───────────────────────────────────────────────
router.post('/prime-checkout', requireAuth, async (req, res, next) => {
  if (!stripe) return res.status(501).json({ error: 'Payment processing not configured.' });
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });
  if (req.user.is_prime) return res.status(400).json({ error: 'Already a Prime member' });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'subscription',
      billing_address_collection: 'required',
      customer_email:       req.user.email,
      line_items: [{
        price_data: {
          currency:    PRIME_PLAN.currency,
          unit_amount: PRIME_PLAN.amount,
          recurring:   { interval: PRIME_PLAN.interval },
          product_data: { name: PRIME_PLAN.name, description: PRIME_PLAN.description },
        },
        quantity: 1,
      }],
      metadata:    { userId: String(req.user.id), plan: 'prime' },
      success_url: `${config.client.url}/payments?prime_success=1`,
      cancel_url:  `${config.client.url}/payments?prime_cancelled=1`,
    });
    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// ── Plan status ───────────────────────────────────────────────────────────────
router.get('/plan-status', requireAuth, async (req, res, next) => {
  try {
    const user = await UserRepo.findById(req.user.id);
    res.json({ is_prime: Boolean(user?.is_prime) });
  } catch (err) { next(err); }
});

// ── Confirm after Stripe redirect ─────────────────────────────────────────────
router.get('/confirm/:sessionId', requireAuth, async (req, res, next) => {
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (!session.metadata?.invoiceId)
      return res.json({ paid: session.payment_status === 'paid' });

    const invoice = await InvoiceRepo.findById(session.metadata.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const canView = req.user.role !== 'client' || invoice.client_id === req.user.id;
    if (!canView) return res.status(403).json({ error: 'Forbidden' });

    res.json({ paid: invoice.status === 'paid', invoice });
  } catch (err) { next(err); }
});

// ── Admin: payment stats ──────────────────────────────────────────────────────
router.get('/stats', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    const { one, all } = require('../db');
    const [totals, recent, byStatus] = await Promise.all([
      one(`SELECT
        COUNT(*)                                              AS total,
        COALESCE(SUM(CASE WHEN status='paid'     THEN amount ELSE 0 END),0) AS revenue,
        COALESCE(SUM(CASE WHEN status='pending'  THEN amount ELSE 0 END),0) AS outstanding,
        COALESCE(SUM(CASE WHEN status='refunded' THEN refund_amount ELSE 0 END),0) AS refunded,
        SUM(CASE WHEN status='paid'     THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status='failed'   THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN status='refunded' THEN 1 ELSE 0 END) AS refunded_count
        FROM invoices`),
      all(`SELECT i.id, i.amount, i.status, i.created_at, i.paid_at,
                  (c.first_name || ' ' || c.last_name) AS client_name
           FROM invoices i LEFT JOIN users c ON c.id = i.client_id
           ORDER BY i.created_at DESC LIMIT 5`),
      all(`SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total
           FROM invoices GROUP BY status`),
    ]);
    res.json({ totals, recentInvoices: recent, byStatus });
  } catch (err) { next(err); }
});

module.exports = router;
