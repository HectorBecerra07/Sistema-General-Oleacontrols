/**
 * Script de importación: productos_y_precios_extraidos.xlsx → tabla Product
 * Ejecutar: node scripts/import-products.js
 */

import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Auto-categorización por palabras clave ─────────────────────────────────
function categorize(name) {
  const n = name.toLowerCase();

  if (/c[aá]mara|camara|domo|bala|dvr|nvr|grabador|cctv|vigilancia|lente|ip cam|turbo|hd cam/.test(n))
    return { category: 'CCTV', subcategory: 'Cámaras y Grabadores' };

  if (/incendio|humo|sirena|detector|estrobo|panel.*incen|notifier|firelite|fire-lite|evacuac|panel.*fuego|sensor.*humo|bocina.*incen|modulo.*fc|frm|fcm|batería.*12v|ups.*va|bateria.*ah/.test(n))
    return { category: 'Detección de Incendios', subcategory: 'Equipos contra incendio' };

  if (/lector|biom[eé]trico|torniquete|pluma.*vehic|barrera|tarjeta.*mifare|mifare|tarjeta.*rfid|rfid|huella|acceso.*peat|control.*acceso|puerta.*corred|chapa|boton.*sal|kit.*acceso|llave.*wifi|came\b|faac|palanca/.test(n))
    return { category: 'Control de Acceso', subcategory: 'Acceso vehicular y peatonal' };

  if (/interfon|interf[oó]n|bticino|videoportero|timbre|llamada|elevador.*interfon|interfon.*elev/.test(n))
    return { category: 'Interfonía', subcategory: 'Sistemas de Interfonía' };

  if (/switch|access.?point|wifi|router|utp|cat.?6|patch|voz.*dato|dato.*voz|red.*wifi|wifi.*red|jumper|sfp|antena|amplif.*red/.test(n))
    return { category: 'Redes / Voz y Datos', subcategory: 'Networking' };

  if (/cable.*hdmi|hdmi/.test(n))
    return { category: 'Redes / Voz y Datos', subcategory: 'Cableado' };

  if (/bocina|amplificador|audio|sonido|parlante|megáfono|megafono/.test(n))
    return { category: 'Sonido Ambiental', subcategory: 'Audio' };

  if (/cable.*utp|cable.*incendio|cable.*pot|cable.*thw|cable.*2x|cable.*awg|bobina.*cable|rollo.*cable|guia.*acero|guia galvan|cable.*bocina|tuberia|tubría|codo/.test(n))
    return { category: 'Materiales', subcategory: 'Cableado y Tubería' };

  if (/guantes|gafas|botas|casco|rotulo.*casco|epp|protector/.test(n))
    return { category: 'EPP', subcategory: 'Equipo de protección' };

  if (/herramienta|pinzas|broca|cincel|multimetro|puntas.*multimetro|soldadura|escalera|balero|tornillo/.test(n))
    return { category: 'Herramientas', subcategory: 'Herramientas' };

  if (/visita|mtto|mantenimiento|mant\.|poliza|póliza|mmto|semestral|mensual|anual.*mmto/.test(n))
    return { category: 'Servicios', subcategory: 'Mantenimiento' };

  if (/instalaci[oó]n|configuraci[oó]n|puesta.*marcha|programaci[oó]n|capacitaci[oó]n|integraci[oó]n/.test(n))
    return { category: 'Servicios', subcategory: 'Instalación y puesta en marcha' };

  if (/proyecto.*ejecutivo|proyecto.*sist|ajuste.*ingenier/.test(n))
    return { category: 'Servicios', subcategory: 'Proyectos Ejecutivos' };

  if (/gabinete|fuente|relevador|sensor.*gas|centralita|modulo|ups\b|batería|bateria/.test(n))
    return { category: 'Electrónica / Accesorios', subcategory: 'Fuentes y módulos' };

  if (/laptop|pc|desktop|computadora|disco.*duro|ssd/.test(n))
    return { category: 'Cómputo', subcategory: 'Equipos de cómputo' };

  if (/tira.*led|led.*rgb|iluminaci/.test(n))
    return { category: 'Iluminación', subcategory: 'LED' };

  if (/cerca.*electrica|cerca eléctrica/.test(n))
    return { category: 'Perímetro', subcategory: 'Cerca Eléctrica' };

  return { category: 'General', subcategory: null };
}

