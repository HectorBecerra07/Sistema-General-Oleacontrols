import React, { useState, useEffect } from 'react';
import {
  Trophy, Medal, Zap, Clock, CheckCircle2, Star, Target, Timer,
  Crown, Shield, Flame, Users, TrendingUp, ChevronUp, RefreshCw,
  User, Award, BarChart3, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

// ── Rank config ────────────────────────────────────────────────────────────────
const RANKS = {
  ELITE:    { label: 'Élite',    gradient: 'from-violet-500 to-purple-700', glow: 'shadow-violet-500/40', icon: Flame,  border: 'border-violet-300', text: 'text-violet-600', bg: 'bg-violet-50' },
  DIAMANTE: { label: 'Diamante', gradient: 'from-sky-400 to-indigo-600',    glow: 'shadow-sky-400/40',    icon: Crown,  border: 'border-sky-300',    text: 'text-sky-600',    bg: 'bg-sky-50' },
  ORO:      { label: 'Oro',      gradient: 'from-amber-400 to-yellow-600',  glow: 'shadow-amber-400/40',  icon: Trophy, border: 'border-amber-300',  text: 'text-amber-600',  bg: 'bg-amber-50' },
  PLATA:    { label: 'Plata',    gradient: 'from-slate-300 to-slate-500',   glow: 'shadow-slate-300/40',  icon: Medal,  border: 'border-slate-300',  text: 'text-slate-500',  bg: 'bg-slate-50' },
  BRONCE:   { label: 'Bronce',   gradient: 'from-orange-400 to-orange-700', glow: 'shadow-orange-400/40', icon: Medal,  border: 'border-orange-300', text: 'text-orange-600', bg: 'bg-orange-50' },
};

const PERIODS = [
  { id: 'month', label: 'Este Mes' },
  { id: 'year',  label: 'Este Año' },
  { id: 'all',   label: 'Histórico' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function RankBadge({ rank, size = 'sm' }) {
  const r = RANKS[rank] || RANKS.BRONCE;
  const Icon = r.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 font-black uppercase tracking-wider rounded-full text-white bg-gradient-to-r shadow-md',
      r.gradient,
      size === 'sm' ? 'text-[8px] px-2.5 py-1' : 'text-[10px] px-3 py-1.5'
    )}>
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {r.label}
    </span>
  );
}

function RankProgress({ rank, progress, nextRank, lifetimePoints, nextAt }) {
  const r = RANKS[rank] || RANKS.BRONCE;
  const n = nextRank ? RANKS[nextRank] : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
        <span className={r.text}>{r.label}</span>
        {n && <span className="text-gray-400">{n.label} en {(nextAt - lifetimePoints).toLocaleString()} pts</span>}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-1000', r.gradient)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Avatar({ src, name, size = 'md' }) {
  const s = { sm: 'h-10 w-10 text-sm', md: 'h-14 w-14 text-base', lg: 'h-20 w-20 text-xl', xl: 'h-28 w-28 text-3xl' }[size];
  return src
    ? <img src={src} className={cn(s, 'rounded-2xl object-cover')} alt={name} />
    : <div className={cn(s, 'rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary')}>
        {name?.charAt(0).toUpperCase()}
      </div>;
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={cn('bg-gray-100 animate-pulse rounded-xl', className)} />;
}

