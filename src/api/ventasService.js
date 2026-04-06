// ─── Ventas & CRM Service ─── localStorage persistence ───────────────────────

const KEYS = {
  bitacora: 'olea_ventas_bitacora',
  reporte:  'olea_ventas_reporte_diario',
  cartera:  'olea_ventas_cartera',
};

const initialBitacora = [
  { id:'BIT-001', ejecutivo:'Arturo', dia:'2024-11-24', empresaVisitada:'Empresa X',  potencial:true,  decisor:true,  nombre:'Pedro Gracia',      resultado:'Presentó portafolio de productos, visitarlo el 19 de feb' },
  { id:'BIT-002', ejecutivo:'Arturo', dia:'2024-11-24', empresaVisitada:'Empresa 2',  potencial:true,  decisor:true,  nombre:'Joquin Severiano',   resultado:'Me atendió porque no tenía tiempo, regresar lunes 23 de feb' },
];

const initialReporte = [
  { id:'REP-001', ejecutivo:'Carlos', semana:'2026-02-02', dia:'Lunes',   llamadas:12, efec:8,  visitas:4, correos:3, mensajes:5, decisorR:4, decisorFinal:1, cotizaciones:1, cierres:0, venta:0     },
  { id:'REP-002', ejecutivo:'Carlos', semana:'2026-02-02', dia:'Martes',  llamadas:13, efec:10, visitas:4, correos:5, mensajes:8, decisorR:2, decisorFinal:1, cotizaciones:0, cierres:1, venta:25000 },
];

const initialCartera = [
  { id:'CAR-001', empresa:'Printing World', mes:'2025-09', tipo:'Prospecto', fechaUltContacto:'2026-02-01', decisor:true, resultado:'Se interesó en CCV', proxContacto:'2026-02-18', motivo:'Para presentar servicios' },
];