// ── Detectar marca por nombre ──────────────────────────────────────────────
function detectBrand(name) {
  const n = name.toLowerCase();
  if (/hikvision|hik-connect|hik-ia/.test(n))  return 'Hikvision';
  if (/dahua/.test(n))                           return 'Dahua';
  if (/bticino/.test(n))                         return 'Bticino';
  if (/faac/.test(n))                            return 'FAAC';
  if (/came\b/.test(n))                          return 'CAME';
  if (/notifier/.test(n))                        return 'Notifier';
  if (/firelite|fire-lite/.test(n))              return 'FireLite';
  if (/kidde/.test(n))                           return 'Kidde';
  if (/zkteco/.test(n))                          return 'ZKTeco';
  if (/ubiquiti|unifi/.test(n))                  return 'Ubiquiti';
  if (/eero/.test(n))                            return 'Eero';
  if (/dell/.test(n))                            return 'Dell';
  if (/hp\b/.test(n))                            return 'HP';
  if (/honeywell/.test(n))                       return 'Honeywell';
  if (/first.?alert/.test(n))                    return 'First Alert';
  return null;
}

// ── Generar SKU único ──────────────────────────────────────────────────────
function generateSku(name, index, usedSkus) {
  // Tomar primeras 3-5 letras significativas del nombre
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const prefix = words.slice(0, 2).map(w => w.substring(0, 3)).join('-');
  const base   = (prefix || 'PROD').substring(0, 8);
  const num    = String(index + 1).padStart(4, '0');
  let sku      = `${base}-${num}`;

  // Garantizar unicidad
  let attempts = 0;
  while (usedSkus.has(sku)) {
    attempts++;
    sku = `${base}-${num}${String.fromCharCode(64 + attempts)}`;
  }
  usedSkus.add(sku);
  return sku;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const filePath = path.join(__dirname, '../public/productos_y_precios_extraidos.xlsx');
  const wb  = XLSX.readFile(filePath);
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Saltar encabezado, filtrar filas vacías
  const rows = raw.slice(1).filter(r => r[0] && String(r[0]).trim().length > 1);

  console.log(`📦 ${rows.length} productos encontrados en Excel`);

  const usedSkus = new Set();

  // Obtener SKUs existentes en BD para no duplicar
  const existing = await prisma.product.findMany({ select: { sku: true } });
  existing.forEach(p => usedSkus.add(p.sku));

  let created = 0, skipped = 0, errors = [];

  for (let i = 0; i < rows.length; i++) {
    const [rawName, rawPrice] = rows[i];
    const name  = String(rawName).trim();
    const price = rawPrice !== undefined && rawPrice !== null && rawPrice !== '' ? parseFloat(rawPrice) : 0;

    if (!name || name.length < 2) { skipped++; continue; }

    const { category, subcategory } = categorize(name);
    const brand = detectBrand(name);
    const sku   = generateSku(name, i, usedSkus);

    // Determinar unidad por categoría/nombre
    let unit = 'PZA';
    const nl = name.toLowerCase();
    if (/cable|bobina|rollo|guia.*acero|mts|100m|305m|tuberia/.test(nl)) unit = 'MTS';
    if (/kit\b/.test(nl)) unit = 'KIT';
    if (/poliza|mantenimiento|mtto|visita|instalaci|configur|proyecto|servicio|puesta|programaci|capacitaci/.test(nl)) unit = 'SRV';
    if (/kilo\b/.test(nl)) unit = 'KG';
    if (/par\b/.test(nl)) unit = 'PAR';

    try {
      await prisma.product.create({
        data: {
          sku,
          name,
          brand,
          category,
          subcategory,
          description: null,
          unit,
          price,
          currency: 'MXN',
          status: 'ACTIVE',
        }
      });
      created++;
      process.stdout.write(`\r  ✓ ${created}/${rows.length} importados...`);
    } catch (e) {
      errors.push(`[${sku}] ${name.substring(0, 40)}: ${e.message}`);
    }
  }

  console.log(`\n\n✅ Importación completada:`);
  console.log(`   Creados  : ${created}`);
  console.log(`   Saltados : ${skipped}`);
  console.log(`   Errores  : ${errors.length}`);
  if (errors.length) errors.forEach(e => console.log('   ⚠', e));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
