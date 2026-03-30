'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Area, AreaChart,
} from 'recharts'
import { OrcamentoPrevisto, DadosRealizados, Categoria, OrcamentoSimulacao } from '@/types'
import { TrendingDown, TrendingUp, DollarSign, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { InsightsCards } from '@/components/dashboard/InsightsCards'
import { ComparativeTable } from '@/components/dashboard/ComparativeTable'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const BRL_SHORT = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`
  return BRL.format(v)
}
const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function buildTypeMap(cats: Categoria[], map: Map<string, 'RECEITA' | 'DESPESA'> = new Map()) {
  cats.forEach(c => {
    map.set(c.id, c.tipo)
    if (c.children) buildTypeMap(c.children, map)
  })
  return map
}

function getLeafIds(cats: Categoria[], leafIds: Set<string> = new Set()) {
  cats.forEach(c => {
    if (!c.children || c.children.length === 0) {
      leafIds.add(c.id)
    } else {
      getLeafIds(c.children, leafIds)
    }
  })
  return leafIds
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  categorias: Categoria[]
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
  simulacao: OrcamentoSimulacao
  filterInicio: { ano: number; mes: number }
  filterFim: { ano: number; mes: number }
  hideInsights?: boolean
  hideTable?: boolean
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function DashboardCharts({ 
  categorias, orcamentos, realizados, simulacao, filterInicio, filterFim,
  hideInsights = false,
  hideTable = false
}: Props) {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  const catTypeMap = useMemo(() => buildTypeMap(categorias), [categorias])
  const leafIds = useMemo(() => getLeafIds(categorias), [categorias])

  const chartData = useMemo(() => {
    const cols: { mes: number; ano: number }[] = []
    let curMes = filterInicio.mes
    let curAno = filterInicio.ano
    let guard = 0
    while ((curAno < filterFim.ano || (curAno === filterFim.ano && curMes <= filterFim.mes)) && guard < 60) {
      cols.push({ mes: curMes, ano: curAno })
      curMes++
      if (curMes > 12) { curMes = 1; curAno++ }
      guard++
    }

    return cols.map(({ mes, ano }) => {
      const label = `${NOMES_MESES[mes - 1]}/${String(ano).slice(-2)}`

      const prev_rec = orcamentos.filter(o => o.mes === mes && o.ano === ano && leafIds.has(o.categoria_id) && catTypeMap.get(o.categoria_id) === 'RECEITA').reduce((s, o) => s + Number(o.valor_previsto), 0)
      const prev_des = orcamentos.filter(o => o.mes === mes && o.ano === ano && leafIds.has(o.categoria_id) && catTypeMap.get(o.categoria_id) === 'DESPESA').reduce((s, o) => s + Number(o.valor_previsto), 0)
      const real_rec = realizados.filter(r => r.mes === mes && r.ano === ano && leafIds.has(r.categoria_id) && catTypeMap.get(r.categoria_id) === 'RECEITA').reduce((s, r) => s + Number(r.valor_realizado), 0)
      const real_des = realizados.filter(r => r.mes === mes && r.ano === ano && leafIds.has(r.categoria_id) && catTypeMap.get(r.categoria_id) === 'DESPESA').reduce((s, r) => s + Number(r.valor_realizado), 0)

      return {
        name: label,
        'Rec. Prevista': prev_rec,
        'Rec. Realizada': real_rec,
        'Des. Prevista': prev_des,
        'Des. Realizada': real_des,
        'Resultado Prev.': prev_rec - prev_des,
        'Resultado Real.': real_rec - real_des,
      }
    })
  }, [orcamentos, realizados, catTypeMap, filterInicio, filterFim])

  // KPI totals
  const totRecPrev = chartData.reduce((s, d) => s + d['Rec. Prevista'], 0)
  const totRecReal = chartData.reduce((s, d) => s + d['Rec. Realizada'], 0)
  const totDesPrev = chartData.reduce((s, d) => s + d['Des. Prevista'], 0)
  const totDesReal = chartData.reduce((s, d) => s + d['Des. Realizada'], 0)
  const resPrev = totRecPrev - totDesPrev
  const resReal = totRecReal - totDesReal
  const execucaoPct = totDesPrev > 0 ? (totDesReal / totDesPrev) * 100 : 0

  const tooltipStyle = { backgroundColor: '#171717', border: '1px solid #333', borderRadius: '12px', color: '#fff' }
  const tooltipFmt = (v: unknown) => BRL.format(Number(v) || 0)

  if (!isMounted) return <div className="min-h-[400px] w-full bg-white/5 border border-white/10 rounded-2xl animate-pulse" />

  return (
    <div className="space-y-6">

      {/* ── Sec 1: KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Receitas Previstas" 
          value={totRecPrev} 
          realValue={totRecReal}
          icon={<TrendingUp size={18} className="text-emerald-400" />} 
          color="emerald" 
          type="RECEITA"
        />
        <KPICard 
          title="Despesas Previstas" 
          value={totDesPrev} 
          realValue={totDesReal}
          icon={<TrendingDown size={18} className="text-red-400" />} 
          color="red" 
          type="DESPESA"
        />
        <KPICard 
          title="Resultado Projetado" 
          value={resPrev} 
          realValue={resReal}
          icon={<Activity size={18} className="text-indigo-400" />} 
          color="indigo" 
          type="RESULTADO"
        />
        <KPICard
          title="Execução Orçamentária"
          value={execucaoPct}
          isPercent
          success={execucaoPct <= 100}
          sub={execucaoPct > 100 ? 'Acima do orçamento' : 'Dentro do orçamento'}
          icon={<DollarSign size={18} className="text-blue-400" />}
          color="blue"
        />
      </div>

      {/* ── Sec 2: Gráficos Storytelling ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gráfico 1: Evolução Receitas */}
        <ChartCard title="Evolução de Receitas" subtitle="Previsto vs Realizado">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={BRL_SHORT} stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFmt} />
              <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="Rec. Prevista" stroke="#60a5fa" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              <Line type="monotone" dataKey="Rec. Realizada" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3, fill: '#34d399', stroke: '#171717', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Gráfico 2: Comportamento Despesas */}
        <ChartCard title="Comportamento das Despesas" subtitle="Previsto vs Realizado">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={BRL_SHORT} stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFmt} />
              <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="Des. Prevista" stroke="#a3a3a3" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              <Line type="monotone" dataKey="Des. Realizada" stroke="#f87171" strokeWidth={2.5} dot={{ r: 3, fill: '#f87171', stroke: '#171717', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Gráfico 3: Resultado Financeiro (largura total) */}
      <ChartCard title="Resultado Financeiro Mensal" subtitle="Saldo líquido projetado vs realizado">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="name" stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={BRL_SHORT} stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={tooltipFmt} />
            <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
            <Area type="monotone" dataKey="Resultado Prev." stroke="#818cf8" strokeWidth={2} strokeDasharray="5 3" fill="url(#gradPrev)" />
            <Area type="monotone" dataKey="Resultado Real." stroke="#34d399" strokeWidth={2.5} fill="url(#gradReal)" dot={{ r: 3, fill: '#34d399', stroke: '#171717', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Sec 3: Alertas Top 5 ────────────────────────────────────────────── */}
      {!hideInsights && <InsightsCards categorias={categorias} orcamentos={orcamentos} realizados={realizados} />}

      {/* ── Sec 4: Tabela Comparativa ────────────────────────────────────────── */}
      {!hideTable && (
        <ComparativeTable
          categorias={categorias}
          orcamentos={orcamentos}
          realizados={realizados}
          filterInicio={filterInicio}
          filterFim={filterFim}
        />
      )}

    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  title, value, realValue, sub, icon, success, isPercent = false, color, type
}: {
  title: string
  value: number
  realValue?: number
  sub?: string
  icon: React.ReactNode
  success?: boolean
  isPercent?: boolean
  color: 'emerald' | 'red' | 'indigo' | 'blue'
  type?: 'RECEITA' | 'DESPESA' | 'RESULTADO'
}) {
  const colorMap = {
    emerald: 'from-emerald-500/10',
    red: 'from-red-500/10',
    indigo: 'from-indigo-500/10',
    blue: 'from-blue-500/10',
  }

  const isPositiveReal = realValue !== undefined && realValue >= value
  const isNegativeReal = realValue !== undefined && realValue < value

  let variationPct = 0
  if (realValue !== undefined && value !== 0) {
    variationPct = Math.abs((realValue / value - 1) * 100)
  }

  // Logic for Arrows and Colors per the USER request
  let varColor = 'text-neutral-500'
  let ArrowIcon = null

  if (type === 'RECEITA') {
    if (realValue !== undefined) {
      const isGood = realValue >= value
      varColor = isGood ? 'text-emerald-400' : 'text-red-400'
      ArrowIcon = isGood ? TrendingUp : TrendingDown
    }
  } else if (type === 'DESPESA') {
    if (realValue !== undefined) {
      const isGood = realValue <= value
      varColor = isGood ? 'text-emerald-400' : 'text-red-400'
      ArrowIcon = realValue > value ? TrendingUp : TrendingDown
    }
  } else if (type === 'RESULTADO') {
     if (realValue !== undefined) {
        const isGood = realValue >= value
        varColor = isGood ? 'text-emerald-400' : 'text-red-400'
        ArrowIcon = isGood ? TrendingUp : TrendingDown
     }
  }

  const formatted = isPercent
    ? `${value.toFixed(1)}%`
    : BRL.format(value)

  const valueColor =
    success !== undefined 
      ? (success ? 'text-emerald-400' : 'text-red-400')
      : 'text-white'

  return (
    <div className={`bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden group bg-gradient-to-br ${colorMap[color]} to-transparent`}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{title}</p>
        <div className="p-2 bg-white/5 rounded-xl border border-white/5">{icon}</div>
      </div>
      <h4 className={`text-xl font-bold tracking-tight ${valueColor}`}>{formatted}</h4>
      
      {realValue !== undefined ? (
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-neutral-400">Real: {BRL.format(realValue)}</p>
          {type && ArrowIcon && (
            <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 ${varColor}`}>
              <ArrowIcon size={10} strokeWidth={3} />
              {variationPct.toFixed(1)}%
            </div>
          )}
        </div>
      ) : sub && (
        <p className="text-xs text-neutral-500 mt-1">{sub}</p>
      )}
    </div>
  )
}

// ─── Chart Card wrapper ────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </div>
  )
}
