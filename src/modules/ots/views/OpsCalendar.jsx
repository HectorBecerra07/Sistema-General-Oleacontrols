import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  User, 
  Info,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Wrench,
  Stethoscope,
  MoreVertical,
  ShieldCheck,
  Camera,
  FileText,
  Loader2
} from 'lucide-react';
import { otService } from '@/api/otService';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';

const EVENT_TYPES = {
  OT: { label: 'Orden de Trabajo', color: 'bg-blue-500', border: 'border-blue-100', text: 'text-blue-700', icon: Briefcase },
  VISIT: { label: 'Visita Técnica', color: 'bg-amber-500', border: 'border-amber-100', text: 'text-amber-700', icon: MapPin },
  MAINTENANCE: { label: 'Mantenimiento', color: 'bg-emerald-500', border: 'border-emerald-100', text: 'text-emerald-700', icon: Wrench },
  OTHER: { label: 'Otro', color: 'bg-slate-500', border: 'border-slate-100', text: 'text-slate-700', icon: Info },
};

export default function OpsCalendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [ots, setOts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    type: 'VISIT',
    startDate: '',
    startTime: '09:00',
    color: '#3b82f6',
    otClientId: ''
  });

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [otsData, eventsData, clientsData] = await Promise.all([
        otService.getOTs(),
        apiFetch('/api/calendar'),
        apiFetch('/api/ot-clients')
      ]);
      setOts(Array.isArray(otsData) ? otsData : []);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
      setOts([]);
      setEvents([]);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: null, date: null });
    for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, date: new Date(year, month, i) });
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOts = ots.filter(ot => ot.scheduledDate && ot.scheduledDate.startsWith(dateStr)).map(ot => ({
      ...ot,
      type: 'OT',
      id: `ot-${ot.id}`,
      title: ot.title,
      time: ot.arrivalTime || '—'
    }));

    const dayEvents = events.filter(e => e.startDate.startsWith(dateStr)).map(e => ({
      ...e,
      id: `ev-${e.id}`,
      time: new Date(e.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    }));

    return [...dayOts, ...dayEvents].sort((a, b) => a.time.localeCompare(b.time));
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const handleToday = () => setCurrentDate(new Date());

  const copyPortalLink = (client) => {
    const url = `${window.location.origin}/portal/${client.portalToken}`;
    navigator.clipboard.writeText(url);
    alert(`Enlace de portal para ${client.name} copiado.`);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedEvent || selectedEvent.id.startsWith('ot-')) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        await apiFetch('/api/calendar', {
          method: 'PUT',
          body: JSON.stringify({
            id: selectedEvent.id.replace('ev-', ''),
            evidence: {
              name: file.name,
              type: file.type.includes('pdf') ? 'PDF' : 'IMAGE',
              base64
            }
          })
        });
        await fetchData();
        const updated = events.find(ev => ev.id === selectedEvent.id.replace('ev-', ''));
        if (updated) setSelectedEvent({ ...updated, id: `ev-${updated.id}`, time: selectedEvent.time });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Error al subir: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    try {
      const start = new Date(`${newEvent.startDate}T${newEvent.startTime}`);
      await apiFetch('/api/calendar', {
        method: 'POST',
        body: JSON.stringify({
          ...newEvent,
          startDate: start.toISOString(),
          color: EVENT_TYPES[newEvent.type].color
        })
      });
      setIsModalOpen(false);
      setNewEvent({ title: '', description: '', type: 'VISIT', startDate: '', startTime: '09:00', color: '#3b82f6', otClientId: '' });
      fetchData();
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Operaciones · Agenda</p>
          <h1 className="text-3xl font-black text-gray-950 capitalize">{monthName}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPortalModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100"
          >
            <ShieldCheck className="h-4 w-4" /> Portales Clientes
          </button>

          <div className="flex items-center bg-gray-50 rounded-2xl p-1 border border-gray-100">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={handleToday} className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">Hoy</button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-gray-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button 
            onClick={() => {
              setSelectedDate(new Date());
              setNewEvent({...newEvent, startDate: new Date().toISOString().split('T')[0]});
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-gray-950 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
          >
            <Plus className="h-4 w-4" /> Nuevo Evento
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50/50 border-b border-gray-100">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <div key={d} className="py-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{d}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[140px]">
          {days.map((d, i) => {
            const dayEvents = d.date ? getEventsForDate(d.date) : [];
            const isToday = d.date && d.date.toDateString() === new Date().toDateString();

            return (
              <div 
                key={i} 
                className={cn(
                  "border-r border-b border-gray-50 p-3 transition-colors group relative",
                  !d.day && "bg-gray-50/30",
                  d.day && "hover:bg-gray-50/50 cursor-pointer"
                )}
                onClick={() => {
                  if (d.date) {
                    setSelectedDate(d.date);
                    setNewEvent({...newEvent, startDate: d.date.toISOString().split('T')[0]});
                    setIsModalOpen(true);
                  }
                }}
              >
                {d.day && (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "h-7 w-7 flex items-center justify-center rounded-full text-xs font-black transition-all",
                        isToday ? "bg-gray-950 text-white shadow-md scale-110" : "text-gray-400 group-hover:text-gray-900"
                      )}>
                        {d.day}
                      </span>
                    </div>
                    
                    <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar flex-1">
                      {dayEvents.map(ev => {
                        const meta = EVENT_TYPES[ev.type] || EVENT_TYPES.OTHER;
                        return (
                          <div 
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            className={cn(
                              "px-2 py-1.5 rounded-lg border flex flex-col gap-0.5 transition-all hover:scale-[1.02] cursor-pointer",
                              meta.color.replace('bg-', 'bg-').replace('500', '50/80'),
                              meta.border
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono font-black text-gray-400">{ev.time}</span>
                              {ev.otClientId && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const client = clients.find(c => c.id === ev.otClientId);
                                    if (client) copyPortalLink(client);
                                  }}
                                  className="text-emerald-500 hover:text-emerald-700"
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-gray-800 truncate leading-tight">{ev.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Detalle (Solo Ops) */}
      {selectedEvent && !isModalOpen && !isPortalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={cn("p-10 text-white relative", EVENT_TYPES[selectedEvent.type || 'OT']?.color || 'bg-gray-800')}>
              <button onClick={() => setSelectedEvent(null)} className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Detalle Operativo</p>
                <h2 className="text-3xl font-black tracking-tight">{selectedEvent.title}</h2>
                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="flex items-center gap-2 bg-black/10 px-4 py-2 rounded-2xl">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{selectedEvent.time} HRS</span>
                  </div>
                  <div className="flex items-center gap-2 bg-black/10 px-4 py-2 rounded-2xl uppercase tracking-widest text-[10px] font-black">
                    {EVENT_TYPES[selectedEvent.type]?.label}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descripción / Notas</h4>
                <p className="text-gray-600 font-medium leading-relaxed">{selectedEvent.description || 'Sin descripción.'}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Evidencias para el Cliente</h4>
                  {!selectedEvent.id.startsWith('ot-') && (
                    <label className="cursor-pointer flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all">
                      <Camera className="h-4 w-4" />
                      Subir Archivo
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {uploading && (
                    <div className="aspect-square bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center">
                      <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                    </div>
                  )}
                  {selectedEvent.evidences?.map((evi, idx) => (
                    <a key={idx} href={evi.url} target="_blank" rel="noreferrer" className="aspect-square bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 group relative">
                      {evi.type === 'IMAGE' ? <img src={evi.url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><FileText className="h-8 w-8 text-red-400" /></div>}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPortalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-8 text-white relative">
              <button onClick={() => setIsPortalModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-emerald-200 uppercase tracking-[0.2em]">Configuración Segura</p>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Portales de Clientes</h2>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid gap-3">
                {clients.map(client => (
                  <div key={client.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-[1.8rem] border border-gray-100 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-emerald-100 rounded-2xl flex items-center justify-center font-black text-emerald-700 text-xs">
                        {client.name.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-gray-900 text-sm">{client.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{client.storeName || 'Sucursal Principal'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => copyPortalLink(client)}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                      Copiar Enlace
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
               <p className="text-[9px] font-bold text-gray-400 max-w-[60%] leading-relaxed uppercase tracking-widest">
                 Los enlaces son únicos. El cliente podrá ver sus actividades y las evidencias que subas.
               </p>
               <button onClick={() => setIsPortalModalOpen(false)} className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-950 p-8 text-white relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">Agenda Operativa</p>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Agendar Actividad</h2>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveEvent} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-2 block">Título</label>
                  <input required type="text" className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-gray-900 transition-all font-bold text-sm" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-2 block">Vincular a Cliente (Opcional)</label>
                  <select 
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-gray-900 transition-all font-bold text-sm"
                    value={newEvent.otClientId}
                    onChange={e => setNewEvent({...newEvent, otClientId: e.target.value})}
                  >
                    <option value="">No vincular</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.storeName ? `(${c.storeName})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-2 block">Tipo</label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(EVENT_TYPES).filter(([k]) => k !== 'OT').map(([key, meta]) => (
                      <button key={key} type="button" onClick={() => setNewEvent({...newEvent, type: key})} className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all", newEvent.type === key ? "bg-gray-950 border-gray-950 text-white" : "bg-white border-gray-100 text-gray-400")}>
                        <meta.icon className="h-5 w-5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">{meta.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-2 block">Fecha</label>
                  <input required type="date" className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-gray-900 transition-all font-bold text-sm" value={newEvent.startDate} onChange={e => setNewEvent({...newEvent, startDate: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 mb-2 block">Hora</label>
                  <input required type="time" className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-gray-900 transition-all font-bold text-sm" value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-gray-950 text-white py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em]">Guardar Actividad</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
