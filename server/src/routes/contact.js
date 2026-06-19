const router     = require('express').Router();
const rateLimit  = require('express-rate-limit');
const EmailService = require('../services/email.service');
const AuditService = require('../services/audit.service');

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour window
  max:      5,                  // 5 enquiries per IP per hour
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: 'Too many enquiries submitted. Please try again in an hour.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', contactLimiter, async (req, res, next) => {
  try {
    const { name, email, company, phone, plan, message } = req.body;

    if (!name?.trim() || !email?.trim() || !message?.trim())
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    if (!EMAIL_RE.test(email.trim()))
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (name.length > 120 || message.length > 2000 || (company || '').length > 200)
      return res.status(400).json({ error: 'Input exceeds maximum length.' });

    await EmailService.sendContactSales({
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      company: (company || '').trim(),
      phone:   (phone || '').trim(),
      plan:    plan || 'Enterprise',
      message: message.trim(),
    });

    AuditService.log({
      action: 'contact.sales_enquiry',
      meta:   { email: email.trim().toLowerCase(), plan: plan || 'Enterprise' },
      ip:     req.ip,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;