// ── Podium card ────────────────────────────────────────────────────────────────
function PodiumCard({ tech, place }) {
  const r = RANKS[tech.rank] || RANKS.BRONCE;
  const Icon = r.icon;
  const isFirst = place === 1;

  return (
    <div className={cn(
      'relative flex flex-col items-center text-center rounded-3xl border p-6 transition-all',
      isFirst
        ? 'bg-gray-900 border-gray-700 shadow-2xl shadow-gray-900/30 z-10 scale-105 md:scale-110'
        : 'bg-white border-gray-100 shadow-md'
    )}>
      {/* Position badge */}
      <div className={cn(
        'absolute -top-5 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full flex items-center justify-center font-black text-sm border-4 shadow-lg',
        isFirst
          ? 'bg-amber-400 text-gray-900 border-gray-900 animate-bounce'
          : place === 2 ? 'bg-slate-400 text-white border-white' : 'bg-orange-600 text-white border-white'
      )}>
        {isFirst ? <Crown className="h-5 w-5" /> : place}
      </div>

      {/* Avatar */}
      <div className={cn('mt-4 mb-3 rounded-2xl overflow-hidden border-4 shadow-lg',
        isFirst ? 'border-amber-400' : r.border
      )}>
        <Avatar src={tech.avatar} name={tech.name} size={isFirst ? 'lg' : 'md'} />
      </div>

      {/* Name */}
      <p className={cn('font-black leading-tight', isFirst ? 'text-white text-lg' : 'text-gray-900 text-sm')}>{tech.name}</p>
      <p className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', isFirst ? 'text-gray-400' : 'text-gray-400')}>
        {tech.position || 'Técnico'}
      </p>

      {/* Rank badge */}
      <div className="mt-2 mb-3">
        <RankBadge rank={tech.rank} size={isFirst ? 'md' : 'sm'} />
      </div>

      {/* Points */}
      <div className={cn('font-black leading-none', isFirst ? 'text-4xl text-white' : 'text-2xl text-gray-800')}>
        {tech.points.toLocaleString()}
      </div>
      <p className={cn('text-[8px] font-black uppercase tracking-widest mt-1', isFirst ? 'text-gray-500' : 'text-gray-400')}>
        puntos del período
      </p>

      {/* Mini stats */}
      <div className={cn('mt-4 grid grid-cols-3 gap-2 w-full text-center', isFirst ? 'border-t border-gray-700 pt-4' : 'border-t border-gray-50 pt-4')}>
        {[
          { label: 'OTs', value: tech.totalOTs },
          { label: 'Rating', value: tech.avgRating ? `${tech.avgRating}★` : '—' },
          { label: 'Lider', value: tech.leadOTs },
        ].map(s => (
          <div key={s.label}>
            <p className={cn('text-sm font-black', isFirst ? 'text-white' : 'text-gray-900')}>{s.value}</p>
            <p className={cn('text-[8px] font-black uppercase', isFirst ? 'text-gray-500' : 'text-gray-400')}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Row en tabla ───────────────────────────────────────────────────────────────
function LeaderRow({ tech, index, isMe }) {
  const r = RANKS[tech.rank] || RANKS.BRONCE;
  return (
    <tr className={cn('border-b border-gray-50 transition-colors', isMe ? 'bg-primary/5' : 'hover:bg-gray-50/50')}>
      {/* Posición */}
      <td className="px-5 py-4 w-12">
        <span className={cn(
          'flex items-center justify-center h-8 w-8 rounded-xl text-xs font-black',
          index < 3 ? 'bg-gray-900 text-white' : 'text-gray-300'
        )}>
          #{index + 1}
        </span>
      </td>

      {/* Técnico */}
      <td className="px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <Avatar src={tech.avatar} name={tech.name} size="sm" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-gray-900 leading-none">{tech.name}</p>
              {isMe && <span className="text-[8px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase">Tú</span>}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <RankBadge rank={tech.rank} />
              <RankProgress rank={tech.rank} progress={tech.rankProgress} nextRank={tech.nextRank}
                lifetimePoints={tech.lifetimePoints} nextAt={tech.nextAt} />
            </div>
          </div>
        </div>
      </td>

      {/* OTs */}
      <td className="px-4 py-4 text-center hidden md:table-cell">
        <div>
          <p className="text-sm font-black text-gray-900">{tech.totalOTs}</p>
          <p className="text-[8px] text-gray-400 font-bold uppercase">
            <span className="text-primary">{tech.leadOTs}L</span> · <span className="text-amber-500">{tech.supportOTs}A</span>
          </p>
        </div>
      </td>

      {/* Calificación */}
      <td className="px-4 py-4 text-center hidden lg:table-cell">
        {tech.avgRating ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span className="text-sm font-black text-gray-900">{tech.avgRating}</span>
            </div>
            <span className="text-[8px] text-gray-400 font-bold uppercase">{tech.evalCount} eval{tech.evalCount !== 1 ? 's' : ''}</span>
          </div>
        ) : <span className="text-gray-300 text-xs font-bold">—</span>}
      </td>

      {/* T. Reacción */}
      <td className="px-4 py-4 text-center hidden xl:table-cell">
        {tech.avgReaction ? (
          <div>
            <p className="text-sm font-black text-blue-600">{tech.avgReaction}m</p>
            <p className="text-[8px] text-gray-400 font-bold uppercase">Reacción</p>
          </div>
        ) : <span className="text-gray-300 text-xs">—</span>}
      </td>

      {/* T. Resolución */}
      <td className="px-4 py-4 text-center hidden xl:table-cell">
        {tech.avgResolution ? (
          <div>
            <p className="text-sm font-black text-indigo-600">{tech.avgResolution}h</p>
            <p className="text-[8px] text-gray-400 font-bold uppercase">Resolución</p>
          </div>
        ) : <span className="text-gray-300 text-xs">—</span>}
      </td>

      {/* Puntos */}
      <td className="px-5 py-4 text-right">
        <p className="text-lg font-black text-gray-900">{tech.points.toLocaleString()}</p>
        <p className="text-[8px] text-gray-400 font-bold uppercase flex items-center justify-end gap-1">
          <Zap className="h-2 w-2 fill-amber-400 text-amber-400" />
          {tech.lifetimePoints.toLocaleString()} total
        </p>
      </td>
    </tr>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function TechGamification() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  const load = async (p) => {
    setLoading(true);
    try {
      const res  = await apiFetch(`/api/gamification?period=${p}`);
      const data = await res.json();
      setLeaders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); }, [period]);

  const topThree = leaders.slice(0, 3);
  const rest     = leaders.slice(3);
  const podiumOrder = topThree.length === 3
    ? [topThree[1], topThree[0], topThree[2]]
    : topThree;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex p-4 bg-amber-50 rounded-3xl border border-amber-100 text-amber-500 shadow-sm mb-1">
          <Trophy className="h-9 w-9" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase italic">
          Arena de Líderes
        </h1>
        <p className="text-gray-400 font-bold uppercase tracking-[0.25em] text-[10px]">
          Métricas Reales · Técnicos Líder &amp; Apoyo · OleaControls
        </p>
      </div>

      {/* ── PERIOD SELECTOR ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              'px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all',
              period === p.id
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
            )}
          >
            {p.label}
          </button>
        ))}
        <button onClick={() => load(period)} className="p-2 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all">
          <RefreshCw className={cn('h-4 w-4 text-gray-400', loading && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Calculando puntuaciones…</p>
        </div>
      ) : leaders.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Sin datos para este período</p>
        </div>
      ) : (
        <>
          {/* ── REGLAS (sistema de puntos) ───────────────────────────── */}
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Sistema de Puntuación</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                { label: 'OT Urgente (Líder)',  pts: '200', sub: '130 de apoyo', color: 'text-red-500' },
                { label: 'OT Alta (Líder)',     pts: '150', sub: '97 de apoyo',  color: 'text-amber-500' },
                { label: 'OT Media (Líder)',    pts: '100', sub: '65 de apoyo',  color: 'text-blue-500' },
                { label: 'Calif. ≥ 4.5★',      pts: '+80', sub: 'bonus cliente',color: 'text-emerald-500' },
              ].map(r => (
                <div key={r.label} className="bg-white rounded-xl p-3 border border-gray-100">
                  <p className={cn('text-xl font-black', r.color)}>{r.pts}</p>
                  <p className="text-[9px] font-black text-gray-600 leading-tight mt-0.5">{r.label}</p>
                  <p className="text-[8px] text-gray-400 mt-0.5">{r.sub}</p>
                </div>
              ))}
            </div>
            <p className="text-[8px] text-gray-400 font-bold mt-3 text-center">
              + Bonus: Reacción &lt;30min (+50) · Resolución &lt;4h (+40) · OT Validada (+20)
            </p>
          </div>

          {/* ── PODIO ────────────────────────────────────────────────── */}
          {topThree.length > 0 && (
            <div className={cn(
              'grid gap-4 items-end pt-8',
              topThree.length === 3 ? 'grid-cols-3' : `grid-cols-${topThree.length}`
            )}>
              {podiumOrder.map((tech, i) => {
                const place = i === 0 ? 2 : i === 1 ? 1 : 3;
                return <PodiumCard key={tech.id} tech={tech} place={topThree.length === 3 ? place : i + 1} />;
              })}
            </div>
          )}

          {/* ── TABLA COMPLETA ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">Ranking Completo</h3>
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{leaders.length} técnicos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="px-5 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">#</th>
                    <th className="px-3 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Técnico</th>
                    <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center hidden md:table-cell">OTs</th>
                    <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center hidden lg:table-cell">Rating</th>
                    <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center hidden xl:table-cell">Reacción</th>
                    <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center hidden xl:table-cell">Resolución</th>
                    <th className="px-5 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((tech, i) => (
                    <LeaderRow key={tech.id} tech={tech} index={i} isMe={false} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── LEYENDA DE RANGOS ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(RANKS).reverse().map(([key, r]) => {
              const Icon = r.icon;
              const thresholds = { ELITE: '20,000', DIAMANTE: '10,000', ORO: '5,000', PLATA: '1,000', BRONCE: '0' };
              return (
                <div key={key} className={cn('rounded-2xl p-4 border text-center space-y-2', r.bg, r.border)}>
                  <div className={cn('inline-flex p-2 rounded-xl', r.bg)}>
                    <Icon className={cn('h-5 w-5', r.text)} />
                  </div>
                  <p className={cn('text-xs font-black', r.text)}>{r.label}</p>
                  <p className="text-[9px] text-gray-400 font-bold">{thresholds[key]}+ pts históricos</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
