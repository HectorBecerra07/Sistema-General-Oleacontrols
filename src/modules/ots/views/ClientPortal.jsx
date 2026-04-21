import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Info,
  X,
  CheckCircle2,
  Camera,
  FileText,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Package
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

const EVENT_TYPES = {
  OT: { label: 'Orden de Trabajo', color: 'bg-blue-500', border: 'border-blue-100', text: 'text-blue-700', icon: Package },
  VISIT: { label: 'Visita Técnica', color: 'bg-amber-500', border: 'border-amber-100', text: 'text-amber-700', icon: MapPin },
  MAINTENANCE: { label: 'Mantenimiento', color: 'bg-emerald-500', border: 'border-emerald-100', text: 'text-emerald-700', icon: ShieldCheck },
  OTHER: { label: 'Otro', color: 'bg-slate-500', border: 'border-slate-100', text: 'text-slate-700', icon: Info },
};

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchPortalData();
  }, [token]);

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      // Endpoint público que no requiere auth header si enviamos el token
      const res = await fetch(`/api/portal?token=${token}`);
      if (!res.ok) throw new Error('Enlace inválido o expirado');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
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
    if (!date || !data) return [];
    const dateStr = date.toISOString().split('T')[0];
    
    const dayOts = (data.workOrders || []).filter(ot => {
      return ot.scheduledDate && ot.scheduledDate.startsWith(dateStr);
    }).map(ot => ({
      ...ot,
      type: 'OT',
      id: `ot-${ot.id}`,
      time: ot.arrivalTime || '—'
    }));

    const dayEvents = (data.events || []).filter(e => {
      return e.startDate.startsWith(dateStr);
    }).map(e => ({
      ...e,
      id: e.id,
      time: new Date(e.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    }));

    return [...dayOts, ...dayEvents].sort((a, b) => a.time.localeCompare(b.time));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedEvent) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        await fetch(`/api/portal?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: selectedEvent.id,
            evidence: {
              name: file.name,
              type: file.type.includes('pdf') ? 'PDF' : 'IMAGE',
              base64
            }
          })
        });
        await fetchPortalData(); // Recargar para ver la nueva evidencia
        // Actualizar el evento seleccionado localmente para mostrar la nueva evidencia
        const updatedEvent = data.events.find(ev => ev.id === selectedEvent.id);
        setSelectedEvent(updatedEvent);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Error al subir archivo");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Validando acceso seguro...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl text-center space-y-6">
        <div className="h-20 w-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
          <X className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Acceso Denegado</h1>
        <p className="text-gray-500 font-medium">{error}</p>
        <div className="pt-4 border-t border-gray-100">
          <p className="text-[9px] font-black uppercase text-gray-300 tracking-widest leading-relaxed">
            Si crees que esto es un error, contacta a tu asesor de Olea Controls
          </p>
        </div>
      </div>
    </div>
  );

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Navbar Público */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <img src="/img/OLEACONTROLS.png" className="h-6 object-contain" alt="Olea Controls" />
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Portal de Cliente Seguro</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        {/* Header de Bienvenida */}
        <div className="bg-emerald-600 p-10 rounded-[3rem] text-white shadow-2xl shadow-emerald-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <ShieldCheck className="h-40 w-40" />
          </div>
          <div className="relative z-10 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Bienvenido de nuevo</p>
            <h1 className="text-4xl font-black tracking-tight">{data.client.name}</h1>
            <div className="flex flex-wrap items-center gap-6 pt-4">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
                <MapPin className="h-4 w-4 text-emerald-300" />
                <span className="text-xs font-bold">{data.client.address}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span className="text-xs font-bold">Mantenimientos al día</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna Izquierda: Calendario */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-900 capitalize">{monthName}</h2>
                <div className="flex items-center bg-gray-50 rounded-2xl p-1 border border-gray-100">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Hoy</button>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-gray-50 pb-4">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                  <div key={d} className="text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">{d}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 auto-rows-[100px]">
                {days.map((d, i) => {
                  const dayEvents = getEventsForDate(d.date);
                  const isToday = d.date && d.date.toDateString() === new Date().toDateString();
                  return (
                    <div key={i} className={cn(
                      "p-1 border-r border-b border-gray-50 relative",
                      !d.day && "bg-gray-50/30"
                    )}>
                      {d.day && (
                        <div className="h-full flex flex-col items-center">
                          <span className={cn(
                            "h-6 w-6 flex items-center justify-center rounded-full text-[10px] font-black mb-1",
                            isToday ? "bg-emerald-500 text-white" : "text-gray-400"
                          )}>{d.day}</span>
                          <div className="w-full space-y-1 overflow-y-auto px-1">
                            {dayEvents.map(ev => (
                              <button 
                                key={ev.id} 
                                onClick={() => setSelectedEvent(ev)}
                                className={cn(
                                  "w-full h-2 rounded-full transition-transform hover:scale-110",
                                  EVENT_TYPES[ev.type]?.color || 'bg-gray-400'
                                )} 
                                title={ev.title}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Próximos Eventos / Detalles */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Actividades del Mes</h3>
              <div className="space-y-4">
                {data.events.length === 0 && data.workOrders.length === 0 ? (
                  <div className="text-center py-10 opacity-40">
                    <CalendarIcon className="h-10 w-10 mx-auto mb-2" />
                    <p className="text-xs font-bold">No hay actividades programadas</p>
                  </div>
                ) : (
                  [...(data.events || []), ...(data.workOrders || [])]
                    .sort((a, b) => new Date(a.startDate || a.scheduledDate) - new Date(b.startDate || b.scheduledDate))
                    .slice(0, 5)
                    .map(ev => {
                      const type = ev.type || 'OT';
                      const meta = EVENT_TYPES[type] || EVENT_TYPES.OTHER;
                      return (
                        <div key={ev.id} onClick={() => setSelectedEvent(ev)} className="group cursor-pointer flex gap-4 p-4 rounded-3xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0", meta.color.replace('bg-', 'bg-').replace('500', '100'))}>
                            <meta.icon className={cn("h-5 w-5", meta.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(ev.startDate || ev.scheduledDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>
                            <p className="font-black text-gray-900 truncate">{ev.title}</p>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalle de Evento */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={cn("p-10 text-white relative", EVENT_TYPES[selectedEvent.type || 'OT']?.color || 'bg-gray-800')}>
              <button onClick={() => setSelectedEvent(null)} className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="h-6 w-6" />
              </button>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Detalle de Actividad</p>
                <h2 className="text-3xl font-black tracking-tight">{selectedEvent.title}</h2>
                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="flex items-center gap-2 bg-black/10 px-4 py-2 rounded-2xl">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{selectedEvent.time || '09:00'} HRS</span>
                  </div>
                  <div className="flex items-center gap-2 bg-black/10 px-4 py-2 rounded-2xl">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{selectedEvent.status || 'PROGRAMADO'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Descripción</h4>
                <p className="text-gray-600 font-medium leading-relaxed">{selectedEvent.description || 'Sin descripción adicional disponible.'}</p>
              </div>

              {/* Sección de Evidencias */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Evidencias y Reportes de Servicio</h4>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedEvent.evidences?.length > 0 ? (
                    selectedEvent.evidences.map((evi, idx) => (
                      <a key={idx} href={evi.url} target="_blank" rel="noreferrer" className="group aspect-square bg-gray-50 rounded-3xl overflow-hidden relative border border-gray-100 hover:shadow-lg transition-all">
                        {evi.type === 'IMAGE' ? (
                          <img src={evi.url} className="h-full w-full object-cover" alt="Evidencia" />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center space-y-2">
                            <FileText className="h-8 w-8 text-red-400" />
                            <span className="text-[8px] font-black uppercase text-gray-400">PDF Document</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="h-6 w-6 text-white" />
                        </div>
                      </a>
                    ))
                  ) : (
                    !uploading && (
                      <div className="col-span-full py-10 bg-gray-50 rounded-[2rem] text-center">
                        <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">No hay archivos cargados aún</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-gray-100 text-center space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-300">Impulsado por Olea Controls Tech Portal</p>
        <p className="text-[8px] font-bold text-gray-400">© {new Date().getFullYear()} Olea Controls. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
