const router   = require('express').Router();
const supabase = require('../supabase');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      const { data: matters } = await supabase
        .from('matters').select('id').eq('client_id', req.user.id);
      const ids = (matters || []).map(m => m.id);
      if (!ids.length) return res.json([]);
      const { data, error } = await supabase
        .from('appointments').select('*').in('matter_id', ids).order('start_time', { ascending: true });
      if (error) throw error;
      return res.json(data || []);
    }
    const { data, error } = await supabase
      .from('appointments').select('*').order('start_time', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    if (req.user.role === 'client') {
      const { data: matters } = await supabase
        .from('matters').select('id').eq('client_id', req.user.id);
      const ids = (matters || []).map(m => m.id);
      if (!ids.length) return res.json([]);
      const { data, error } = await supabase
        .from('appointments').select('*')
        .in('matter_id', ids).gte('start_time', now)
        .order('start_time', { ascending: true }).limit(5);
      if (error) throw error;
      return res.json(data || []);
    }
    const { data, error } = await supabase
      .from('appointments').select('*')
      .gte('start_time', now).order('start_time', { ascending: true }).limit(10);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterId, title, type, startTime, endTime, location, notes } = req.body;
    if (!title || !startTime) return res.status(400).json({ error: 'title and startTime required' });
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        matter_id:  matterId  || null,
        title,
        type:       type      || 'teleconference',
        start_time: startTime,
        end_time:   endTime   || null,
        location:   location  || null,
        notes:      notes     || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('appointments').delete().eq('id', req.params.id).select();
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
