import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PRIORITY_CONFIG = {
  high: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '🔴' },
  medium: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: '🟡' },
  low: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '🔵' },
  normal: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: '⚪' },
};

const TYPE_ICONS = { general: '📢', academic: '📚', event: '🎉', emergency: '🚨', reminder: '⏰', announcement: '📣' };
const emptyForm = {
  title: '',
  content: '',
  type: 'general',
  target_audience: 'all',
  image_url: '',
  attachment_url: '',
  expires_at: '',
  is_pinned: false,
  is_active: true,
};

const Announcements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) { console.error(err); toast.error('Failed to load announcements'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (announcement) => {
    setForm({
      title: announcement.title || '',
      content: announcement.content || '',
      type: announcement.type || 'general',
      target_audience: announcement.target_audience || 'all',
      image_url: announcement.image_url || '',
      attachment_url: announcement.attachment_url || '',
      expires_at: announcement.expires_at ? announcement.expires_at.slice(0, 16) : '',
      is_pinned: Boolean(announcement.is_pinned),
      is_active: announcement.is_active !== false,
    });
    setEditId(announcement.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    if (!editId && !user?.id) {
      toast.error('You must be signed in to publish announcements');
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      target_audience: form.target_audience,
      image_url: form.image_url || null,
      attachment_url: form.attachment_url || null,
      expires_at: form.expires_at || null,
      is_pinned: form.is_pinned,
      is_active: form.is_active,
    };

    const { error } = editId
      ? await supabase.from('announcements').update(payload).eq('id', editId)
      : await supabase.from('announcements').insert({ ...payload, published_by: user.id });

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Announcement updated' : 'Announcement created');
    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('announcements').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Announcement deleted');
    setDeleteId(null);
    fetchData();
  };

  const types = [...new Set(announcements.map(a => a.type).filter(Boolean))];
  const filtered = useMemo(() => {
    return announcements.filter(a => {
      const matchSearch = (a.title || '').toLowerCase().includes(search.toLowerCase()) || (a.content || '').toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || a.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [announcements, search, typeFilter]);

  if (loading) return <div className="space-y-6"><SkeletonCard /></div>;

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-2xl text-white">📢</div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Announcements</h2>
            <p className="text-sm text-gray-500">{announcements.length} announcements • Keep everyone informed</p>
          </div>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Announcement
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full sm:max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
            <option value="all">All Types</option>
            {types.map(t => <option key={t} value={t}>{TYPE_ICONS[t] || '📋'} {t}</option>)}
          </select>
        </div>
      </GlassCard>

      {filtered.length === 0 ? (
        <EmptyState title="No announcements" description="No announcements found matching your criteria" />
      ) : (
        <div className="space-y-4">
          {filtered.map((ann, i) => {
            const priority = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.normal;
            const typeIcon = TYPE_ICONS[ann.type] || '📋';
            return (
              <motion.div key={ann.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.5) }}>
                <GlassCard hover className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeIcon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{ann.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {ann.type && <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 capitalize">{ann.type}</span>}
                          {ann.priority && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.color}`}>{priority.icon} {ann.priority}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                      <button onClick={() => openEdit(ann)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(ann.id)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{ann.content}</p>
                  {ann.target_audience && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Audience:</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 capitalize">{ann.target_audience}</span>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Announcement' : 'Add Announcement'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea className="input-field" rows={5} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {Object.keys(TYPE_ICONS).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
              <select className="input-field" value={form.target_audience} onChange={e => setForm({ ...form, target_audience: e.target.value })}>
                {['all', 'students', 'parents', 'teachers', 'registrar', 'principal', 'cashier'].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
              <input type="datetime-local" className="input-field" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input className="input-field" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachment URL</label>
              <input className="input-field" value={form.attachment_url} onChange={e => setForm({ ...form, attachment_url: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} />
              Pinned
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Announcement"
        message="Delete this announcement? This cannot be undone."
      />
    </div>
  );
};

export default Announcements;
