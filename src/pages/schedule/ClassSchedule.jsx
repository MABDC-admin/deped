import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];
const TIME_SLOTS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
const SUBJECT_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
  'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
  'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700',
  'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700',
  'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
  'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
];
const emptyForm = {
  school_year_id: '',
  section_id: '',
  subject_id: '',
  teacher_id: '',
  day_of_week: 1,
  start_time: '07:00',
  end_time: '08:00',
  room: '',
};

const ClassSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [sections, setSections] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refsLoaded, setRefsLoaded] = useState(false);
  const [selectedSY, setSelectedSY] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [view, setView] = useState('timetable');
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchLookups(); }, []);

  useEffect(() => {
    if (!refsLoaded) return;
    if (!selectedSY) {
      setSchedules([]);
      setSections([]);
      setLoading(false);
      return;
    }
    fetchScheduleRecords(selectedSY);
  }, [refsLoaded, selectedSY]);

  const fetchLookups = async () => {
    setLoading(true);
    try {
      const [syRes, subRes, teacherRes, secRes] = await Promise.all([
        supabase.from('school_years').select('id, year_name, is_current, status').order('start_date', { ascending: false }),
        supabase.from('subjects').select('id, name, short_name').eq('is_active', true).order('name'),
        supabase.from('user_profiles').select('id, first_name, last_name').eq('role', 'teacher').order('last_name'),
        supabase.from('sections').select('id, name, school_year_id, grade_levels(name)').order('name'),
      ]);
      const years = syRes.data || [];
      setSchoolYears(years);
      setSubjects(subRes.data || []);
      setTeachers(teacherRes.data || []);
      setAllSections(secRes.data || []);
      const active = years.find(y => y.is_current || y.status === 'active') || years[0];
      if (active) setSelectedSY(active.id);
    } catch (err) { console.error(err); toast.error('Failed to load schedules'); }
    finally { setRefsLoaded(true); }
  };

  const fetchScheduleRecords = async (schoolYearId = selectedSY) => {
    if (!schoolYearId) return;
    setLoading(true);
    try {
      const [schedRes, secRes] = await Promise.all([
        supabase
          .from('class_schedules')
          .select('*, sections(name, grade_levels(name)), subjects(name, short_name), teacher:user_profiles!teacher_id(id, first_name, last_name)')
          .eq('school_year_id', schoolYearId)
          .order('day_of_week'),
        supabase
          .from('sections')
          .select('id, name, school_year_id, grade_levels(name)')
          .eq('school_year_id', schoolYearId)
          .order('name'),
      ]);
      setSchedules(schedRes.data || []);
      setSections(secRes.data || []);
    } catch (err) { console.error(err); toast.error('Failed to load schedules'); }
    finally { setLoading(false); }
  };

  const activeYearId = selectedSY || schoolYears.find(y => y.is_current || y.status === 'active')?.id || '';

  const openAdd = () => {
    setForm({ ...emptyForm, school_year_id: activeYearId, section_id: selectedSection === 'all' ? '' : selectedSection });
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (schedule) => {
    setForm({
      school_year_id: schedule.school_year_id || activeYearId,
      section_id: schedule.section_id || '',
      subject_id: schedule.subject_id || '',
      teacher_id: schedule.teacher_id || '',
      day_of_week: Number(schedule.day_of_week) || 1,
      start_time: schedule.start_time?.slice(0, 5) || '07:00',
      end_time: schedule.end_time?.slice(0, 5) || '08:00',
      room: schedule.room || '',
    });
    setEditId(schedule.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.school_year_id || !form.section_id || !form.subject_id || !form.teacher_id || !form.start_time || !form.end_time) {
      toast.error('Complete all required schedule fields');
      return;
    }
    if (form.start_time >= form.end_time) {
      toast.error('End time must be later than start time');
      return;
    }

    setSaving(true);
    const payload = {
      school_year_id: form.school_year_id,
      section_id: form.section_id,
      subject_id: form.subject_id,
      teacher_id: form.teacher_id,
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room || null,
    };
    const { error } = editId
      ? await supabase.from('class_schedules').update(payload).eq('id', editId)
      : await supabase.from('class_schedules').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Schedule updated' : 'Schedule created');
    setModalOpen(false);
    if (payload.school_year_id !== selectedSY) {
      setSelectedSY(payload.school_year_id);
      setSelectedSection(payload.section_id);
    } else {
      fetchScheduleRecords(payload.school_year_id);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('class_schedules').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Schedule deleted');
    setDeleteId(null);
    fetchScheduleRecords();
  };

  const filteredSchedules = useMemo(() => {
    if (selectedSection === 'all') return schedules;
    return schedules.filter(s => s.section_id === selectedSection);
  }, [schedules, selectedSection]);

  const subjectColorMap = useMemo(() => {
    const map = {};
    const uniqueSubjects = [...new Set(schedules.map(s => s.subject_id).filter(Boolean))];
    uniqueSubjects.forEach((id, i) => { map[id] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });
    return map;
  }, [schedules]);

  const getScheduleForSlot = (day, time) => {
    return filteredSchedules.filter(s => {
      if (Number(s.day_of_week) !== day) return false;
      const startTime = s.start_time?.slice(0, 5);
      const endTime = s.end_time?.slice(0, 5);
      return startTime <= time && endTime > time;
    });
  };

  const stats = {
    total: filteredSchedules.length,
    sections: new Set(filteredSchedules.map(s => s.section_id)).size,
    subjects: new Set(filteredSchedules.map(s => s.subject_id)).size,
    teachers: new Set(filteredSchedules.map(s => s.teacher_id)).size,
  };

  if (loading) return <div className="space-y-6"><SkeletonLoader type="dashboard" /><SkeletonLoader type="table" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Schedules', value: stats.total, icon: '📅', color: 'from-blue-500 to-cyan-400' },
          { label: 'Sections', value: stats.sections, icon: '🏫', color: 'from-purple-500 to-pink-400' },
          { label: 'Subjects', value: stats.subjects, icon: '📚', color: 'from-emerald-500 to-teal-400' },
          { label: 'Teachers', value: stats.teachers, icon: '👨‍🏫', color: 'from-amber-500 to-orange-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-4 text-center">
              <span className="text-2xl">{s.icon}</span>
              <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <select value={selectedSY} onChange={e => { setSelectedSY(e.target.value); setSelectedSection('all'); setSchedules([]); setSections([]); }}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none">
            {schoolYears.map(y => (
              <option key={y.id} value={y.id}>{y.year_name} {y.is_current || y.status === 'active' ? '(Active)' : ''}</option>
            ))}
          </select>
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none">
            <option value="all">All Sections</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.grade_levels?.name} - {s.name}</option>)}
          </select>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {[{ id: 'timetable', label: '🗓️ Timetable' }, { id: 'list', label: '☰ List' }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === v.id ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Schedule
          </button>
        </div>
      </GlassCard>

      {filteredSchedules.length === 0 ? (
        <EmptyState title="No schedules yet" description="Class schedules will appear here once created" />
      ) : view === 'timetable' ? (
        <GlassCard className="p-4 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-6 gap-1 mb-2">
              <div className="text-xs font-semibold text-gray-400 text-center py-2">Time</div>
              {DAYS.map(day => (
                <div key={day.value} className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">{day.label}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="space-y-1">
              {TIME_SLOTS.map((time, ti) => (
                <motion.div key={time} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ti * 0.02 }}
                  className="grid grid-cols-6 gap-1" style={{ minHeight: '2.5rem' }}>
                  <div className="text-xs text-gray-400 flex items-center justify-center">{time}</div>
                  {DAYS.map(day => {
                    const slots = getScheduleForSlot(day.value, time);
                    return (
                      <div key={`${day.value}-${time}`} className="relative rounded-lg overflow-hidden min-h-[2.5rem]">
                        {slots.map((slot, si) => (
                          <button key={slot.id || si} onClick={() => openEdit(slot)} className={`absolute inset-0 px-2 py-1 text-xs border-l-3 text-left ${subjectColorMap[slot.subject_id] || SUBJECT_COLORS[0]} flex flex-col justify-center`}>
                            <span className="font-semibold truncate">{slot.subjects?.short_name || slot.subjects?.name}</span>
                            {slot.teacher && (
                              <span className="text-[10px] opacity-70 truncate">{slot.teacher.last_name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                <tr>
                  {['Day', 'Time', 'Subject', 'Section', 'Teacher', 'Room', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredSchedules.map((sched, i) => (
                  <motion.tr key={sched.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{sched.day_of_week}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{sched.start_time?.slice(0,5)} - {sched.end_time?.slice(0,5)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${subjectColorMap[sched.subject_id] || ''}`}>{sched.subjects?.name || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{sched.sections?.grade_levels?.name} - {sched.sections?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{sched.teacher ? `${sched.teacher.first_name} ${sched.teacher.last_name}` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{sched.room || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(sched)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(sched.id)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Schedule' : 'Add Schedule'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Year</label>
              <select className="input-field" value={form.school_year_id} onChange={e => setForm({ ...form, school_year_id: e.target.value, section_id: '' })}>
                <option value="">Select...</option>
                {schoolYears.map(y => <option key={y.id} value={y.id}>{y.year_name} {y.is_current || y.status === 'active' ? '(Active)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select className="input-field" value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })}>
                <option value="">Select...</option>
                {allSections.filter(s => !form.school_year_id || s.school_year_id === form.school_year_id).map(s => <option key={s.id} value={s.id}>{s.grade_levels?.name} - {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select className="input-field" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">Select...</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
              <select className="input-field" value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                <option value="">Select...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
              <select className="input-field" value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })}>
                {DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
              <input className="input-field" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input type="time" className="input-field" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input type="time" className="input-field" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
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
        title="Delete Schedule"
        message="Delete this class schedule? This cannot be undone."
      />
    </div>
  );
};

export default ClassSchedule;
