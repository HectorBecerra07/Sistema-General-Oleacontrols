import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Search, MoreHorizontal, Clock, Eye,
  X, Send, Trophy, Building2, User, Trash2, AlertCircle, FileText,
  MapPin, Loader2, Layers, ChevronDown, ChevronUp, Receipt, TrendingDown,
  DollarSign, ChevronLeft, ChevronRight, Check, Briefcase, Zap
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { otService } from '@/api/otService';
import { crmService } from '@/api/crmService';
import { hrService } from '@/api/hrService';
import { useAuth, ROLES } from '@/store/AuthContext';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Custom Marker Icons
const otIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Fix Leaflet markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapEvents({ onLocationSelect }) {
  useMapEvents({ click(e) { onLocationSelect(e.latlng); } });
  return null;
}

function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, 15);
  return null;
}

export default function SupervisorOTs() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [ots, setOts] = useState([]);
  const [expandedOtId, setExpandedOtId] = useState(null);
  const [otFinancials, setOtFinancials] = useState({});
  const [loadingFinancials, setLoadingFinancials] = useState({});
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [availableTechs, setAvailableTechs] = useState([]);
  const [techLocations, setTechLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [mapCenter, setMapCenter] = useState([19.4326, -99.1332]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [otToDelete, setOtToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [extraFunds, setExtraFunds] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', priority: 'ALL' });
  const [formStep, setFormStep] = useState(1);

  const initialNewOT = {
    title: '', storeNumber: '', storeName: '', client: '', address: '', secondaryAddress: '',
    otAddress: '', otReference: '', lat: 19.4326, lng: -99.1332, clientEmail: '', clientPhone: '',
    contactName: '', contactEmail: '', contactPhone: '', leadTechId: '', leadTechName: '',
    assistantTechs: [], workDescription: '', arrivalTime: '09:00',
    scheduledDate: new Date().toISOString().split('T')[0],
    priority: 'MEDIUM', assignedFunds: 0
  };

  const [newOT, setNewOT] = useState(initialNewOT);

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      try {
        const locs = await otService.getTechnicianLocations();
        setTechLocations(locs);
      } catch (err) { }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [o, c, t, allEmployees] = await Promise.all([
        otService.getOTs(),
        crmService.getClients(),
        otService.getTemplates(),
        hrService.getEmployees()
      ]);
      setOts(o);
      setClients(c);
      setTemplates(t);
      const techs = allEmployees.filter(emp => emp.roles.includes(ROLES.TECH) || emp.roles.includes('Tech'));
      setAvailableTechs(techs);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  /**
   * ✅ EXPORT AER (ARREGLADO):
   * - Carga imágenes desde .txt (base64 o dataURL)
   * - Mantiene proporción con "fit"
   * - Evita que el texto choque con logos
   * - Pone "placa blanca" para el logo derecho (contraste)
   */
  const handleExportAER = async (ot) => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper: carga base64/dataURL desde txt
    const loadDataUrlFromTxt = async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const raw = (await res.text()).trim();

        // Si ya viene data URL completo
        if (raw.startsWith('data:image/')) return raw;

        // Si viene solo base64 "pelón"
        return `data:image/png;base64,${raw}`;
      } catch (err) {
        console.error('Error cargando imagen:', url, err);
        return null;
      }
    };

    // Helper: inserta imagen ajustada (sin deformar)
    const addImageFit = (dataUrl, x, y, maxW, maxH, opts = {}) => {
      if (!dataUrl) return null;

      const fmt = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      const props = doc.getImageProperties(dataUrl);
      const imgW = props.width || 1;
      const imgH = props.height || 1;

      const scale = Math.min(maxW / imgW, maxH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;

      // alignment inside box
      const dx = opts.align === 'center' ? (maxW - w) / 2 : 0;
      const dy = opts.valign === 'middle' ? (maxH - h) / 2 : 0;

      doc.addImage(dataUrl, fmt, x + dx, y + dy, w, h, undefined, 'FAST');
      return { w, h };
    };

    const insignia = await loadDataUrlFromTxt('/img/base64 logo.txt');
    const logo = await loadDataUrlFromTxt('/img/oleacontrols.txt');

    // ===== Header =====
    const headerH = 64;

    // Fondo azul
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    // Logo izquierdo (insignia)
    const leftPad = 24;
    const topPad = 12;
    addImageFit(insignia, leftPad, topPad, 44, 44, { align: 'center', valign: 'middle' });

    // Logo derecho con placa blanca (para contraste)
    const rightPad = 24;
    const plateW = 140;
    const plateH = 36;
    const plateX = pageWidth - rightPad - plateW;
    const plateY = 14;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(plateX, plateY, plateW, plateH, 10, 10, 'F');

    addImageFit(logo, plateX + 10, plateY + 6, plateW - 20, plateH - 12, { align: 'center', valign: 'middle' });

    // Título centrado (con "zona segura" para no chocar con logos)
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ACTA DE ENTREGA / RECEPCIÓN', pageWidth / 2, 30, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`FOLIO OFICIAL: ${ot.otNumber || 'N/A'}`, pageWidth / 2, 45, { align: 'center' });

    // ===== 2. Información General (Tabla) =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS GENERALES DEL SERVICIO', 24, headerH + 28);

    autoTable(doc, {
      startY: headerH + 34,
      head: [['CLIENTE', 'SUCURSAL', 'FECHA DE CIERRE', 'ESTADO']],
      body: [[
        String((ot.clientName || ot.client || 'N/A')).toUpperCase(),
        String((ot.storeName || 'OFICINA CENTRAL')).toUpperCase(),
        new Date(ot.finishedAt || ot.updatedAt || Date.now()).toLocaleString(),
        String((ot.status || 'N/A')).toUpperCase()
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 6
      },
      margin: { left: 24, right: 24 }
    });

    // ===== 3. Ubicación y Contacto =====
    const y1 = doc.lastAutoTable.finalY + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('UBICACIÓN Y CONTACTO EN SITIO', 24, y1);

    autoTable(doc, {
      startY: y1 + 6,
      body: [
        ['DIRECCIÓN:', ot.address || 'N/A'],
        ['REFERENCIA:', ot.otReference || ot.otAddress || 'N/A'],
        ['ENCARGADO:', ot.contactName || 'N/A'],
        ['TELÉFONO:', ot.contactPhone || 'N/A']
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
      margin: { left: 24, right: 24 }
    });

    // ===== 4. Descripción Técnica =====
    const descY = doc.lastAutoTable.finalY + 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('REPORTE TÉCNICO DE ACTIVIDADES', 24, descY);

    // Caja de reporte (auto altura simple con wrap)
    const boxX = 24;
    const boxY = descY + 8;
    const boxW = pageWidth - 48;
    const boxH = 88;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, boxY, boxW, boxH, 10, 10, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    const reportText =
      ot.deliveryDetails ||
      ot.report ||
      ot.description ||
      ot.workDescription ||
      'No se proporcionó un reporte detallado.';

    const splitDesc = doc.splitTextToSize(String(reportText), boxW - 20);
    doc.text(splitDesc, boxX + 10, boxY + 18);

    // ===== 5. Equipo =====
    const staffY = boxY + boxH + 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('EQUIPO DE TRABAJO', 24, staffY);

    autoTable(doc, {
      startY: staffY + 6,
      head: [['RESPONSABILIDAD', 'NOMBRE DEL COLABORADOR']],
      body: [
        ['TÉCNICO LÍDER', ot.leadTechName || 'PENDIENTE'],
        ['SUPERVISOR', ot.supervisor?.name || 'CENTRAL OPERATIVA'],
        ['ASIGNADO POR', ot.assignedByName || 'SISTEMA AUTOMÁTICO']
      ],
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      margin: { left: 24, right: 24 }
    });

    // ===== 6. Firmas =====
    const footerY = pageHeight - 100;

    // Dibujar firmas antes de las líneas si existen
    if (ot.signature) {
      try {
        doc.addImage(ot.signature, 'PNG', 100, footerY - 60, 100, 50);
      } catch (e) { console.error("Error firma TSC", e); }
    }
    if (ot.clientSignature) {
      try {
        doc.addImage(ot.clientSignature, 'PNG', pageWidth - 200, footerY - 60, 100, 50);
      } catch (e) { console.error("Error firma Cliente", e); }
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(70, footerY, 230, footerY);
    doc.line(pageWidth - 230, footerY, pageWidth - 70, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`TSC: ${ot.leadTechName || 'N/A'}`.toUpperCase(), 150, footerY + 14, { align: 'center' });
    doc.text('FIRMA DE CONFORMIDAD CLIENTE', pageWidth - 150, footerY + 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.text(
      'Este documento certifica la correcta ejecución de los trabajos descritos bajo los estándares de Olea Controls.',
      pageWidth / 2,
      pageHeight - 28,
      { align: 'center' }
    );
    doc.text(
      'Olea Controls © 2026 - Plataforma Global de Gestión Operativa',
      pageWidth / 2,
      pageHeight - 16,
      { align: 'center' }
    );

    doc.save(`AER_${ot.otNumber || ot.id}.pdf`);
  };

  const toggleOtAccordion = async (otId) => {
    if (expandedOtId === otId) {
      setExpandedOtId(null);
      return;
    }

    setExpandedOtId(otId);

    // Solo cargar si no lo tenemos o para refrescar
    setLoadingFinancials(prev => ({ ...prev, [otId]: true }));
    try {
      const financials = await otService.getOTFinancials(otId);
      setOtFinancials(prev => ({ ...prev, [otId]: financials }));
    } catch (err) {
      console.error("Error cargando financieros:", err);
    } finally {
      setLoadingFinancials(prev => ({ ...prev, [otId]: false }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const data = { ...newOT };
      if (extraFunds > 0) data.assignedFunds = (parseFloat(newOT.assignedFunds) || 0) + parseFloat(extraFunds);
      
      if (isEditMode) {
        await otService.updateOT(editingId, data);
      } else {
        await otService.saveOT({ ...data, supervisorId: currentUser.id });
      }
      
      setIsModalOpen(false);
      await loadData();
    } catch (err) { 
      alert("Error al procesar la OT: " + err.message); 
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateModal = () => {
    setNewOT(initialNewOT);
    setIsEditMode(false);
    setFormStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (ot) => {
    setNewOT({
      ...ot,
      workDescription: ot.description || ot.workDescription || '',
      scheduledDate: ot.scheduledDate
        ? new Date(ot.scheduledDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    });
    setEditingId(ot.id);
    setIsEditMode(true);
    setFormStep(1);
    setMapCenter([ot.lat || 19.4326, ot.lng || -99.1332]);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!otToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await otService.deleteOT(otToDelete.id);
      setIsDeleteModalOpen(false);
      setOtToDelete(null);
      await loadData();
    } catch (err) {
      alert("Error al eliminar OT: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLocationSearch = async () => {
    if (!newOT.address) return;
    setSearchLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newOT.address)}&countrycodes=mx&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setNewOT(prev => ({ ...prev, lat: parseFloat(lat), lng: parseFloat(lon), address: display_name }));
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
      }
    } catch (error) { console.error(error); }
    finally { setSearchLoading(false); }
  };

  const handleClientSelect = (clientId) => {
    if (!clientId) return;
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setNewOT(prev => ({
        ...prev,
        client: client.name,
        address: client.address,
        clientEmail: client.email || '',
        clientPhone: client.phone || '',
        lat: client.lat || prev.lat,
        lng: client.lng || prev.lng
      }));
      if (client.lat && client.lng) setMapCenter([client.lat, client.lng]);
    }
  };

  const handleTemplateSelect = (templateId) => {
    if (!templateId) return;
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setNewOT(prev => ({
        ...prev,
        title: template.title,
        workDescription: template.workDescription || template.description,
        priority: template.priority,
        arrivalTime: template.arrivalTime
      }));
    }
  };

  const toggleAssistantTech = (tech) => {
    setNewOT(prev => {
      const exists = prev.assistantTechs?.find(t => t.id === tech.id);
      if (exists) return { ...prev, assistantTechs: prev.assistantTechs.filter(t => t.id !== tech.id) };
      return { ...prev, assistantTechs: [...(prev.assistantTechs || []), tech] };
    });
  };

  const filteredOts = ots.filter(ot => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (ot.id?.toLowerCase() || '').includes(searchLower) ||
      (ot.title?.toLowerCase() || '').includes(searchLower) ||
      (ot.client?.toLowerCase() || '').includes(searchLower) ||
      (ot.clientName?.toLowerCase() || '').includes(searchLower) ||
      (ot.otNumber?.toLowerCase() || '').includes(searchLower);
    const matchesStatus = filters.status === 'ALL' || ot.status === filters.status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Control de Operaciones</h2>
          <p className="text-sm text-gray-500 font-medium mt-2">Monitoreo estratégico y auditoría técnica.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/ots/leaderboard')}
            className="bg-white border text-gray-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 shadow-sm"
          >
            <Trophy className="h-4 w-4 text-amber-500" /> Ranking
          </button>
          <button
            onClick={openCreateModal}
            className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <ClipboardList className="h-4 w-4" /> Nueva OT
          </button>
        </div>
      </div>

      <div className="h-[350px] rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-inner relative z-0 bg-gray-50">
        <MapContainer center={[19.4326, -99.1332]} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {ots.filter(o => o.lat && o.lng).map(ot => (
            <Marker key={ot.id} position={[ot.lat, ot.lng]} icon={otIcon}>
              <Popup>
                <div className="p-2 space-y-2">
                  <p className="font-black text-sm uppercase">{ot.otNumber}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">{ot.title}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="bg-white border rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por folio o cliente..."
              className="pl-12 pr-4 py-3 bg-white border rounded-2xl outline-none w-full font-bold text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto">
            {['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].map(s => (
              <button
                key={s}
                onClick={() => setFilters({ ...filters, status: s })}
                className={cn(
                  "px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all whitespace-nowrap",
                  filters.status === s ? "bg-gray-900 text-white shadow-md" : "bg-white text-gray-400 hover:bg-gray-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-white border-b">
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-4 py-5 w-10"></th>
                <th className="px-4 py-5">Folio / Prioridad</th>
                <th className="px-6 py-5">Servicio y Cliente</th>
                <th className="px-6 py-5">Técnico / Fondo</th>
                <th className="px-6 py-5">Estado</th>
                <th className="px-8 py-5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOts.map((ot) => (
                <React.Fragment key={ot.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/30 transition-colors group cursor-pointer",
                    expandedOtId === ot.id && "bg-blue-50/20"
                  )} onClick={() => toggleOtAccordion(ot.id)}>
                    <td className="px-4 py-5 text-center">
                      {expandedOtId === ot.id ? (
                        <ChevronUp className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
                      )}
                    </td>
                    <td className="px-4 py-5">
                      <p className="font-black text-sm text-gray-900">{ot.otNumber}</p>
                      <span
                        className={cn(
                          "text-[8px] font-black px-1.5 py-0.5 rounded uppercase border",
                          ot.priority === 'HIGH'
                            ? "bg-red-50 text-red-600 border-red-100"
                            : "bg-blue-50 text-blue-600 border-blue-100"
                        )}
                      >
                        {ot.priority}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-bold text-sm text-gray-700 leading-tight">{ot.title}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{ot.clientName || ot.client}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs uppercase">
                          {ot.leadTechName?.charAt(0) || 'T'}
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-700 uppercase">{ot.leadTechName || 'Pendiente'}</p>
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                              Fondo: ${ot.assignedFunds?.toLocaleString()}
                            </p>
                            {ot.assignedByName && (
                              <p className="text-[8px] text-indigo-500 font-black uppercase tracking-tighter flex items-center gap-1">
                                <Send className="h-2 w-2" /> {ot.assignedByName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={cn(
                          "text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm",
                          ot.status === 'COMPLETED'
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-100"
                            : ot.status === 'IN_PROGRESS'
                              ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse"
                              : "bg-gray-50 text-gray-400 border-gray-100"
                        )}
                      >
                        {ot.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {ot.status === 'COMPLETED' && (
                          <button
                            onClick={() => {
                              if (ot.deliveryActUrl) {
                                window.open(ot.deliveryActUrl, '_blank');
                              } else {
                                handleExportAER(ot);
                              }
                            }}
                            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 border border-emerald-100 transition-all shadow-sm"
                          >
                            <FileText className="h-4 w-4" /> {ot.deliveryActUrl ? 'Ver Acta' : 'Generar Acta'}
                          </button>
                        )}
                        <button onClick={() => navigate(`/ots/${ot.id}`)} className="p-2 text-gray-400 hover:text-primary transition-all">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => openEditModal(ot)} 
                          disabled={ot.status === 'COMPLETED'}
                          className={cn("p-2 transition-all", ot.status === 'COMPLETED' ? "text-gray-200 cursor-not-allowed" : "text-gray-400 hover:text-primary")}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => { setOtToDelete(ot); setIsDeleteModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Fila de Acordeón: Gastos */}
                  {expandedOtId === ot.id && (
                    <tr>
                      <td colSpan="6" className="px-8 py-0 bg-gray-50/50">
                        <div className="py-6 animate-in slide-in-from-top-4 duration-300">
                          {loadingFinancials[ot.id] ? (
                            <div className="flex flex-col items-center py-8 gap-3">
                              <Loader2 className="h-6 w-6 text-primary animate-spin" />
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargando desglose financiero...</p>
                            </div>
                          ) : otFinancials[ot.id] ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Resumen Financiero */}
                              <div className="lg:col-span-1 space-y-4">
                                <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm">
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                      <DollarSign className="h-4 w-4" />
                                    </div>
                                    <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Estado de Cuenta OT</h4>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[9px] font-bold text-gray-400 uppercase">Presupuesto:</span>
                                      <span className="text-sm font-black text-gray-900">${otFinancials[ot.id].assignedFunds.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[9px] font-bold text-gray-400 uppercase">Gastos Reales:</span>
                                      <span className="text-sm font-black text-red-500">-${otFinancials[ot.id].totalSpent.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2 border-t flex justify-between items-center">
                                      <span className="text-[9px] font-black text-gray-600 uppercase">Balance Actual:</span>
                                      <span className={cn(
                                        "text-lg font-black",
                                        otFinancials[ot.id].balance < 0 ? "text-red-600" : "text-emerald-600"
                                      )}>
                                        ${otFinancials[ot.id].balance.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {otFinancials[ot.id].isOverLimit && (
                                    <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2">
                                      <AlertCircle className="h-4 w-4 text-red-500" />
                                      <p className="text-[8px] font-black text-red-600 uppercase leading-tight">
                                        Excedente detectado. Requiere auditoría.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Lista de Gastos */}
                              <div className="lg:col-span-2">
                                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                                  <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Receipt className="h-4 w-4 text-primary" />
                                      <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest">Desglose de Gastos</span>
                                    </div>
                                    <span className="bg-white px-2 py-1 rounded-lg text-[8px] font-black text-gray-400 border border-gray-100 uppercase">
                                      {otFinancials[ot.id].expenses.length} registros
                                    </span>
                                  </div>
                                  
                                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {otFinancials[ot.id].expenses.length === 0 ? (
                                      <div className="py-8 text-center">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase italic">No hay gastos registrados en esta OT.</p>
                                      </div>
                                    ) : (
                                      <table className="w-full text-left">
                                        <thead className="bg-gray-50/50 sticky top-0">
                                          <tr className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                                            <th className="px-4 py-2">Fecha</th>
                                            <th className="px-4 py-2">Categoría</th>
                                            <th className="px-4 py-2">Concepto</th>
                                            <th className="px-4 py-2 text-right">Monto</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {otFinancials[ot.id].expenses.map((expense) => (
                                            <tr key={expense.id} className="hover:bg-gray-50/50">
                                              <td className="px-4 py-3 text-[10px] font-bold text-gray-500 whitespace-nowrap">
                                                {new Date(expense.date).toLocaleDateString()}
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 uppercase">
                                                  {expense.category}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3">
                                                <p className="text-[10px] font-black text-gray-900 leading-tight uppercase line-clamp-1">{expense.description || expense.concept}</p>
                                                <p className="text-[8px] text-gray-400 font-bold uppercase">{expense.type}</p>
                                              </td>
                                              <td className="px-4 py-3 text-right">
                                                <p className="text-[11px] font-black text-gray-900">${expense.amount.toLocaleString()}</p>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="py-8 text-center">
                              <p className="text-[10px] font-black text-red-400 uppercase">Error al cargar datos financieros.</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Principal de OT — Wizard 3 pasos */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: '94vh' }}>

            {/* ── Header dark con stepper ── */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-7 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-8 left-1/4 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex justify-between items-start mb-7">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-primary" /> Olea Controls · Operaciones 2026
                  </p>
                  <h3 className="text-2xl font-black text-white tracking-tight leading-none">
                    {isEditMode ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 font-medium">
                    {formStep === 1 && 'Paso 1 — Identificación del servicio'}
                    {formStep === 2 && 'Paso 2 — Ubicación y contacto en sitio'}
                    {formStep === 3 && 'Paso 3 — Equipo, programación y fondos'}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                  <X className="h-5 w-5 text-slate-300" />
                </button>
              </div>

              {/* Stepper */}
              <div className="relative z-10 flex items-center">
                {[{ n: 1, label: 'Servicio' }, { n: 2, label: 'Ubicación' }, { n: 3, label: 'Equipo' }].map(({ n, label }, i, arr) => (
                  <React.Fragment key={n}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-black border-2 transition-all duration-300 shrink-0",
                        formStep > n  ? "bg-primary border-primary text-white shadow-md shadow-primary/30"
                        : formStep === n ? "bg-white border-white text-slate-900 shadow-lg"
                        : "bg-transparent border-slate-700 text-slate-600"
                      )}>
                        {formStep > n ? <Check className="h-3.5 w-3.5" /> : n}
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider transition-all hidden sm:block",
                        formStep === n ? "text-white" : formStep > n ? "text-primary" : "text-slate-600"
                      )}>{label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className={cn("flex-1 h-px mx-3 transition-all duration-500", formStep > n ? "bg-primary" : "bg-slate-700")} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ── Contenido scrollable ── */}
            <div className="flex-1 overflow-y-auto">
              <form id="ot-form" onSubmit={handleFormSubmit}>

                {/* ═══ PASO 1: Identificación ═══ */}
                {formStep === 1 && (
                  <div className="p-8 space-y-7">

                    {/* Selectors rápidos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-primary mb-2 block">Importar cliente CRM</label>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                          <select
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-xs outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                            onChange={e => handleClientSelect(e.target.value)}
                          >
                            <option value="">Seleccionar cliente...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-purple-500 mb-2 block">Plantilla de servicio</label>
                        <div className="relative">
                          <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                          <select
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-xs outline-none focus:border-purple-400 focus:bg-white transition-all shadow-sm"
                            onChange={e => handleTemplateSelect(e.target.value)}
                          >
                            <option value="">Seleccionar tipo...</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="relative flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 whitespace-nowrap">Datos de la orden</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {/* Título */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Título de la Orden *</label>
                      <input
                        required
                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm placeholder:text-gray-300"
                        value={newOT.title}
                        onChange={e => setNewOT({ ...newOT, title: e.target.value })}
                        placeholder="Ej. Mantenimiento preventivo sistema eléctrico..."
                      />
                    </div>

                    {/* Sucursal */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">No. Sucursal</label>
                        <input
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm placeholder:text-gray-300"
                          value={newOT.storeNumber}
                          onChange={e => setNewOT({ ...newOT, storeNumber: e.target.value })}
                          placeholder="152"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Nombre Sucursal</label>
                        <input
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm placeholder:text-gray-300"
                          value={newOT.storeName}
                          onChange={e => setNewOT({ ...newOT, storeName: e.target.value })}
                          placeholder="Coppel Insurgentes..."
                        />
                      </div>
                    </div>

                    {/* Empresa */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Razón Social / Empresa</label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                        <input
                          className="w-full pl-11 pr-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm placeholder:text-gray-300"
                          value={newOT.client}
                          onChange={e => setNewOT({ ...newOT, client: e.target.value })}
                          placeholder="Coppel S.A. de C.V."
                        />
                      </div>
                    </div>

                    {/* Prioridad — visual cards */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3 block">Prioridad</label>
                      <div className="grid grid-cols-4 gap-2.5">
                        {[
                          { value: 'LOW',    label: 'Baja',    dot: 'bg-gray-400',   active: 'bg-gray-900 border-gray-900 text-white shadow-lg', passive: 'bg-gray-50 border-gray-200 text-gray-500' },
                          { value: 'MEDIUM', label: 'Media',   dot: 'bg-blue-500',   active: 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200', passive: 'bg-blue-50 border-blue-100 text-blue-600' },
                          { value: 'HIGH',   label: 'Alta',    dot: 'bg-orange-500', active: 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200', passive: 'bg-orange-50 border-orange-100 text-orange-600' },
                          { value: 'URGENT', label: 'Urgente', dot: 'bg-red-500',    active: 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-200', passive: 'bg-red-50 border-red-100 text-red-600' },
                        ].map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setNewOT({ ...newOT, priority: p.value })}
                            className={cn(
                              "py-3.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-wide transition-all duration-200 flex flex-col items-center gap-1.5",
                              newOT.priority === p.value ? p.active + ' scale-105' : p.passive + ' hover:scale-105'
                            )}
                          >
                            <div className={cn("h-2 w-2 rounded-full", newOT.priority === p.value ? "bg-white/60" : p.dot)} />
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ PASO 2: Ubicación y Contacto ═══ */}
                {formStep === 2 && (
                  <div className="p-8 space-y-6">
                    {/* Dirección */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Dirección Principal *</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                          <input
                            required
                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm placeholder:text-gray-300"
                            value={newOT.address}
                            onChange={e => setNewOT({ ...newOT, address: e.target.value })}
                            placeholder="Buscar dirección o hacer clic en el mapa..."
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleLocationSearch}
                          className="shrink-0 bg-gray-900 text-white px-5 rounded-2xl hover:bg-black transition-all flex items-center gap-2 shadow-sm"
                        >
                          {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Dirección Secundaria</label>
                        <input
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm placeholder:text-gray-300"
                          value={newOT.secondaryAddress}
                          onChange={e => setNewOT({ ...newOT, secondaryAddress: e.target.value })}
                          placeholder="Interior, piso..."
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Zona / Referencia</label>
                        <input
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm placeholder:text-gray-300"
                          value={newOT.otAddress}
                          onChange={e => setNewOT({ ...newOT, otAddress: e.target.value })}
                          placeholder="Frente al banco..."
                        />
                      </div>
                    </div>

                    {/* Mapa */}
                    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner relative z-0" style={{ height: 200 }}>
                      <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[newOT.lat, newOT.lng]} icon={otIcon} />
                        <MapEvents onLocationSelect={async (latlng) => {
                          setNewOT(prev => ({ ...prev, lat: latlng.lat, lng: latlng.lng }));
                          try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}`);
                            const data = await res.json();
                            if (data?.display_name) setNewOT(prev => ({ ...prev, address: data.display_name }));
                          } catch (err) { console.error(err); }
                        }} />
                        <ChangeView center={mapCenter} />
                      </MapContainer>
                    </div>
                    <p className="text-[9px] font-bold text-gray-300 text-center uppercase tracking-widest">Haz clic en el mapa para ajustar la ubicación exacta</p>

                    {/* Contacto en sitio */}
                    <div className="bg-blue-50/60 rounded-2xl border border-blue-100 p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-7 w-7 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><User className="h-4 w-4" /></div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-700">Contacto en Sitio</h4>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Persona Responsable</label>
                        <input
                          className="w-full px-5 py-3 bg-white border border-blue-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-400 transition-all shadow-sm placeholder:text-gray-300"
                          value={newOT.contactName}
                          onChange={e => setNewOT({ ...newOT, contactName: e.target.value })}
                          placeholder="Nombre del encargado..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Email</label>
                          <input type="email"
                            className="w-full px-4 py-3 bg-white border border-blue-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-400 transition-all shadow-sm placeholder:text-gray-300"
                            value={newOT.contactEmail}
                            onChange={e => setNewOT({ ...newOT, contactEmail: e.target.value })}
                            placeholder="email@empresa.com"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Teléfono</label>
                          <input
                            className="w-full px-4 py-3 bg-white border border-blue-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-400 transition-all shadow-sm placeholder:text-gray-300"
                            value={newOT.contactPhone}
                            onChange={e => setNewOT({ ...newOT, contactPhone: e.target.value })}
                            placeholder="55 0000 0000"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Referencia de Acceso</label>
                        <input
                          className="w-full px-5 py-3 bg-white border border-blue-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-400 transition-all shadow-sm placeholder:text-gray-300"
                          value={newOT.otReference}
                          onChange={e => setNewOT({ ...newOT, otReference: e.target.value })}
                          placeholder="Usar acceso por puerta lateral..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══ PASO 3: Equipo y Programación ═══ */}
                {formStep === 3 && (
                  <div className="p-8 space-y-6">
                    {/* Fecha y hora */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Fecha Programada</label>
                        <input type="date"
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                          value={newOT.scheduledDate}
                          onChange={e => setNewOT({ ...newOT, scheduledDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Hora de Llegada</label>
                        <input type="time"
                          className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                          value={newOT.arrivalTime}
                          onChange={e => setNewOT({ ...newOT, arrivalTime: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Técnico líder */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Técnico Líder *</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
                        <select
                          required
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                          value={newOT.leadTechId}
                          onChange={e => setNewOT({
                            ...newOT,
                            leadTechId: e.target.value,
                            leadTechName: e.target.options[e.target.selectedIndex].text
                          })}
                        >
                          <option value="">Seleccionar técnico responsable...</option>
                          {availableTechs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Equipo de apoyo */}
                    {availableTechs.filter(t => t.id !== newOT.leadTechId).length > 0 && (
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3 block">Equipo de Apoyo</label>
                        <div className="flex flex-wrap gap-2">
                          {availableTechs.filter(t => t.id !== newOT.leadTechId).map(tech => {
                            const isSelected = newOT.assistantTechs?.some(t => t.id === tech.id);
                            return (
                              <button
                                key={tech.id}
                                type="button"
                                onClick={() => toggleAssistantTech(tech)}
                                className={cn(
                                  "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide border-2 transition-all duration-200 flex items-center gap-1.5",
                                  isSelected
                                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105"
                                    : "bg-gray-50 text-gray-500 border-gray-100 hover:border-primary/30 hover:text-primary"
                                )}
                              >
                                <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0", isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600")}>
                                  {tech.name.charAt(0).toUpperCase()}
                                </div>
                                {tech.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fondos */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Presupuesto Asignado</p>
                        <p className="text-3xl font-black tabular-nums">
                          ${(isEditMode
                            ? (parseFloat(newOT.assignedFunds || 0) + parseFloat(extraFunds || 0))
                            : parseFloat(newOT.assignedFunds || 0)
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                          {isEditMode ? 'Fondos Extra' : 'Monto Inicial'}
                        </label>
                        <input
                          type="number"
                          className="w-28 px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white font-black text-sm outline-none focus:border-primary text-right"
                          value={isEditMode ? extraFunds : newOT.assignedFunds}
                          onChange={e => isEditMode
                            ? setExtraFunds(e.target.value)
                            : setNewOT({ ...newOT, assignedFunds: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Instrucciones */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Instrucciones Técnicas</label>
                      <textarea
                        rows="4"
                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-primary focus:bg-white transition-all shadow-sm resize-none placeholder:text-gray-300"
                        value={newOT.workDescription}
                        onChange={e => setNewOT({ ...newOT, workDescription: e.target.value })}
                        placeholder="Describe el trabajo técnico, materiales necesarios, condiciones especiales de acceso..."
                      />
                    </div>
                  </div>
                )}

              </form>
            </div>

            {/* ── Footer navegación ── */}
            <div className="shrink-0 p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-[2rem] flex justify-between items-center">
              <button
                type="button"
                onClick={formStep > 1 ? () => setFormStep(s => s - 1) : () => setIsModalOpen(false)}
                className="px-5 py-3 text-gray-500 font-black text-xs uppercase hover:text-gray-700 transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                {formStep > 1 ? 'Anterior' : 'Cancelar'}
              </button>

              {/* Dots indicator */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map(n => (
                  <div key={n} className={cn("rounded-full transition-all duration-300", formStep === n ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-gray-200")} />
                ))}
              </div>

              {formStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setFormStep(s => s + 1)}
                  className="bg-gray-900 text-white px-7 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-1.5 hover:bg-black transition-all shadow-sm"
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  form="ot-form"
                  disabled={isSaving}
                  className="bg-primary text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-xl shadow-primary/20 flex items-center gap-2 disabled:opacity-50 hover:bg-primary/90 transition-all active:scale-95"
                >
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                  ) : (
                    isEditMode ? 'Actualizar Orden' : 'Publicar Orden'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminación */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-10 text-center space-y-8 animate-in zoom-in-95">
            <div className="h-24 w-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border-4 border-red-100">
              <AlertCircle className="h-12 w-12" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">¿Eliminar Orden?</h3>
              <p className="text-base font-bold text-gray-400 mt-3 leading-relaxed">Esta acción es irreversible.</p>
            </div>
            <div className="flex flex-col gap-4">
              <button 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="w-full bg-red-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</> : 'Eliminar Permanente'}
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                disabled={isDeleting}
                className="w-full bg-gray-50 text-gray-400 py-5 rounded-2xl font-black text-xs uppercase disabled:opacity-30"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, color = "primary", dark = false }) {
  return (
    <div className={cn("flex items-center gap-3 border-b pb-4", dark ? "border-white/10" : "border-gray-100")}>
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
        color === 'primary'
          ? "bg-primary/10 text-primary"
          : color === 'blue'
            ? "bg-blue-100 text-blue-600"
            : color === 'emerald'
              ? "bg-emerald-100 text-emerald-600"
              : "bg-gray-100 text-gray-700"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <h4 className={cn("text-xs font-black uppercase tracking-widest", dark ? "text-white" : "text-gray-900")}>{title}</h4>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", dark = false, isSelect = false, options = [], readOnly = false }) {
  return (
    <div className="space-y-1.5">
      <label className={cn("text-[9px] font-black uppercase tracking-wider ml-1", dark ? "text-gray-500" : "text-gray-400")}>{label}</label>
      {isSelect ? (
        <select
          className={cn(
            "w-full px-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all shadow-sm",
            dark ? "bg-gray-800 border-gray-700 text-white focus:border-primary" : "bg-gray-50 focus:bg-white focus:border-primary"
          )}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input
          type={type}
          readOnly={readOnly}
          className={cn(
            "w-full px-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all shadow-sm",
            dark ? "bg-gray-800 border-gray-700 text-white focus:border-primary" : "bg-gray-50 focus:bg-white focus:border-primary"
          )}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}