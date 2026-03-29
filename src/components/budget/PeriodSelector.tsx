import Form from 'next/form'

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function gerarMeses(
  ini: { ano: number; mes: number },
  fim: { ano: number; mes: number },
): { value: string; label: string }[] {
  const meses: { value: string; label: string }[] = []
  let curMes = ini.mes
  let curAno = ini.ano
  let guard = 0
  while ((curAno < fim.ano || (curAno === fim.ano && curMes <= fim.mes)) && guard < 60) {
    meses.push({
      value: `${curAno}-${String(curMes).padStart(2, '0')}`,
      label: `${NOMES_MESES[curMes - 1]}/${curAno}`,
    })
    curMes++
    if (curMes > 12) { curMes = 1; curAno++ }
    guard++
  }
  return meses
}

export function PeriodSelector({
  dataInicio,
  dataFim,
  selectedInicio,
  selectedFim,
  simulacaoId,
}: {
  dataInicio: { ano: number; mes: number }
  dataFim: { ano: number; mes: number }
  selectedInicio: string
  selectedFim: string
  simulacaoId?: string
}) {
  const meses = gerarMeses(dataInicio, dataFim)
  if (meses.length === 0) return null

  return (
    <Form action="/dashboard" className="flex items-center gap-2">
      {simulacaoId && <input type="hidden" name="simulacao" value={simulacaoId} />}
      <span className="text-sm text-neutral-400 whitespace-nowrap">De:</span>
      <select
        name="inicio"
        defaultValue={selectedInicio}
        className="bg-white/5 border border-white/10 text-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
      >
        {meses.map(m => (
          <option key={m.value} value={m.value} className="bg-neutral-900 text-white">
            {m.label}
          </option>
        ))}
      </select>

      <span className="text-sm text-neutral-400 whitespace-nowrap">Até:</span>
      <select
        name="fim"
        defaultValue={selectedFim}
        className="bg-white/5 border border-white/10 text-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
      >
        {meses.map(m => (
          <option key={m.value} value={m.value} className="bg-neutral-900 text-white">
            {m.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg transition-all border border-emerald-500/20"
      >
        Filtrar
      </button>
    </Form>
  )
}
