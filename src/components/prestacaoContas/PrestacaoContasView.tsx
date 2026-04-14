'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from 'recharts'
import { TrendingUp, TrendingDown, Scale, Search, X } from 'lucide-react'
import type { PrestacaoContasData } from '@/actions/prestacaoContas'
import { NOMES_MESES } from '@/lib/meses'

// ─── Formatters ───────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const BRL_SHORT = (v: number) => {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}k`
  return `${sign}${abs.toFixed(0)}`
}

// ─── Custom chart labels ──────────────────────────────────────────────────────
function LineLabel({ x, y, value, position = 'top' }: { x?: number; y?: number; value?: number; position?: 'top' | 'bottom' }) {
  if (!value) return null
  const dy = position === 'top' ? -14 : 22
  return (
    <text x={x} y={(y ?? 0) + dy} fill="#a3a3a3" fontSize={10} textAnchor="middle">
      {BRL_SHORT(value)}
    </text>
  )
}

function BarLabel({ x, y, width, value }: { x?: number; y?: number; width?: number; value?: number }) {
  if (value === undefined || value === null || value === 0) return null
  const isPos = value >= 0
  return (
    <text
      x={(x ?? 0) + (width ?? 0) / 2}
      y={(y ?? 0) + (isPos ? -5 : 14)}
      fill="#a3a3a3"
      fontSize={10}
      textAnchor="middle"
    >
      {BRL_SHORT(value)}
    </text>
  )
}

const TOOLTIP_STYLE = {
  backgroundColor: '#171717',
  border: '1px solid #333',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '12px',
}

const ANOS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)

// ─── Types ────────────────────────────────────────────────────────────────────
interface Periodo { ano: number; mes: number }

interface ActiveFilter {
  nome: string
  tipo: 'RECEITA' | 'DESPESA'
}

interface Props {
  data: PrestacaoContasData
  inicio: Periodo
  fim: Periodo
  condoNome: string | null
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PrestacaoContasView({ data, inicio, fim, condoNome }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  const [draftInicio, setDraftInicio] = useState(inicio)
  const [draftFim,    setDraftFim]    = useState(fim)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null)

  const {
    totalReceitas, mediaReceitas,
    totalDespesas, mediaDespesas,
    resultado, mediaResultado,
    dadosMensais,
    receitasPorCategoria,
    despesasPorCategoria,
  } = data

  // Base chart data (months with any movement)
  const chartData = useMemo(
    () => dadosMensais.filter(d => d.receitas > 0 || d.despesas > 0),
    [dadosMensais],
  )

  // When a category filter is active, use that category's monthly breakdown
  const filteredChartData = useMemo(() => {
    if (!activeFilter) return chartData
    const cats = activeFilter.tipo === 'RECEITA' ? receitasPorCategoria : despesasPorCategoria
    const cat = cats.find(c => c.nome === activeFilter.nome)
    if (!cat) return chartData
    // Keep all months so the x-axis stays consistent; filter to those with data
    return cat.dadosMensais.filter(d => d.receitas > 0 || d.despesas > 0)
  }, [activeFilter, chartData, receitasPorCategoria, despesasPorCategoria])

  function handleCategoryClick(nome: string, tipo: 'RECEITA' | 'DESPESA') {
    setActiveFilter(prev =>
      prev?.nome === nome && prev?.tipo === tipo ? null : { nome, tipo }
    )
  }

  function clearFilter() { setActiveFilter(null) }

  function applyPeriod() {
    const startKey = draftInicio.ano * 100 + draftInicio.mes
    const endKey   = draftFim.ano   * 100 + draftFim.mes
    if (startKey > endKey) return
    setActiveFilter(null)
    const params = new URLSearchParams()
    params.set('inicio', `${draftInicio.ano}-${String(draftInicio.mes).padStart(2, '0')}`)
    params.set('fim',    `${draftFim.ano}-${String(draftFim.mes).padStart(2, '0')}`)
    router.push(`${pathname}?${params.toString()}`)
  }

  const periodoLabel =
    `${NOMES_MESES[inicio.mes - 1]}/${inicio.ano} – ${NOMES_MESES[fim.mes - 1]}/${fim.ano}`

  const draftStartKey = draftInicio.ano * 100 + draftInicio.mes
  const draftEndKey   = draftFim.ano   * 100 + draftFim.mes
  const periodInvalid = draftStartKey > draftEndKey

  // Line chart subtitle: show filter badge or default
  const lineChartSubtitle = activeFilter
    ? activeFilter.nome
    : 'Evolução mensal'

