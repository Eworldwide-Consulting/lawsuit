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
        .from('tasks').select('*').in('matter_id', ids).order('due_date', { ascending: true });
      if (error) throw error;
      return res.json(data || []);
    }
    const { data, error } = await supabase
      .from('tasks').select('*').order('due_date', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterId, assignedTo, title, description, dueDate, priority, actionLabel } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        matter_id:    matterId    || null,
        assigned_to:  assignedTo || req.user.id,
        title,
        description:  description  || null,
        due_date:     dueDate      || null,
        priority:     priority     || 'normal',
        action_label: actionLabel  || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks').update({ status: req.body.status }).eq('id', req.params.id).select();
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
