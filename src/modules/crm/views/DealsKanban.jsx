import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, X, Save, Trash2, ChevronRight, DollarSign, Calendar,
  User, Building2, Mail, Phone, Target, TrendingUp, Activity,
  MessageSquare, PhoneCall, Send, Coffee, CheckSquare, Clock,
  Edit3, Link2, ChevronDown, Award, AlertCircle, Search, Filter,
  BarChart2, Percent, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

// ── Etapas del pipeline (fallback; se reemplazan con lo guardado en config) ────
const DEAL_STAGES_DEFAULT = [
  { id: 'QUALIFICATION',             label: 'Lead / Prospecto',           prob: 10,  color: 'bg-slate-400',   ring: 'ring-slate-200',   text: 'text-slate-600',  bg: 'bg-slate-50' },
  { id: 'NEEDS_ANALYSIS',            label: 'Acercamiento',               prob: 20,  color: 'bg-blue-400',    ring: 'ring-blue-200',    text: 'text-blue-600',   bg: 'bg-blue-50' },
  { id: 'VALUE_PROPOSITION',         label: 'Contacto decisor',           prob: 30,  color: 'bg-indigo-500',  ring: 'ring-indigo-200',  text: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'IDENTIFY_DECISION_MAKERS',  label: 'Oportunidad detectada',      prob: 40,  color: 'bg-violet-500',  ring: 'ring-violet-200',  text: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'PROPOSAL_PRICE_QUOTE',      label: 'Levantamiento técnico',      prob: 50,  color: 'bg-amber-500',   ring: 'ring-amber-200',   text: 'text-amber-700',  bg: 'bg-amber-50' },
  { id: 'PROPOSAL_SENT',             label: 'Cotización enviada',         prob: 65,  color: 'bg-orange-500',  ring: 'ring-orange-200',  text: 'text-orange-700', bg: 'bg-orange-50' },
  { id: 'NEGOTIATION_1',             label: 'Negociación 1',              prob: 75,  color: 'bg-purple-500',  ring: 'ring-purple-200',  text: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'RECOTIZACION',              label: 'Recotización',               prob: 80,  color: 'bg-pink-500',    ring: 'ring-pink-200',    text: 'text-pink-600',   bg: 'bg-pink-50' },
  { id: 'NEGOTIATION_2',             label: 'Negociación 2',              prob: 90,  color: 'bg-rose-500',    ring: 'ring-rose-200',    text: 'text-rose-600',   bg: 'bg-rose-50' },
  { id: 'CLOSED_WON_PENDING',        label: 'En espera de autorización',  prob: 95,  color: 'bg-yellow-500',  ring: 'ring-yellow-200',  text: 'text-yellow-700', bg: 'bg-yellow-50' },
  { id: 'CLOSED_WON',                label: 'Ganado',                     prob: 100, color: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700',bg: 'bg-emerald-50' },
  { id: 'CLOSED_LOST',               label: 'Perdido',                    prob: 0,   color: 'bg-red-500',     ring: 'ring-red-200',     text: 'text-red-600',    bg: 'bg-red-50' },
];

// Normaliza etapas guardadas desde PipelineSettings (que usa `probability`) al
// formato interno de DealsKanban (que usa `prob` + ring/text derivados)
function normalizeStages(raw) {
  return raw.map(s => {
    const base = DEAL_STAGES_DEFAULT.find(d => d.id === s.id) || {};
    return {
      ...base,
      ...s,
      prob: s.prob ?? s.probability ?? base.prob ?? 0,
      ring: s.ring ?? base.ring ?? 'ring-gray-200',
      text: s.text ?? base.text ?? 'text-gray-600',
      bg:   (s.bg ?? base.bg ?? 'bg-gray-50').replace('/30', ''),
    };
  });
}

const ACTIVITY_TYPES = [
  { id: 'NOTE',    label: 'Nota',     icon: MessageSquare, color: 'text-gray-500' },
  { id: 'CALL',    label: 'Llamada',  icon: PhoneCall,     color: 'text-blue-500' },
  { id: 'EMAIL',   label: 'Email',    icon: Send,          color: 'text-purple-500' },
  { id: 'MEETING', label: 'Reunión',  icon: Coffee,        color: 'text-amber-500' },
  { id: 'TASK',    label: 'Tarea',    icon: CheckSquare,   color: 'text-emerald-500' },
];

const SOURCES = ['Web', 'Referido', 'LinkedIn', 'Facebook', 'Llamada en frío', 'Evento', 'Otro'];

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const timeAgo = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};

