'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from 'recharts'
import { OrcamentoPrevisto, DadosRealizados, Categoria } from '@/types'
import { TrendingDown, TrendingUp, DollarSign, Activity } from 'lucide-react'

export function DashboardCharts({
  categorias,
  orcamentos,
  realizados,
}: {
  categorias: Categoria[]
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
}) {
  const chartData = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    
    // Create mapping of category types
    const catTypeMap = new Map<string, 'RECEITA' | 'DESPESA'>()
    const buildTypeMap = (cats: Categoria[]) => {
      cats.forEach(c => {
        catTypeMap.set(c.id, c.tipo)
        if (c.children) buildTypeMap(c.children)
      })
    }
    buildTypeMap(categorias)

    const data = meses.map((mes, index) => {
      const mesNum = index + 1
      
      const prev_rec = orcamentos.filter(o => o.mes === mesNum && catTypeMap.get(o.categoria_id) === 'RECEITA').reduce((sum, o) => sum + Number(o.valor_previsto), 0)
      const prev_des = orcamentos.filter(o => o.mes === mesNum && catTypeMap.get(o.categoria_id) === 'DESPESA').reduce((sum, o) => sum + Number(o.valor_previsto), 0)
      
      const actualMonthRealizados = realizados.filter(r => new Date(r.data_referencia).getMonth() + 1 === mesNum)
      const real_rec = actualMonthRealizados.filter(r => catTypeMap.get(r.categoria_id) === 'RECEITA').reduce((sum, r) => sum + Number(r.valor_realizado), 0)
      const real_des = actualMonthRealizados.filter(r => catTypeMap.get(r.categoria_id) === 'DESPESA').reduce((sum, r) => sum + Number(r.valor_realizado), 0)

      return {
        name: mes,
        'Receitas (Prev)': prev_rec,
        'Treinar (Desp Prev)': prev_des,
        'Receitas (Real)': real_rec,
        'Despesas (Real)': real_des,
        'Saldo (Prev)': prev_rec - prev_des,
        'Saldo (Real)': real_rec - real_des,
      }
    })
    return data
  }, [categorias, orcamentos, realizados])

  // Calculate totals for KPIs
  const totalReceitasPrev = chartData.reduce((acc, curr) => acc + curr['Receitas (Prev)'], 0)
  const totalDespesasPrev = chartData.reduce((acc, curr) => acc + curr['Treinar (Desp Prev)'], 0)
  const totalReceitasReal = chartData.reduce((acc, curr) => acc + curr['Receitas (Real)'], 0)
  const totalDespesasReal = chartData.reduce((acc, curr) => acc + curr['Despesas (Real)'], 0)
  const resultadoPrev = totalReceitasPrev - totalDespesasPrev
  const resultadoReal = totalReceitasReal - totalDespesasReal

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total Receitas (Prev)" value={totalReceitasPrev} icon={<TrendingUp className="text-emerald-400" />} />
        <KPICard title="Total Despesas (Prev)" value={totalDespesasPrev} icon={<TrendingDown className="text-red-400" />} />
        <KPICard title="Resultado Projetado" value={resultadoPrev} success={resultadoPrev >= 0} icon={<Activity className="text-indigo-400" />} />
        <KPICard title="Resultado Alcançado" value={resultadoReal} success={resultadoReal >= 0} icon={<DollarSign className="text-blue-400" />} />
      </div>

      {/* Main Bar/Line Chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-white mb-6">Evolução: Previsto x Realizado x Saldo</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" vertical={false} />
              <XAxis dataKey="name" stroke="#a3a3a3" tick={{ fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} stroke="#a3a3a3" tick={{ fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} stroke="#a3a3a3" axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
                formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar yAxisId="left" dataKey="Receitas (Prev)" fill="#34d399" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar yAxisId="left" dataKey="Treinar (Desp Prev)" name="Despesas (Prev)" fill="#f87171" radius={[4, 4, 0, 0]} barSize={20} />
              <Line yAxisId="right" type="monotone" dataKey="Saldo (Prev)" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4, fill: '#60a5fa', strokeWidth: 2, stroke: '#171717' }} />
              <Line yAxisId="right" type="monotone" dataKey="Saldo (Real)" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4, fill: '#14b8a6', strokeWidth: 2, stroke: '#171717' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function KPICard({ title, value, success, icon }: { title: string, value: number, success?: boolean, icon: React.ReactNode }) {
  const isNegative = value < 0
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <p className="text-sm font-medium text-neutral-400 mb-1">{title}</p>
          <h4 className={`text-2xl font-bold tracking-tight ${success !== undefined ? (success ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
          </h4>
        </div>
        <div className="p-3 bg-white/5 rounded-xl border border-white/5 shadow-inner">
          {icon}
        </div>
      </div>
    </div>
  )
}
