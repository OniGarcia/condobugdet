'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'
import { Categoria, OrcamentoPrevisto, DadosRealizados, FluxoProjetado, OrcamentoSimulacao } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const BRL_SHORT = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`
  return BRL.format(v)
}
const MESES_NOME = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function isPast(ano: number, mes: number, cutoffAno: number, cutoffMes: number) {
  return ano < cutoffAno || (ano === cutoffAno && mes <= cutoffMes)
}

function buildTypeMap(cats: Categoria[], map = new Map<string, 'RECEITA' | 'DESPESA'>()) {
  cats.forEach(c => {
    map.set(c.id, c.tipo)
    if (c.children) buildTypeMap(c.children, map)
  })
  return map
}

function getLeafIds(cats: Categoria[], ids = new Set<string>()) {
  cats.forEach(c => {
    if (!c.children || c.children.length === 0) ids.add(c.id)
    else getLeafIds(c.children, ids)
  })
  return ids
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  categorias: Categoria[]
  simulacao: OrcamentoSimulacao
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
  projetados: FluxoProjetado[]
  cutoffAno: number
  cutoffMes: number
}

type ChartMode = 'receitas' | 'despesas' | 'resultado'

// ─── Main Component ───────────────────────────────────────────────────────────
export function ForecastCharts({
  categorias,
  simulacao,
  orcamentos,
  realizados,
  projetados,
  cutoffAno,
  cutoffMes,
}: Props) {
  const [isMounted, setIsMounted] = useState(false)
  const [chartMode, setChartMode] = useState<ChartMode>('resultado')
  useEffect(() => setIsMounted(true), [])

  const catTypeMap = useMemo(() => buildTypeMap(categorias), [categorias])
  const leafIds = useMemo(() => getLeafIds(categorias), [categorias])

  // Build projetado lookup
  const projetadoMap = useMemo(() => {
    const map: Record<string, number> = {}
    projetados.forEach(p => { map[`${p.categoria_id}_${p.ano}_${p.mes}`] = Number(p.valor_projetado) })
    return map
  }, [projetados])

  // Period months
  const periodMonths = useMemo(() => {
    const months: { ano: number; mes: number }[] = []
    let cur = { ano: simulacao.ano_inicio, mes: simulacao.mes_inicio }
    let guard = 0
    while ((cur.ano < simulacao.ano_fim || (cur.ano === simulacao.ano_fim && cur.mes <= simulacao.mes_fim)) && guard < 60) {
      months.push({ ...cur })
      cur = { ...cur, mes: cur.mes + 1 }
      if (cur.mes > 12) { cur.mes = 1; cur.ano++ }
      guard++
    }
    return months
  }, [simulacao])

  // Build chart data
  const chartData = useMemo(() => {
    let accOrcRec = 0, accOrcDes = 0, accRealRec = 0, accRealDes = 0, accProjRec = 0, accProjDes = 0

    return periodMonths.map(({ ano, mes }) => {
      const past = isPast(ano, mes, cutoffAno, cutoffMes)
      const label = `${MESES_NOME[mes - 1]}/${String(ano).slice(-2)}`

      let orcRec = 0, orcDes = 0, realRec = 0, realDes = 0, projRec = 0, projDes = 0

      orcamentos.filter(o => o.mes === mes && o.ano === ano && leafIds.has(o.categoria_id)).forEach(o => {
        if (catTypeMap.get(o.categoria_id) === 'RECEITA') orcRec += Number(o.valor_previsto)
        else orcDes += Number(o.valor_previsto)
      })

      if (past) {
        realizados.filter(r => r.mes === mes && r.ano === ano && leafIds.has(r.categoria_id)).forEach(r => {
          if (catTypeMap.get(r.categoria_id) === 'RECEITA') realRec += Number(r.valor_realizado)
          else realDes += Number(r.valor_realizado)
        })
        projRec = realRec
        projDes = realDes
      } else {
        // Future: use projetados if available, fallback to orcados
        orcamentos.filter(o => o.mes === mes && o.ano === ano && leafIds.has(o.categoria_id)).forEach(o => {
          const savedVal = projetadoMap[`${o.categoria_id}_${o.ano}_${o.mes}`]
          const val = savedVal !== undefined ? savedVal : Number(o.valor_previsto)
          if (catTypeMap.get(o.categoria_id) === 'RECEITA') projRec += val
          else projDes += val
        })
      }

      accOrcRec += orcRec; accOrcDes += orcDes
      accRealRec += realRec; accRealDes += realDes
      accProjRec += projRec; accProjDes += projDes

      return {
        name: label,
        isFuture: !past,
        orcRec, orcDes, realRec, realDes, projRec, projDes,
        orcRes: orcRec - orcDes,
        realRes: realRec - realDes,
        projRes: projRec - projDes,
        // Acumulados
        accOrcRec, accOrcDes,
        accRealRec, accRealDes,
        accProjRec, accProjDes,
        accOrcRes: accOrcRec - accOrcDes,
        accRealRes: accRealRec - accRealDes,
        accProjRes: accProjRec - accProjDes,
      }
    })
  }, [periodMonths, orcamentos, realizados, projetadoMap, catTypeMap, leafIds, cutoffAno, cutoffMes])

  // KPI values — YTD (past only)
  const ytdData = chartData.filter(d => !d.isFuture)
  const totOrcRecYTD = ytdData.reduce((s, d) => s + d.orcRec, 0)
  const totOrcDesYTD = ytdData.reduce((s, d) => s + d.orcDes, 0)
  const totRealRecYTD = ytdData.reduce((s, d) => s + d.realRec, 0)
  const totRealDesYTD = ytdData.reduce((s, d) => s + d.realDes, 0)
  const variacaoYTD = totOrcRecYTD + totOrcDesYTD > 0
    ? ((totRealRecYTD - totRealDesYTD) - (totOrcRecYTD - totOrcDesYTD)) / Math.abs(totOrcRecYTD - totOrcDesYTD) * 100
    : 0
  const execPct = totOrcDesYTD > 0 ? (totRealDesYTD / totOrcDesYTD) * 100 : 0

  // Full period projected result
  const lastPoint = chartData[chartData.length - 1]
  const resultadoProjetado = lastPoint?.accProjRes ?? 0
  const resultadoOrcado = lastPoint?.accOrcRes ?? 0
  const variacaoAbs = resultadoProjetado - resultadoOrcado

  const tooltipStyle = { backgroundColor: '#171717', border: '1px solid #333', borderRadius: '12px', color: '#fff' }
  const tooltipFmt = (v: unknown) => BRL.format(Number(v) || 0)

  if (!isMounted) return (
    <div className="min-h-[400px] w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse" />
  )

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Variação vs Orçado (YTD)"
          value={`${variacaoYTD >= 0 ? '+' : ''}${variacaoYTD.toFixed(1)}%`}
          sub={variacaoYTD >= 0 ? 'Acima do orçado' : 'Abaixo do orçado'}
          positive={variacaoYTD >= 0}
          icon={variacaoYTD >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          color="sky"
        />
        <KPICard
          title="Resultado Projetado"
          value={BRL.format(resultadoProjetado)}
          sub={`Orçado: ${BRL.format(resultadoOrcado)}`}
          positive={resultadoProjetado >= 0}
          icon={<Activity className="w-5 h-5" />}
          color="violet"
        />
        <KPICard
          title={variacaoAbs >= 0 ? 'Superávit Projetado' : 'Déficit Projetado'}
          value={BRL.format(Math.abs(variacaoAbs))}
          sub={variacaoAbs >= 0 ? 'vs Orçado' : 'vs Orçado'}
          positive={variacaoAbs >= 0}
          icon={variacaoAbs >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          color={variacaoAbs >= 0 ? 'emerald' : 'red'}
        />
        <KPICard
          title="Execução Orçamentária"
          value={`${execPct.toFixed(1)}%`}
          sub={execPct > 100 ? 'Acima do orçamento' : 'Dentro do orçamento'}
          positive={execPct <= 100}
          icon={<DollarSign className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* ── Chart 1: Curva Acumulada ────────────────────────────────────────── */}
      <ChartCard title="Curva Acumulada" subtitle="Orçado · Realizado · Projetado">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="name" stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={BRL_SHORT} stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={tooltipFmt} />
            <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
            <Line type="monotone" dataKey="accOrcRes" name="Orçado Acum." stroke="#a3a3a3" strokeWidth={2} strokeDasharray="5 3" dot={false} />
            <Line type="monotone" dataKey="accRealRes" name="Realizado Acum." stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3, fill: '#60a5fa', stroke: '#171717', strokeWidth: 2 }} />
            <Line type="monotone" dataKey="accProjRes" name="Projetado Acum." stroke="#34d399" strokeWidth={2.5} strokeDasharray="4 2" dot={{ r: 3, fill: '#34d399', stroke: '#171717', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Chart 2: Mensal com Toggle ──────────────────────────────────────── */}
      <ChartCard
        title="Comparativo Mensal"
        subtitle="Orçado · Realizado · Projetado"
        headerRight={
          <div className="flex bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-1 gap-1">
            {(['receitas', 'despesas', 'resultado'] as ChartMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${
                  chartMode === mode
                    ? 'bg-sky-800 text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="name" stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={BRL_SHORT} stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={tooltipFmt} />
            <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
            {chartMode === 'receitas' && <>
              <Bar dataKey="orcRec" name="Orçado" fill="#a3a3a3" opacity={0.6} radius={[4, 4, 0, 0]} />
              <Bar dataKey="realRec" name="Realizado" fill="#60a5fa" opacity={0.85} radius={[4, 4, 0, 0]} />
              <Bar dataKey="projRec" name="Projetado" fill="#34d399" opacity={0.85} radius={[4, 4, 0, 0]} />
            </>}
            {chartMode === 'despesas' && <>
              <Bar dataKey="orcDes" name="Orçado" fill="#a3a3a3" opacity={0.6} radius={[4, 4, 0, 0]} />
              <Bar dataKey="realDes" name="Realizado" fill="#f87171" opacity={0.85} radius={[4, 4, 0, 0]} />
              <Bar dataKey="projDes" name="Projetado" fill="#fb923c" opacity={0.85} radius={[4, 4, 0, 0]} />
            </>}
            {chartMode === 'resultado' && <>
              <Bar dataKey="orcRes" name="Orçado" fill="#a3a3a3" opacity={0.6} radius={[4, 4, 0, 0]} />
              <Bar dataKey="realRes" name="Realizado" fill="#818cf8" opacity={0.85} radius={[4, 4, 0, 0]} />
              <Bar dataKey="projRes" name="Projetado" fill="#34d399" opacity={0.85} radius={[4, 4, 0, 0]} />
            </>}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
  sky: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20',
  violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
  emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
}

function KPICard({
  title, value, sub, positive, icon, color,
}: {
  title: string
  value: string
  sub?: string
  positive?: boolean
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{title}</span>
        <span className={`p-2 rounded-xl ${colorMap[color] ?? colorMap.sky}`}>{icon}</span>
      </div>
      <div>
        <p className={`text-xl font-bold ${positive === undefined ? 'text-neutral-900 dark:text-white' : positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({
  title, subtitle, children, headerRight,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  headerRight?: React.ReactNode
}) {
  return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      <div className="h-64">{children}</div>
    </div>
  )
}