function load(key, initial) {
  try {
    const s = localStorage.getItem(key);
    if (!s) { localStorage.setItem(key, JSON.stringify(initial)); return initial; }
    return JSON.parse(s);
  } catch { return initial; }
}
function persist(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function genId(p) { return `${p}-${Date.now().toString(36).toUpperCase()}`; }

// ── CRUD Bitácora ─────────────────────────────────────────────────────────────
export const getBitacora = () => load(KEYS.bitacora, initialBitacora);
export const saveBitacoraEntry = (e) => {
  const list = getBitacora();
  if (e.id) { const i = list.findIndex(x => x.id === e.id); i >= 0 ? (list[i] = e) : list.push(e); }
  else list.push({ ...e, id: genId('BIT') });
  persist(KEYS.bitacora, list); return list;
};
export const deleteBitacoraEntry = (id) => { const l = getBitacora().filter(e => e.id !== id); persist(KEYS.bitacora, l); return l; };

// ── CRUD Reporte ──────────────────────────────────────────────────────────────
export const getReporte = () => load(KEYS.reporte, initialReporte);
export const saveReporteEntry = (e) => {
  const list = getReporte();
  if (e.id) { const i = list.findIndex(x => x.id === e.id); i >= 0 ? (list[i] = e) : list.push(e); }
  else list.push({ ...e, id: genId('REP') });
  persist(KEYS.reporte, list); return list;
};
export const deleteReporteEntry = (id) => { const l = getReporte().filter(e => e.id !== id); persist(KEYS.reporte, l); return l; };

// ── CRUD Cartera ──────────────────────────────────────────────────────────────
export const getCartera = () => load(KEYS.cartera, initialCartera);
export const saveCarteraEntry = (e) => {
  const list = getCartera();
  if (e.id) { const i = list.findIndex(x => x.id === e.id); i >= 0 ? (list[i] = e) : list.push(e); }
  else list.push({ ...e, id: genId('CAR') });
  persist(KEYS.cartera, list); return list;
};
export const deleteCarteraEntry = (id) => { const l = getCartera().filter(e => e.id !== id); persist(KEYS.cartera, l); return l; };

// ═══════════════════════════════════════════════════════════════════════════════
// KPI CALCULATOR — extrae TODOS los indicadores posibles
// ═══════════════════════════════════════════════════════════════════════════════
export const calcKPIs = (bitacora, reporte, cartera) => {

  // ── Acumulados reporte ─────────────────────────────────────────────────────
  const totalLlamadas     = reporte.reduce((s,r) => s+(r.llamadas||0),     0);
  const totalEfec         = reporte.reduce((s,r) => s+(r.efec||0),         0);
  const totalVisitasRep   = reporte.reduce((s,r) => s+(r.visitas||0),      0);
  const totalCierres      = reporte.reduce((s,r) => s+(r.cierres||0),      0);
  const totalCotizaciones = reporte.reduce((s,r) => s+(r.cotizaciones||0), 0);
  const totalVenta        = reporte.reduce((s,r) => s+(r.venta||0),        0);
  const totalCorreos      = reporte.reduce((s,r) => s+(r.correos||0),      0);
  const totalMensajes     = reporte.reduce((s,r) => s+(r.mensajes||0),     0);
  const totalDecisorR     = reporte.reduce((s,r) => s+(r.decisorR||0),     0);
  const totalDecisorF     = reporte.reduce((s,r) => s+(r.decisorFinal||0), 0);
  const totalVisitas      = totalVisitasRep + bitacora.length;

  // ── KPIs derivados ─────────────────────────────────────────────────────────
  const eficiencia        = totalLlamadas      ? Math.round((totalEfec/totalLlamadas)*100)          : 0;
  const ticketPromedio    = totalCierres       ? Math.round(totalVenta/totalCierres)                : 0;
  const tasaCierre        = totalCotizaciones  ? Math.round((totalCierres/totalCotizaciones)*100)   : 0;
  const tasaContacto      = totalLlamadas      ? Math.round((totalDecisorF/totalLlamadas)*100)      : 0;
  const actividadTotal    = totalLlamadas + totalCorreos + totalMensajes + totalVisitas;
  const diasActivos       = reporte.filter(r => (r.llamadas||0)+(r.visitas||0) > 0).length;
  const promLlamadasDia   = diasActivos ? Math.round(totalLlamadas/diasActivos)  : 0;
  const promVisitasDia    = diasActivos ? +(totalVisitas/diasActivos).toFixed(1)  : 0;
  const promCotDia        = diasActivos ? +(totalCotizaciones/diasActivos).toFixed(2) : 0;
  const ventaEfec         = totalEfec ? Math.round(totalVenta/totalEfec)         : 0; // venta por llamada efectiva

  // ── Conversión por etapa del funnel (%) ────────────────────────────────────
  const convLlamadaEfec   = totalLlamadas      ? Math.round((totalEfec/totalLlamadas)*100)          : 0;
  const convEfecVisita    = totalEfec          ? Math.round((totalVisitasRep/totalEfec)*100)        : 0;
  const convVisitaDecisor = totalVisitasRep    ? Math.round((totalDecisorR/totalVisitasRep)*100)    : 0;
  const convDecisorCot    = totalDecisorF      ? Math.round((totalCotizaciones/totalDecisorF)*100)  : 0;
  const convCotCierre     = totalCotizaciones  ? Math.round((totalCierres/totalCotizaciones)*100)   : 0;

  // ── Bitácora ───────────────────────────────────────────────────────────────
  const conPotencial   = bitacora.filter(b => b.potencial).length;
  const sinPotencial   = bitacora.filter(b => !b.potencial).length;
  const conDecisor     = bitacora.filter(b => b.decisor).length;
  const sinDecisor     = bitacora.filter(b => !b.decisor).length;
  const tasaPotencial  = bitacora.length ? Math.round((conPotencial/bitacora.length)*100) : 0;
  const tasaDecisorBit = bitacora.length ? Math.round((conDecisor/bitacora.length)*100)   : 0;

  // ── Cartera ────────────────────────────────────────────────────────────────
  const prospectos        = cartera.filter(c => c.tipo==='Prospecto').length;
  const clientes          = cartera.filter(c => c.tipo==='Cliente').length;
  const carteraConDecisor = cartera.filter(c => c.decisor).length;
  const tasaDecCartera    = cartera.length ? Math.round((carteraConDecisor/cartera.length)*100) : 0;

  // ── Por ejecutivo ──────────────────────────────────────────────────────────
  const ejNames = [...new Set([...reporte.map(r=>r.ejecutivo),...bitacora.map(b=>b.ejecutivo)])].filter(Boolean);
  const porEjecutivo = ejNames.map(ej => {
    const rows = reporte.filter(r => r.ejecutivo === ej);
    const bits = bitacora.filter(b => b.ejecutivo === ej);
    const ll = rows.reduce((s,r)=>s+(r.llamadas||0),0);
    const ef = rows.reduce((s,r)=>s+(r.efec||0),0);
    const ci = rows.reduce((s,r)=>s+(r.cierres||0),0);
    const co = rows.reduce((s,r)=>s+(r.cotizaciones||0),0);
    const ve = rows.reduce((s,r)=>s+(r.venta||0),0);
    return {
      ejecutivo: ej,
      llamadas:     ll,
      efectivas:    ef,
      visitas:      rows.reduce((s,r)=>s+(r.visitas||0),0) + bits.length,
      correos:      rows.reduce((s,r)=>s+(r.correos||0),0),
      mensajes:     rows.reduce((s,r)=>s+(r.mensajes||0),0),
      decisorR:     rows.reduce((s,r)=>s+(r.decisorR||0),0),
      decisorF:     rows.reduce((s,r)=>s+(r.decisorFinal||0),0),
      cotizaciones: co,
      cierres:      ci,
      venta:        ve,
      eficiencia:   ll ? Math.round((ef/ll)*100)    : 0,
      tasaCierre:   co ? Math.round((ci/co)*100)    : 0,
      ticket:       ci ? Math.round(ve/ci)          : 0,
      potencial:    bits.filter(b=>b.potencial).length,
      decBit:       bits.filter(b=>b.decisor).length,
    };
  });

  // ── Por semana ─────────────────────────────────────────────────────────────
  const semanas = [...new Set(reporte.map(r=>r.semana))].filter(Boolean).sort();
  const porSemana = semanas.map(sem => {
    const rows = reporte.filter(r => r.semana === sem);
    return {
      semana:       sem.slice(5), // MM-DD
      llamadas:     rows.reduce((s,r)=>s+(r.llamadas||0),0),
      efectivas:    rows.reduce((s,r)=>s+(r.efec||0),0),
      visitas:      rows.reduce((s,r)=>s+(r.visitas||0),0),
      cierres:      rows.reduce((s,r)=>s+(r.cierres||0),0),
      cotizaciones: rows.reduce((s,r)=>s+(r.cotizaciones||0),0),
      venta:        rows.reduce((s,r)=>s+(r.venta||0),0),
    };
  });

  // ── Por día de semana (patrón) ─────────────────────────────────────────────
  const diasNombre = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const porDia = diasNombre.map(dia => {
    const rows = reporte.filter(r => r.dia === dia);
    return {
      dia: dia.slice(0,3),
      llamadas:  rows.reduce((s,r)=>s+(r.llamadas||0),0),
      efectivas: rows.reduce((s,r)=>s+(r.efec||0),0),
      visitas:   rows.reduce((s,r)=>s+(r.visitas||0),0),
      venta:     rows.reduce((s,r)=>s+(r.venta||0),0),
      cierres:   rows.reduce((s,r)=>s+(r.cierres||0),0),
    };
  }).filter(d => d.llamadas+d.visitas+d.venta > 0);

  return {
    // Acumulados
    totalLlamadas, totalEfec, totalVisitas, totalVisitasRep,
    totalCierres, totalCotizaciones, totalVenta,
    totalCorreos, totalMensajes, totalDecisorR, totalDecisorF,
    // Derivados
    eficiencia, ticketPromedio, tasaCierre, tasaContacto,
    actividadTotal, diasActivos, promLlamadasDia, promVisitasDia,
    promCotDia, ventaEfec,
    // Conversión funnel
    convLlamadaEfec, convEfecVisita, convVisitaDecisor, convDecisorCot, convCotCierre,
    // Bitácora
    conPotencial, sinPotencial, conDecisor, sinDecisor,
    tasaPotencial, tasaDecisorBit, totalBitacora: bitacora.length,
    // Cartera
    prospectos, clientes, carteraConDecisor, tasaDecCartera,
    totalCartera: cartera.length,
    // Agrupados
    porEjecutivo, porSemana, porDia,
  };
};
