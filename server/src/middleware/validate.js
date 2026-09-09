const { z } = require('zod');
const { SPECIAL_CHAR_RE } = require('../lib/passwordPolicy');

// Kept in sync with the frontend rule in client/src/lib/passwordPolicy.js
// (PASSWORD_RULES / SPECIAL_CHAR_RE) — same character class both sides, so a
// password the client-side checklist marks as satisfying every rule can never
// be rejected here, and vice versa. Reused for every password-setting route:
// /register, /reset-password, /reset-password/phone, /change-password.
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine(v => /[A-Z]/.test(v), 'Password must include at least one uppercase letter')
  .refine(v => /\d/.test(v), 'Password must include at least one number')
  .refine(v => SPECIAL_CHAR_RE.test(v), 'Password must include at least one special character (e.g. $ or %)');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      // Extract per-field messages from nested body issues so the client
      // can show "email: Invalid email" rather than a generic "Validation failed".
      const fields = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] === 'body' && issue.path[1] ? issue.path[1] : issue.path.join('.');
        if (!fields[field]) fields[field] = issue.message;
      }
      const detail = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('; ');
      return res.status(422).json({
        error: detail ? `Validation failed — ${detail}` : 'Validation failed',
        fields,
      });
    }
    req.validated = result.data;
    next();
  };
}

const schemas = {
  register: z.object({
    body: z.object({
      firstName:  z.string().min(1).max(100),
      lastName:   z.string().min(1).max(100),
      email:      z.string().email().max(255),
      password:   passwordSchema,
      role:       z.enum(['client', 'attorney', 'partner', 'itsupport']).default('client'),
      phone:      z.string().max(20).optional(),
    }),
  }),

  login: z.object({
    body: z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }),
  }),

  resetPassword: z.object({
    body: z.object({
      token:       z.string().min(1, 'Token required'),
      newPassword: passwordSchema,
    }),
  }),

  resetPasswordByPhone: z.object({
    body: z.object({
      phone:       z.string().min(1, 'Phone number required'),
      code:        z.string().min(1, 'Code required'),
      newPassword: passwordSchema,
    }),
  }),

  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password required'),
      newPassword:     passwordSchema,
    }),
  }),

  sendMessage: z.object({
    body: z.object({
      toUserId: z.number().int().positive(),
      matterId: z.number().int().positive().optional(),
      subject:  z.string().max(255).optional(),
      body:     z.string().min(1).max(10000),
    }),
  }),

  createMatter: z.object({
    body: z.object({
      matter_type:  z.string().min(1).max(100),
      description:  z.string().max(5000).optional(),
      client_id:    z.number().int().positive().optional(),
      court:        z.string().max(200).optional(),
      county:       z.string().max(100).optional(),
      urgent:       z.boolean().optional(),
      important_date: z.string().optional(),
    }),
  }),

  createTask: z.object({
    body: z.object({
      matter_id:    z.number().int().positive(),
      assigned_to:  z.number().int().positive().optional(),
      title:        z.string().min(1).max(255),
      description:  z.string().max(2000).optional(),
      due_date:     z.string().optional(),
      priority:     z.enum(['low', 'normal', 'high']).default('normal'),
      action_label: z.string().max(50).optional(),
    }),
  }),

  createAppointment: z.object({
    body: z.object({
      matter_id:  z.number().int().positive().optional(),
      title:      z.string().min(1).max(255),
      type:       z.enum(['teleconference', 'in-person']).default('teleconference'),
      start_time: z.string().datetime({ offset: true }),
      end_time:   z.string().datetime({ offset: true }).optional(),
      location:   z.string().max(300).optional(),
      notes:      z.string().max(2000).optional(),
    }),
  }),

  createInvoice: z.object({
    body: z.object({
      matter_id:    z.number().int().positive().optional(),
      client_id:    z.number().int().positive(),
      amount:       z.number().int().positive().max(100_000_00),
      currency:     z.enum(['usd', 'eur', 'gbp']).default('usd'),
      description:  z.string().min(1).max(500),
      service_type: z.string().max(100).optional(),
      due_date:     z.string().optional(),
    }),
  }),
};

module.exports = { validate, schemas };
