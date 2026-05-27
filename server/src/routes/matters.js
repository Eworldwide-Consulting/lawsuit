const router   = require('express').Router();
const supabase = require('../supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

const STAGES = ['intake','hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];

router.get('/', requireAuth, async (req, res) => {
  try {
    let query = supabase.from('matters').select(`
      *,
      attorney:attorney_id(first_name, last_name),
      client:client_id(first_name, last_name)
    `).order('updated_at', { ascending: false });

    if (req.user.role === 'client') {
      query = query.eq('client_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const matters = (data || []).map(m => ({
      ...m,
      attorney_name: m.attorney ? `${m.attorney.first_name} ${m.attorney.last_name}` : null,
      client_name:   m.client   ? `${m.client.first_name} ${m.client.last_name}`     : null,
      attorney: undefined,
      client:   undefined,
    }));

    res.json(matters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /stats/overview must be before /:id
router.get('/stats/overview', requireAuth, async (req, res) => {
  try {
    const [
      { count: total },
      { count: active },
      { count: atRisk },
      { count: complete },
    ] = await Promise.all([
      supabase.from('matters').select('*', { count: 'exact', head: true }),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('status', 'at_risk'),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('status', 'complete'),
    ]);
    res.json({ total, active, atRisk, complete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: m, error } = await supabase
      .from('matters')
      .select(`*, client:client_id(first_name, last_name, email, phone), attorney:attorney_id(first_name, last_name)`)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!m) return res.status(404).json({ error: 'Matter not found' });

    res.json({
      ...m,
      client_name:   m.client   ? `${m.client.first_name} ${m.client.last_name}`     : null,
      client_email:  m.client?.email,
      client_phone:  m.client?.phone,
      attorney_name: m.attorney ? `${m.attorney.first_name} ${m.attorney.last_name}` : null,
      client: undefined, attorney: undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterType, description, court, county, urgent, importantDate,
            hasDocuments, workedWithFirmBefore, additionalNotes, matterStatus } = req.body;

    const { data: inserted, error } = await supabase
      .from('matters')
      .insert({
        client_id: req.user.id,
        matter_type: matterType || null,
        stage: 'intake',
        description: description || null,
        court: court || null,
        county: county || null,
        urgent: !!urgent,
        important_date: importantDate || null,
        has_documents: !!hasDocuments,
        worked_with_firm_before: !!workedWithFirmBefore,
        additional_notes: additionalNotes || null,
        status: matterStatus || 'active',
      })
      .select()
      .single();

    if (error) throw error;

    const caseNum = `${new Date().getFullYear().toString().slice(2)}-${String(inserted.id).padStart(4, '0')}`;
    await supabase.from('matters').update({ case_number: caseNum }).eq('id', inserted.id);

    const { data: matter } = await supabase.from('matters').select('*').eq('id', inserted.id).single();
    res.status(201).json(matter);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, requireRole('attorney', 'partner'), async (req, res) => {
  try {
    const { stage, status, description, court, county, urgent, importantDate, additionalNotes } = req.body;
    const updates = {};
    if (stage            !== undefined) updates.stage            = stage;
    if (status           !== undefined) updates.status           = status;
    if (description      !== undefined) updates.description      = description;
    if (court            !== undefined) updates.court            = court;
    if (county           !== undefined) updates.county           = county;
    if (urgent           !== undefined) updates.urgent           = !!urgent;
    if (importantDate    !== undefined) updates.important_date   = importantDate;
    if (additionalNotes  !== undefined) updates.additional_notes = additionalNotes;

    const { error } = await supabase.from('matters').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/timeline', requireAuth, async (req, res) => {
  try {
    const { data: m } = await supabase
      .from('matters').select('stage').eq('id', req.params.id).maybeSingle();
    if (!m) return res.status(404).json({ error: 'Not found' });
    const current = STAGES.indexOf(m.stage);
    res.json(STAGES.map((s, i) => ({
      stage: s, completed: i < current, current: i === current, upcoming: i > current,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
