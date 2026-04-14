'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, Scale, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { PrestacaoContasData } from '@/actions/prestacaoContas'

// ─── Formatters ──────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const BRL_SHORT = (v: number) => {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}R$${(abs / 1_000).toFixed(0)}k`
  return BRL.format(v)
}

const TOOLTIP_STYLE = {
  backgroundColor: '#171717',
  border: '1px solid #333',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '12px',
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  data: PrestacaoContasData
  ano: number
  condoNome: string | null
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PrestacaoContasView({ data, ano, condoNome }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  const {
    totalReceitas, mediaReceitas,
    totalDespesas, mediaDespesas,
    resultado, mediaResultado,
    saldoAnterior, saldoFinal,
    dadosMensais,
    receitasPorCategoria,
    despesasPorCategoria,
  } = data

  // Only show months with data for the charts
  const chartData = useMemo(
    () => dadosMensais.filter(d => d.receitas > 0 || d.despesas > 0),
    [dadosMensais],
  )

  function changeYear(delta: number) {
    const params = new URLSearchParams()
    params.set('ano', String(ano + delta))
    router.push(`${pathname}?${params.toString()}`)
  }

  if (!isMounted) {
    return (
      <div className="min-h-[400px] w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse" />
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Prestação de Contas
          </h1>
          {condoNome && (
            <p className="text-sm text-neutral-500 mt-0.5">{condoNome}</p>
          )}
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2">
          <button
            onClick={() => changeYear(-1)}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-neutral-500" />
          </button>
          <span className="text-sm font-semibold text-neutral-900 dark:text-white w-12 text-center">
            {ano}
          </span>
          <button
            onClick={() => changeYear(1)}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receitas"
          value={totalReceitas}
          sub={`Média: ${BRL.format(mediaReceitas)}`}
          icon={<TrendingUp size={18} className="text-sky-400" />}
          color="sky"
          positive
        />
        <KPICard
          title="Despesas"
          value={totalDespesas}
          sub={`Média: ${BRL.format(mediaDespesas)}`}
          icon={<TrendingDown size={18} className="text-red-400" />}
          color="red"
        />
        <KPICard
          title="Resultado"
          value={resultado}
          sub={`Média: ${BRL.format(mediaResultado)}`}
          icon={<Scale size={18} className="text-violet-400" />}
          color="violet"
          signed
        />
        <KPICard
          title="Saldo Final"
          value={saldoFinal}
          sub={`Saldo Anterior: ${BRL.format(saldoAnterior)}`}
          icon={<Wallet size={18} className="text-emerald-400" />}
          color="emerald"
          signed
        />
      </div>

      {/* ── Charts row 1: Linhas + Receitas por Categoria ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Linha: Receitas vs Despesas */}
        <ChartCard
          title="Receitas e Despesas"
          subtitle="Evolução mensal"
          className="lg:col-span-2"
        >
          {chartData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#737373"
                  tick={{ fill: '#737373', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={BRL_SHORT}
                  stroke="#737373"
                  tick={{ fill: '#737373', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown) => BRL.format(Number(v) || 0)}
                />
                <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="receitas"
                  name="Receitas"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#38bdf8', stroke: '#171717', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="despesas"
                  name="Despesas"
                  stroke="#f87171"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f87171', stroke: '#171717', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Barra Horizontal: Receitas por Categoria */}
        <ChartCard title="Receitas" subtitle="Por categoria">
          {receitasPorCategoria.length === 0 ? (
            <EmptyState />
          ) : (
            <HorizontalBarChart
              data={receitasPorCategoria}
              color="#38bdf8"
            />
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 2: Resultado + Despesas por Categoria ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Linha: Resultado mensal */}
        <ChartCard
          title="Resultado"
          subtitle="Saldo líquido mensal"
          className="lg:col-span-2"
        >
          {chartData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#737373"
                  tick={{ fill: '#737373', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={BRL_SHORT}
                  stroke="#737373"
                  tick={{ fill: '#737373', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown) => [BRL.format(Number(v) || 0), 'Resultado']}
                />
                <ReferenceLine y={0} stroke="#555" strokeDasharray="4 2" />
                <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.resultado >= 0 ? '#34d399' : '#f87171'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Barra Horizontal: Despesas por Categoria */}
        <ChartCard title="Despesas" subtitle="Por categoria">
          {despesasPorCategoria.length === 0 ? (
            <EmptyState />
          ) : (
            <HorizontalBarChart
              data={despesasPorCategoria}
              color="#f87171"
            />
          )}
        </ChartCard>
      </div>

    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  sky:     'from-sky-500/10',
  red:     'from-red-500/10',
  violet:  'from-violet-500/10',
  emerald: 'from-emerald-500/10',
}

function KPICard({
  title, value, sub, icon, color, positive = false, signed = false,
}: {
  title: string
  value: number
  sub?: string
  icon: React.ReactNode
  color: keyof typeof COLOR_MAP
  positive?: boolean
  signed?: boolean
}) {
  const isNegative = value < 0
  const valueColor = signed
    ? (isNegative ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')
    : 'text-neutral-900 dark:text-white'

  return (
    <div
      className={`bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-5 relative overflow-hidden bg-gradient-to-br ${COLOR_MAP[color]} to-transparent`}
    >
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
          {title}
        </p>
        <div className="p-2 bg-white/60 dark:bg-white/5 rounded-xl border border-white/5">
          {icon}
        </div>
      </div>
      <h4 className={`text-xl font-bold tracking-tight ${valueColor}`}>
        {BRL.format(value)}
      </h4>
      {sub && (
        <p className="text-xs text-neutral-500 mt-1">{sub}</p>
      )}
    </div>
  )
}

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({
  title, subtitle, children, className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </div>
  )
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
function HorizontalBarChart({
  data, color,
}: {
  data: { nome: string; valor: number }[]
  color: string
}) {
  const max = data[0]?.valor || 1
  const shown = data.slice(0, 8)

  return (
    <div className="h-full flex flex-col justify-center gap-2 overflow-y-auto pr-1">
      {shown.map((item) => {
        const pct = (item.valor / max) * 100
        const shortNome = item.nome.length > 28 ? item.nome.slice(0, 26) + '…' : item.nome
        return (
          <div key={item.nome} className="group">
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate" title={item.nome}>
                {shortNome}
              </span>
              <span className="text-[11px] font-semibold text-neutral-900 dark:text-white ml-2 shrink-0">
                {BRL_SHORT(item.valor)}
              </span>
            </div>
            <div className="h-2 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-neutral-400">Sem dados para o período selecionado</p>
    </div>
  )
}
