const router   = require('express').Router();
const supabase = require('../supabase');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:from_user_id(first_name, last_name, avatar_initials)')
      .eq('to_user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const messages = (data || []).map(m => ({
      ...m,
      from_name:     `${m.sender?.first_name || ''} ${m.sender?.last_name || ''}`.trim(),
      from_initials: m.sender?.avatar_initials,
      sender: undefined,
    }));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sent', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, recipient:to_user_id(first_name, last_name)')
      .eq('from_user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const messages = (data || []).map(m => ({
      ...m,
      to_name:   `${m.recipient?.first_name || ''} ${m.recipient?.last_name || ''}`.trim(),
      recipient: undefined,
    }));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', req.user.id)
      .is('read_at', null);
    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { toUserId, matterId, subject, body } = req.body;
    if (!toUserId || !body) return res.status(400).json({ error: 'toUserId and body required' });
    const { data, error } = await supabase
      .from('messages')
      .insert({
        matter_id:    matterId || null,
        from_user_id: req.user.id,
        to_user_id:   toUserId,
        subject:      subject || null,
        body,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('to_user_id', req.user.id)
      .select();
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