  if (!isMounted) {
    return <div className="min-h-[400px] w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl animate-pulse" />
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Demonstrativo de Resultado - Geral
          </h1>
          {condoNome && (
            <p className="text-sm text-neutral-500 mt-0.5">{condoNome}</p>
          )}
          <p className="text-xs text-neutral-400 mt-1">Período: {periodoLabel}</p>
        </div>

        {/* Period picker */}
        <div className="flex flex-wrap items-end gap-3 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-4 py-3">
          <PeriodPicker
            label="De"
            mes={draftInicio.mes}
            ano={draftInicio.ano}
            onChangeMes={m => setDraftInicio(p => ({ ...p, mes: m }))}
            onChangeAno={a => setDraftInicio(p => ({ ...p, ano: a }))}
          />

          <span className="text-neutral-400 text-sm pb-1">até</span>

          <PeriodPicker
            label="Até"
            mes={draftFim.mes}
            ano={draftFim.ano}
            onChangeMes={m => setDraftFim(p => ({ ...p, mes: m }))}
            onChangeAno={a => setDraftFim(p => ({ ...p, ano: a }))}
          />

          <button
            type="button"
            onClick={applyPeriod}
            disabled={periodInvalid}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            <Search size={14} />
            Consultar
          </button>

          {periodInvalid && (
            <p className="w-full text-xs text-red-400">
              O início deve ser anterior ao fim.
            </p>
          )}
        </div>
      </div>

      {/* ── Active filter badge ─────────────────────────────────────────────── */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Filtro ativo:</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            activeFilter.tipo === 'RECEITA'
              ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/20 dark:text-sky-300'
              : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300'
          }`}>
            {activeFilter.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}: {activeFilter.nome}
            <button type="button" onClick={clearFilter} title="Limpar filtro" aria-label="Limpar filtro" className="hover:opacity-70 transition-opacity">
              <X size={12} />
            </button>
          </span>
          <span className="text-xs text-neutral-400">— clique novamente na categoria para remover</span>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Receitas"
          value={totalReceitas}
          sub={`Média: ${BRL.format(mediaReceitas)}`}
          icon={<TrendingUp size={18} className="text-sky-400" />}
          color="sky"
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
      </div>

      {/* ── Charts row 1: Linhas + Receitas por Categoria ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Receitas e Despesas"
          subtitle={lineChartSubtitle}
          filterActive={!!activeFilter}
          onClearFilter={clearFilter}
          className="lg:col-span-2"
        >
          {filteredChartData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredChartData} margin={{ top: 32, right: 24, left: 24, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="label" stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} padding={{ left: 24, right: 24 }} />
                <YAxis hide />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => BRL.format(Number(v) || 0)} />
                <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
                {/* Hide the despesas line when filtering by receita (it'll be all zeros) */}
                {(!activeFilter || activeFilter.tipo === 'RECEITA') && (
                  <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: '#38bdf8', stroke: '#171717', strokeWidth: 2 }}>
                    <LabelList dataKey="receitas" content={(props: any) => <LineLabel {...props} position="top" />} />
                  </Line>
                )}
                {(!activeFilter || activeFilter.tipo === 'DESPESA') && (
                  <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#f87171" strokeWidth={2.5} dot={{ r: 3, fill: '#f87171', stroke: '#171717', strokeWidth: 2 }}>
                    <LabelList dataKey="despesas" content={(props: any) => <LineLabel {...props} position="bottom" />} />
                  </Line>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Receitas" subtitle="Por categoria — clique para filtrar">
          {receitasPorCategoria.length === 0 ? <EmptyState /> : (
            <HorizontalBarChart
              data={receitasPorCategoria}
              barClass="bg-sky-400"
              selectedNome={activeFilter?.tipo === 'RECEITA' ? activeFilter.nome : null}
              onSelect={nome => handleCategoryClick(nome, 'RECEITA')}
            />
          )}
        </ChartCard>
      </div>

      {/* ── Charts row 2: Resultado + Despesas por Categoria ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Resultado"
          subtitle={activeFilter ? activeFilter.nome : 'Saldo líquido mensal'}
          filterActive={!!activeFilter}
          onClearFilter={clearFilter}
          className="lg:col-span-2"
        >
          {filteredChartData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredChartData} margin={{ top: 32, right: 24, left: 24, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="label" stroke="#737373" tick={{ fill: '#737373', fontSize: 11 }} axisLine={false} tickLine={false} padding={{ left: 24, right: 24 }} />
                <YAxis hide />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [BRL.format(Number(v) || 0), 'Resultado']} />
                <ReferenceLine y={0} stroke="#555" strokeDasharray="4 2" />
                <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="resultado" content={(props: any) => <BarLabel {...props} />} />
                  {filteredChartData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.resultado >= 0 ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Despesas" subtitle="Por categoria — clique para filtrar">
          {despesasPorCategoria.length === 0 ? <EmptyState /> : (
            <HorizontalBarChart
              data={despesasPorCategoria}
              barClass="bg-red-400"
              selectedNome={activeFilter?.tipo === 'DESPESA' ? activeFilter.nome : null}
              onSelect={nome => handleCategoryClick(nome, 'DESPESA')}
            />
          )}
        </ChartCard>
      </div>

    </div>
  )
}

// ─── Period Picker ─────────────────────────────────────────────────────────────
function PeriodPicker({
  label, mes, ano, onChangeMes, onChangeAno,
}: {
  label: string
  mes: number
  ano: number
  onChangeMes: (m: number) => void
  onChangeAno:  (a: number) => void
}) {
  const selectCls =
    'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer'

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1.5">
        <select
          value={mes}
          onChange={e => onChangeMes(Number(e.target.value))}
          className={selectCls}
          title={`Mês ${label.toLowerCase()}`}
          aria-label={`Mês ${label.toLowerCase()}`}
        >
          {NOMES_MESES.map((nome, i) => (
            <option key={i + 1} value={i + 1}>{nome}</option>
          ))}
        </select>
        <select
          value={ano}
          onChange={e => onChangeAno(Number(e.target.value))}
          className={selectCls}
          title={`Ano ${label.toLowerCase()}`}
          aria-label={`Ano ${label.toLowerCase()}`}
        >
          {ANOS.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  sky:    'from-sky-500/10',
  red:    'from-red-500/10',
  violet: 'from-violet-500/10',
}

function KPICard({
  title, value, sub, icon, color, signed = false,
}: {
  title: string
  value: number
  sub?: string
  icon: React.ReactNode
  color: keyof typeof COLOR_MAP
  signed?: boolean
}) {
  const valueColor = signed
    ? (value < 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')
    : 'text-neutral-900 dark:text-white'

  return (
    <div className={`bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-5 relative overflow-hidden bg-gradient-to-br ${COLOR_MAP[color]} to-transparent`}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">{title}</p>
        <div className="p-2 bg-white/60 dark:bg-white/5 rounded-xl border border-white/5">{icon}</div>
      </div>
      <h4 className={`text-xl font-bold tracking-tight ${valueColor}`}>{BRL.format(value)}</h4>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, className = '', filterActive, onClearFilter }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  filterActive?: boolean
  onClearFilter?: () => void
}) {
  return (
    <div className={`bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl transition-all ${filterActive ? 'ring-2 ring-sky-400/40' : ''} ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
          {subtitle && (
            <p className={`text-xs mt-0.5 truncate ${filterActive ? 'text-sky-500 dark:text-sky-400 font-medium' : 'text-neutral-500'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {filterActive && onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="shrink-0 p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
            title="Limpar filtro"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="h-[320px] w-full">{children}</div>
    </div>
  )
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
function HorizontalBarChart({
  data, barClass, selectedNome, onSelect,
}: {
  data: { nome: string; valor: number }[]
  barClass: string
  selectedNome?: string | null
  onSelect?: (nome: string) => void
}) {
  const max = data[0]?.valor || 1
  const hasSelection = !!selectedNome

  return (
    <div className="h-full flex flex-col justify-start gap-2 overflow-y-auto pr-1">
      {data.map(item => {
        const pct      = Math.round((item.valor / max) * 100)
        const isActive = item.nome === selectedNome
        const isDimmed = hasSelection && !isActive

        return (
          <div
            key={item.nome}
            onClick={() => onSelect?.(item.nome)}
            className={`rounded-lg px-1.5 py-1 -mx-1.5 cursor-pointer transition-all select-none ${
              isActive
                ? 'bg-sky-50 dark:bg-sky-500/10'
                : isDimmed
                  ? 'opacity-40'
                  : 'hover:bg-neutral-50 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex justify-between items-center mb-0.5">
              <span
                className={`text-[11px] truncate transition-colors ${
                  isActive
                    ? 'text-sky-700 dark:text-sky-300 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
                title={item.nome}
              >
                {item.nome}
              </span>
              <span className={`text-[11px] font-semibold ml-2 shrink-0 ${
                isActive ? 'text-sky-700 dark:text-sky-300' : 'text-neutral-900 dark:text-white'
              }`}>
                {BRL.format(item.valor)}
              </span>
            </div>
            <div className="h-2 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isActive ? 'opacity-100' : ''} ${barClass}`}
                style={{ width: `${pct}%` }}
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