// ── Componente Principal ───────────────────────────────────────────────────────
export default function DealsKanban() {
  const { user } = useAuth();
  const [dealStages, setDealStages] = useState(DEAL_STAGES_DEFAULT);
  const stageMap = useMemo(() => Object.fromEntries(dealStages.map(s => [s.id, s])), [dealStages]);

  const [deals, setDeals] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('ALL');

  // Panel lateral
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [panelTab, setPanelTab] = useState('info'); // 'info' | 'activities'
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Actividad nueva
  const [newActivity, setNewActivity] = useState({ type: 'NOTE', content: '' });
  const [addingActivity, setAddingActivity] = useState(false);

  // Modal nuevo deal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeal, setNewDeal] = useState({
    title: '', value: '', company: '', contactName: '', contactEmail: '',
    contactPhone: '', clientId: '', assignedToId: '', stage: 'QUALIFICATION',
    source: 'Web', expectedClose: '', description: ''
  });

  // Drag & Drop
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // ── Fetches ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dealsRes, clientsRes, empRes] = await Promise.all([
        apiFetch('/api/crm/deals'),
        apiFetch('/api/crm/clients'),
        apiFetch('/api/employees')
      ]);
      const [d, c, e] = await Promise.all([dealsRes.json(), clientsRes.json(), empRes.json()]);
      setDeals(Array.isArray(d) ? d : []);
      setClients(Array.isArray(c) ? c : []);
      setEmployees(Array.isArray(e) ? e : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    apiFetch('/api/config?key=CRM_PIPELINE_STAGES')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setDealStages(normalizeStages(data)); })
      .catch(() => {});
  }, [fetchAll]);

  const fetchActivities = async (dealId) => {
    setActivitiesLoading(true);
    try {
      const res = await apiFetch(`/api/crm/deal-activities?dealId=${dealId}`);
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setActivitiesLoading(false); }
  };

  // ── Seleccionar deal ─────────────────────────────────────────────────────────
  const openDeal = (deal) => {
    setSelectedDeal(deal);
    setEditForm({
      title: deal.title || '',
      value: deal.value || 0,
      company: deal.company || '',
      contactName: deal.contactName || '',
      contactEmail: deal.contactEmail || '',
      contactPhone: deal.contactPhone || '',
      clientId: deal.clientId || '',
      assignedToId: deal.assignedToId || '',
      stage: deal.stage || 'QUALIFICATION',
      probability: deal.probability ?? stageMap[deal.stage]?.prob ?? 10,
      expectedClose: deal.expectedClose ? deal.expectedClose.split('T')[0] : '',
      source: deal.source || 'Web',
      description: deal.description || '',
      notes: deal.notes || ''
    });
    setPanelTab('info');
    fetchActivities(deal.id);
  };

  const closeDeal = () => { setSelectedDeal(null); setActivities([]); };

  // ── Guardar edición del deal ─────────────────────────────────────────────────
  const saveDeal = async () => {
    if (!selectedDeal) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/crm/deals', {
        method: 'PUT',
        body: JSON.stringify({ id: selectedDeal.id, ...editForm })
      });
      if (res.ok) {
        const updated = await res.json();
        setDeals(prev => prev.map(d => d.id === updated.id ? updated : d));
        setSelectedDeal(updated);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Auto-guardar al cambiar etapa en el panel ────────────────────────────────
  const changeStageInPanel = async (newStage) => {
    const prob = stageMap[newStage]?.prob ?? editForm.probability;
    const updated = { ...editForm, stage: newStage, probability: prob };
    setEditForm(updated);
    if (!selectedDeal) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/crm/deals', {
        method: 'PUT',
        body: JSON.stringify({ id: selectedDeal.id, stage: newStage, probability: prob })
      });
      if (res.ok) {
        const deal = await res.json();
        setDeals(prev => prev.map(d => d.id === deal.id ? deal : d));
        setSelectedDeal(deal);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // ── Crear nuevo deal ─────────────────────────────────────────────────────────
  const handleAddDeal = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/crm/deals', {
        method: 'POST',
        body: JSON.stringify({ ...newDeal, value: parseFloat(newDeal.value) || 0 })
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewDeal({ title: '', value: '', company: '', contactName: '', contactEmail: '', contactPhone: '', clientId: '', assignedToId: '', stage: 'QUALIFICATION', source: 'Web', expectedClose: '', description: '' });
        fetchAll();
      }
    } catch (err) { alert('Error de red'); }
  };

  // ── Eliminar deal ────────────────────────────────────────────────────────────
  const deleteDeal = async (deal) => {
    if (!window.confirm(`¿Eliminar "${deal.title}"?`)) return;
    try {
      const res = await apiFetch('/api/crm/deals', { method: 'DELETE', body: JSON.stringify({ id: deal.id }) });
      if (res.ok) {
        setDeals(prev => prev.filter(d => d.id !== deal.id));
        if (selectedDeal?.id === deal.id) closeDeal();
      }
    } catch (err) { console.error(err); }
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  const handleDrop = async (stageId) => {
    if (!draggedDeal || draggedDeal.stage === stageId) { setDraggedDeal(null); setDragOverStage(null); return; }
    const prob = stageMap[stageId]?.prob ?? draggedDeal.probability;
    setDeals(prev => prev.map(d => d.id === draggedDeal.id ? { ...d, stage: stageId, probability: prob } : d));
    try {
      const res = await apiFetch('/api/crm/deals', {
        method: 'PUT',
        body: JSON.stringify({ id: draggedDeal.id, stage: stageId, probability: prob })
      });
      if (res.ok) {
        const updated = await res.json();
        setDeals(prev => prev.map(d => d.id === updated.id ? updated : d));
        if (selectedDeal?.id === updated.id) { setSelectedDeal(updated); setEditForm(f => ({ ...f, stage: updated.stage, probability: updated.probability })); }
      }
    } catch (err) { fetchAll(); }
    setDraggedDeal(null); setDragOverStage(null);
  };

  // ── Agregar actividad ────────────────────────────────────────────────────────
  const addActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.content.trim() || !selectedDeal) return;
    setAddingActivity(true);
    try {
      const res = await apiFetch('/api/crm/deal-activities', {
        method: 'POST',
        body: JSON.stringify({ dealId: selectedDeal.id, ...newActivity, authorName: user?.name || 'Usuario' })
      });
      if (res.ok) {
        setNewActivity({ type: 'NOTE', content: '' });
        fetchActivities(selectedDeal.id);
        setDeals(prev => prev.map(d => d.id === selectedDeal.id ? { ...d, _count: { activities: (d._count?.activities || 0) + 1 } } : d));
      }
    } catch (err) { console.error(err); }
    finally { setAddingActivity(false); }
  };

  // ── Filtrado y métricas ──────────────────────────────────────────────────────
  const filteredDeals = deals.filter(d => {
    const matchSearch = !searchTerm || [d.title, d.company, d.contactName].some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStage = filterStage === 'ALL' || d.stage === filterStage;
    return matchSearch && matchStage;
  });

  const totalPipeline = deals.filter(d => d.stage !== 'CLOSED_LOST').reduce((s, d) => s + (d.value || 0), 0);
  const totalWon = deals.filter(d => d.stage === 'CLOSED_WON').reduce((s, d) => s + (d.value || 0), 0);
  const totalActive = deals.filter(d => !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage)).length;
  const weightedForecast = deals.filter(d => !['CLOSED_LOST'].includes(d.stage)).reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0);

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <Activity className="h-10 w-10 text-primary animate-pulse" />
      <p className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Cargando Pipeline CRM...</p>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* ── Área principal ────────────────────────────────────────────────── */}
      <div className={cn("flex flex-col flex-1 overflow-hidden transition-all duration-300", selectedDeal ? 'w-[calc(100%-420px)]' : 'w-full')}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-white border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic">Pipeline</h2>
              <p className="text-gray-400 font-bold text-[10px] mt-0.5 uppercase tracking-widest flex items-center gap-2">
                <Target className="h-3 w-3 text-primary" /> Tratos / Oportunidades — OleaControls CRM
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary transition-all shadow-lg"
            >
              <Plus className="h-4 w-4" /> Nuevo Trato
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Pipeline Total', value: fmt(totalPipeline), icon: BarChart2, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Ganado', value: fmt(totalWon), icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Tratos Activos', value: totalActive, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Pronóstico Pond.', value: fmt(weightedForecast), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={cn("flex items-center gap-3 p-3 rounded-2xl border border-gray-100", bg)}>
                <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center bg-white shadow-sm", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                  <p className={cn("text-sm font-black", color)}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex gap-3 mt-3">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 flex-1 max-w-xs">
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar trato..."
                className="bg-transparent border-none outline-none font-bold text-xs text-gray-900 w-full"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-gray-50 rounded-xl px-3 py-2 font-black text-[10px] uppercase text-gray-600 outline-none border-none cursor-pointer"
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
            >
              <option value="ALL">Todas las etapas</option>
              {dealStages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* ── Kanban Board ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full p-4 pb-6 min-w-max">
            {dealStages.map((stage) => {
              const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
              const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
              const isOver = dragOverStage === stage.id;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "w-64 flex flex-col flex-shrink-0 rounded-3xl transition-all duration-200",
                    stage.bg,
                    isOver ? `ring-2 ${stage.ring} scale-[1.01]` : ''
                  )}
                  onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={() => handleDrop(stage.id)}
                >
                  {/* Cabecera columna */}
                  <div className="p-3 space-y-1 sticky top-0 bg-white/80 backdrop-blur-sm rounded-t-3xl border-b border-black/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", stage.color)} />
                        <span className="text-[9px] font-black text-gray-800 uppercase tracking-wider leading-tight">{stage.label}</span>
                      </div>
                      <span className="text-[8px] font-black bg-white rounded-lg px-2 py-0.5 text-gray-500 shadow-sm">{stageDeals.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[8px] font-bold", stage.text)}>{stage.prob}% prob.</span>
                      <span className="text-[8px] font-black text-gray-700">{fmt(stageValue)}</span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                    <AnimatePresence>
                      {stageDeals.map(deal => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          stage={stage}
                          isSelected={selectedDeal?.id === deal.id}
                          onClick={() => openDeal(deal)}
                          onDelete={() => deleteDeal(deal)}
                          onDragStart={() => setDraggedDeal(deal)}
                          onDragEnd={() => setDraggedDeal(null)}
                        />
                      ))}
                    </AnimatePresence>
                    {stageDeals.length === 0 && (
                      <div className="h-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-black/10">
                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Arrastra aquí</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Panel lateral (deal detail) ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedDeal && (
          <motion.div
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-[420px] flex-shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Panel header */}
            <div className="p-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    className="w-full text-lg font-black text-gray-900 bg-transparent outline-none border-b-2 border-transparent focus:border-primary transition-colors pb-1 truncate"
                    value={editForm.title || ''}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    onBlur={saveDeal}
                  />
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">{editForm.company || 'Sin empresa'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={saveDeal}
                    disabled={saving}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all"
                    title="Guardar cambios"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button onClick={closeDeal} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Stage selector visual */}
              <div className="mt-3">
                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Etapa del Pipeline</label>
                <select
                  className={cn(
                    "w-full text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-3 border-2 outline-none cursor-pointer transition-all",
                    stageMap[editForm.stage]?.ring, stageMap[editForm.stage]?.text,
                    stageMap[editForm.stage]?.bg
                  )}
                  value={editForm.stage}
                  onChange={e => changeStageInPanel(e.target.value)}
                >
                  {dealStages.map(s => (
                    <option key={s.id} value={s.id}>{s.label} ({s.prob}%)</option>
                  ))}
                </select>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[8px] font-black text-gray-400 uppercase">Probabilidad</span>
                  <span className={cn("text-[10px] font-black", stageMap[editForm.stage]?.text)}>{editForm.probability}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", stageMap[editForm.stage]?.color)}
                    animate={{ width: `${editForm.probability}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0">
              {[{ id: 'info', label: 'Información' }, { id: 'activities', label: 'Actividades' }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setPanelTab(tab.id)}
                  className={cn(
                    "flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-colors",
                    panelTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-5">
              {panelTab === 'info' ? (
                <DealInfoPanel
                  editForm={editForm}
                  setEditForm={setEditForm}
                  clients={clients}
                  employees={employees}
                  onSave={saveDeal}
                  saving={saving}
                  deal={selectedDeal}
                  onDelete={() => deleteDeal(selectedDeal)}
                />
              ) : (
                <ActivitiesPanel
                  activities={activities}
                  loading={activitiesLoading}
                  newActivity={newActivity}
                  setNewActivity={setNewActivity}
                  onAdd={addActivity}
                  adding={addingActivity}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: Nuevo Trato ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            >
              <form onSubmit={handleAddDeal} className="p-7 space-y-6">
                <div className="flex justify-between items-center border-b pb-5">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Nuevo Trato</h3>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Pipeline OleaControls CRM</p>
                  </div>
                  <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                {/* Título + Valor */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Nombre del Trato *</label>
                    <input required className="w-full bg-gray-50 rounded-xl px-5 py-4 font-black text-sm outline-none focus:ring-2 ring-primary/20" placeholder="Ej: Proyecto CCTV Plaza Norte" value={newDeal.title} onChange={e => setNewDeal(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Valor Estimado</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="number" className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-4 font-black text-sm outline-none focus:ring-2 ring-primary/20" placeholder="0" value={newDeal.value} onChange={e => setNewDeal(f => ({ ...f, value: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Cierre Esperado</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="date" className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-4 font-black text-sm outline-none focus:ring-2 ring-primary/20" value={newDeal.expectedClose} onChange={e => setNewDeal(f => ({ ...f, expectedClose: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Etapa + Fuente */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Etapa Inicial</label>
                    <select className="w-full bg-gray-50 rounded-xl px-4 py-4 font-black text-xs outline-none cursor-pointer" value={newDeal.stage} onChange={e => setNewDeal(f => ({ ...f, stage: e.target.value }))}>
                      {dealStages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Fuente</label>
                    <select className="w-full bg-gray-50 rounded-xl px-4 py-4 font-black text-xs outline-none cursor-pointer" value={newDeal.source} onChange={e => setNewDeal(f => ({ ...f, source: e.target.value }))}>
                      {SOURCES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Contacto */}
                <div className="p-4 bg-blue-50/60 rounded-2xl space-y-3">
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Contacto</p>
                  <div className="grid grid-cols-1 gap-3">
                    <input className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Nombre del contacto" value={newDeal.contactName} onChange={e => setNewDeal(f => ({ ...f, contactName: e.target.value }))} />
                    <input className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Empresa / Organización" value={newDeal.company} onChange={e => setNewDeal(f => ({ ...f, company: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="email" className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Email" value={newDeal.contactEmail} onChange={e => setNewDeal(f => ({ ...f, contactEmail: e.target.value }))} />
                      <input className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Teléfono" value={newDeal.contactPhone} onChange={e => setNewDeal(f => ({ ...f, contactPhone: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Asignación */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Cliente Vinculado</label>
                    <select className="w-full bg-gray-50 rounded-xl px-4 py-4 font-bold text-xs outline-none cursor-pointer" value={newDeal.clientId} onChange={e => setNewDeal(f => ({ ...f, clientId: e.target.value }))}>
                      <option value="">— Sin cliente —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-1">Asignado a</label>
                    <select className="w-full bg-gray-50 rounded-xl px-4 py-4 font-bold text-xs outline-none cursor-pointer" value={newDeal.assignedToId} onChange={e => setNewDeal(f => ({ ...f, assignedToId: e.target.value }))}>
                      <option value="">— Sin asignar —</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                </div>

                <button type="submit" className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary transition-all shadow-lg">
                  <Plus className="h-4 w-4 inline mr-2" /> Crear Trato en Pipeline
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Deal Card ──────────────────────────────────────────────────────────────────
function DealCard({ deal, stage, isSelected, onClick, onDelete, onDragStart, onDragEnd }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl p-4 border cursor-pointer transition-all group select-none",
        isSelected ? `border-2 ${stage.ring} shadow-md` : 'border-gray-100 hover:shadow-md hover:border-gray-200'
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-black text-gray-900 leading-tight flex-1">{deal.title}</p>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-red-50 text-red-400 hover:text-red-600 transition-all flex-shrink-0"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>

        {deal.company && (
          <p className="text-[8px] font-bold text-gray-400 flex items-center gap-1">
            <Building2 className="h-2.5 w-2.5" /> {deal.company}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <span className="text-[11px] font-black text-gray-900">{fmt(deal.value)}</span>
          <div className="flex items-center gap-1">
            {deal.assignedTo && (
              <div className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-[7px] font-black" title={deal.assignedTo.name}>
                {deal.assignedTo.name.charAt(0)}
              </div>
            )}
            {deal._count?.activities > 0 && (
              <span className="text-[7px] font-black text-gray-400 flex items-center gap-0.5">
                <MessageSquare className="h-2.5 w-2.5" />{deal._count.activities}
              </span>
            )}
          </div>
        </div>

        {deal.expectedClose && (
          <p className="text-[7px] font-bold text-gray-400 flex items-center gap-1">
            <Clock className="h-2 w-2" /> {fmtDate(deal.expectedClose)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Panel de Información del Deal ─────────────────────────────────────────────
function DealInfoPanel({ editForm, setEditForm, clients, employees, onSave, saving, deal, onDelete }) {
  const f = (key) => ({
    value: editForm[key] ?? '',
    onChange: e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))
  });

  return (
    <div className="space-y-6">
      {/* Valor + Cierre */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Valor del Trato</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
            <input type="number" className="w-full bg-gray-50 rounded-xl pl-8 pr-3 py-3 font-black text-sm outline-none focus:ring-2 ring-primary/20" {...f('value')} onBlur={onSave} />
          </div>
        </div>
        <div>
          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Cierre Esperado</label>
          <input type="date" className="w-full bg-gray-50 rounded-xl px-3 py-3 font-bold text-xs outline-none focus:ring-2 ring-primary/20" {...f('expectedClose')} onBlur={onSave} />
        </div>
      </div>

      {/* Fuente + Probabilidad manual */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Fuente</label>
          <select className="w-full bg-gray-50 rounded-xl px-3 py-3 font-bold text-xs outline-none cursor-pointer" {...f('source')} onBlur={onSave}>
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Prob. Manual (%)</label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="number" min="0" max="100" className="w-full bg-gray-50 rounded-xl pl-8 pr-3 py-3 font-black text-sm outline-none focus:ring-2 ring-primary/20" {...f('probability')} onBlur={onSave} />
          </div>
        </div>
      </div>

      {/* Contacto */}
      <div className="p-4 bg-blue-50/50 rounded-2xl space-y-3">
        <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Contacto</p>
        <input className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Nombre del contacto" {...f('contactName')} onBlur={onSave} />
        <input className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Empresa" {...f('company')} onBlur={onSave} />
        <div className="grid grid-cols-2 gap-2">
          <input type="email" className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Email" {...f('contactEmail')} onBlur={onSave} />
          <input className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none" placeholder="Teléfono" {...f('contactPhone')} onBlur={onSave} />
        </div>
      </div>

      {/* Vinculación */}
      <div className="space-y-3">
        <div>
          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Cliente Registrado</label>
          <select className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-xs outline-none cursor-pointer" {...f('clientId')} onBlur={onSave}>
            <option value="">— Sin cliente —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Vendedor Asignado</label>
          <select className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-xs outline-none cursor-pointer" {...f('assignedToId')} onBlur={onSave}>
            <option value="">— Sin asignar —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Descripción</label>
        <textarea rows={3} className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-xs outline-none resize-none focus:ring-2 ring-primary/20" placeholder="Detalles del proyecto, necesidades del cliente..." {...f('description')} onBlur={onSave} />
      </div>

      {/* Notas internas */}
      <div>
        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Notas Internas</label>
        <textarea rows={3} className="w-full bg-amber-50 rounded-xl px-4 py-3 font-bold text-xs outline-none resize-none focus:ring-2 ring-amber-200" placeholder="Notas privadas del equipo..." {...f('notes')} onBlur={onSave} />
      </div>

      {/* Meta */}
      <div className="p-3 bg-gray-50 rounded-xl space-y-1">
        <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Información del Registro</p>
        <p className="text-[8px] text-gray-500 font-bold">Creado: {fmtDate(deal.createdAt)}</p>
        <p className="text-[8px] text-gray-500 font-bold">Actualizado: {fmtDate(deal.updatedAt)}</p>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-primary text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="h-3 w-3" /> {saving ? 'Guardando...' : 'Guardar Todo'}
        </button>
        <button
          onClick={onDelete}
          className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
          title="Eliminar trato"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Panel de Actividades ───────────────────────────────────────────────────────
function ActivitiesPanel({ activities, loading, newActivity, setNewActivity, onAdd, adding }) {
  const typeMap = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.id, t]));

  return (
    <div className="space-y-5">
      {/* Agregar actividad */}
      <form onSubmit={onAdd} className="space-y-3 p-4 bg-gray-50 rounded-2xl">
        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Registrar Actividad</p>
        <div className="flex gap-2 flex-wrap">
          {ACTIVITY_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setNewActivity(f => ({ ...f, type: t.id }))}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border-2 transition-all",
                newActivity.type === t.id ? `border-primary bg-primary/10 text-primary` : 'border-gray-200 text-gray-400 hover:border-gray-300'
              )}
            >
              <t.icon className="h-2.5 w-2.5" />
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          className="w-full bg-white rounded-xl px-4 py-3 font-bold text-xs outline-none resize-none border border-gray-200 focus:border-primary transition-colors"
          placeholder="Escribe el detalle de la actividad..."
          value={newActivity.content}
          onChange={e => setNewActivity(f => ({ ...f, content: e.target.value }))}
          required
        />
        <button
          type="submit"
          disabled={adding}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-50"
        >
          {adding ? 'Registrando...' : 'Agregar al Timeline'}
        </button>
      </form>

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-[10px] font-black uppercase animate-pulse">Cargando actividades...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <Activity className="h-8 w-8 text-gray-200 mx-auto" />
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Sin actividades registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act, i) => {
            const T = typeMap[act.type] || typeMap.NOTE;
            return (
              <div key={act.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn("h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0", T.color)}>
                    <T.icon className="h-3.5 w-3.5" />
                  </div>
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-[8px] font-black uppercase tracking-widest", T.color)}>{T.label}</span>
                    <span className="text-[7px] text-gray-400 font-bold">{timeAgo(act.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed bg-gray-50 rounded-xl p-3">{act.content}</p>
                  {act.authorName && (
                    <p className="text-[7px] text-gray-400 font-bold mt-1 flex items-center gap-1">
                      <User className="h-2 w-2" /> {act.authorName}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
