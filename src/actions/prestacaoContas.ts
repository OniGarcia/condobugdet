'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { Categoria } from '@/types'
import { NOMES_MESES } from '@/lib/meses'

function buildTypeMap(cats: Categoria[], map: Map<string, 'RECEITA' | 'DESPESA'> = new Map()) {
  cats.forEach(c => {
    map.set(c.id, c.tipo)
    if (c.children) buildTypeMap(c.children, map)
  })
  return map
}


// Only leaf nodes (no children) should be summed to avoid double-counting
function getLeafIds(cats: Categoria[], leafIds: Set<string> = new Set()): Set<string> {
  cats.forEach(c => {
    if (!c.children || c.children.length === 0) {
      leafIds.add(c.id)
    } else {
      getLeafIds(c.children, leafIds)
    }
  })
  return leafIds
}


export interface DadoMensal {
  mes: number
  label: string
  receitas: number
  despesas: number
  resultado: number
}

export interface CategoriaValor {
  nome: string
  valor: number
  dadosMensais: DadoMensal[]
}

export interface PrestacaoContasData {
  totalReceitas: number
  mediaReceitas: number
  totalDespesas: number
  mediaDespesas: number
  resultado: number
  mediaResultado: number
  saldoAnterior: number
  saldoFinal: number
  dadosMensais: DadoMensal[]
  receitasPorCategoria: CategoriaValor[]
  despesasPorCategoria: CategoriaValor[]
  mesesComDados: number
  yoyReceitas: number
  yoyDespesas: number
  yoyResultado: number
}

const EMPTY: PrestacaoContasData = {
  totalReceitas: 0,
  mediaReceitas: 0,
  totalDespesas: 0,
  mediaDespesas: 0,
  resultado: 0,
  mediaResultado: 0,
  saldoAnterior: 0,
  saldoFinal: 0,
  dadosMensais: [],
  receitasPorCategoria: [],
  despesasPorCategoria: [],
  mesesComDados: 0,
  yoyReceitas: 0,
  yoyDespesas: 0,
  yoyResultado: 0,
}



export async function getPrestacaoContas(
  anoInicio: number,
  mesInicio: number,
  anoFim: number,
  mesFim: number,
): Promise<PrestacaoContasData> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  const startKey = anoInicio * 100 + mesInicio
  const endKey   = anoFim   * 100 + mesFim

  if (startKey > endKey) return { ...EMPTY }

  // 1. Fetch categories
  const { data: catData, error: catErr } = await supabase
    .from('categorias')
    .select('*')
    .or(`condo_id.eq.${condoId},condo_id.is.null`)
    .order('codigo_reduzido', { ascending: true })

  if (catErr || !catData) return { ...EMPTY }

  const categorias = catData as Categoria[]

  function buildTree(cats: Categoria[], parentId: string | null = null): Categoria[] {
    return cats
      .filter(c => c.parent_id === parentId)
      .map(c => ({ ...c, children: buildTree(cats, c.id) }))
      .sort((a, b) => a.codigo_reduzido.localeCompare(b.codigo_reduzido, undefined, { numeric: true }))
  }

  const catTree = buildTree(categorias)
  const typeMap = buildTypeMap(catTree)
  const leafIds = getLeafIds(catTree)
  const catNameMap = new Map(categorias.map(c => [c.id, c.nome_conta]))

  // YoY keys: same months, previous year
  const yoyStartKey = (anoInicio - 1) * 100 + mesInicio
  const yoyEndKey   = (anoFim   - 1) * 100 + mesFim

  // 2. Fetch realized data covering current period + previous year (for YoY)
  let allRealData: any[] = []
  let from = 0, to = 999, hasMore = true
  while (hasMore) {
    const { data, error } = await supabase
      .from('dados_realizados')
      .select('categoria_id, ano, mes, valor_realizado')
      .eq('condo_id', condoId)
      .gte('ano', anoInicio - 1)
      .lte('ano', anoFim)
      .range(from, to)
    if (error) { console.error('prestacaoContas: realizado error', error); break }
    if (data && data.length > 0) {
      allRealData = allRealData.concat(data)
      if (data.length < 1000) hasMore = false
      else { from += 1000; to += 1000 }
    } else hasMore = false
  }

  // Split into current period and YoY period
  const realData = allRealData.filter(r => {
    const k = Number(r.ano) * 100 + Number(r.mes)
    return k >= startKey && k <= endKey
  })
  const yoyData = allRealData.filter(r => {
    const k = Number(r.ano) * 100 + Number(r.mes)
    return k >= yoyStartKey && k <= yoyEndKey
  })

  // 3. Saldo anterior: soma dos saldo_inicial dos centros de custo do condo
  const { data: ccData } = await supabase
    .from('centros_custo')
    .select('saldo_inicial')
    .eq('condo_id', condoId)

  const saldoAnterior = (ccData ?? []).reduce(
    (sum: number, cc: any) => sum + Number(cc.saldo_inicial || 0),
    0,
  )

  // 4. Build list of all months in the period
  const periodoMeses: { ano: number; mes: number; label: string }[] = []
  let curAno = anoInicio
  let curMes = mesInicio
  let guard = 0
  while ((curAno * 100 + curMes) <= endKey && guard < 120) {
    periodoMeses.push({
      ano: curAno,
      mes: curMes,
      label: `${NOMES_MESES[curMes - 1]}/${String(curAno).slice(-2)}`,
    })
    curMes++
    if (curMes > 12) { curMes = 1; curAno++ }
    guard++
  }

  // 5. Aggregate per month and per top-level category
  // Key: "ano-mes" → { receitas, despesas }
  type Bucket = { receitas: number; despesas: number }
  const monthMap = new Map<string, Bucket>()
  for (const p of periodoMeses) {
    monthMap.set(`${p.ano}-${p.mes}`, { receitas: 0, despesas: 0 })
  }

  const topLevelRecMap = new Map<string, number>()
  const topLevelDesMap = new Map<string, number>()
  // Per-category monthly breakdown: nome → "ano-mes" → valor
  const recCatMonthMap = new Map<string, Map<string, number>>()
  const desCatMonthMap = new Map<string, Map<string, number>>()

  for (const r of realData) {
    // Only count leaf-level categories to avoid double-counting parent + children
    if (!leafIds.has(r.categoria_id)) continue

    const key = `${r.ano}-${Number(r.mes)}`
    const bucket = monthMap.get(key)
    if (!bucket) continue

    const valor = Number(r.valor_realizado || 0)
    const tipo = typeMap.get(r.categoria_id)
    const nome = catNameMap.get(r.categoria_id) || 'Outros'

    if (tipo === 'RECEITA') {
      bucket.receitas += valor
      topLevelRecMap.set(nome, (topLevelRecMap.get(nome) ?? 0) + valor)
      if (!recCatMonthMap.has(nome)) recCatMonthMap.set(nome, new Map())
      const m = recCatMonthMap.get(nome)!
      m.set(key, (m.get(key) ?? 0) + valor)
    } else if (tipo === 'DESPESA') {
      bucket.despesas += valor
      topLevelDesMap.set(nome, (topLevelDesMap.get(nome) ?? 0) + valor)
      if (!desCatMonthMap.has(nome)) desCatMonthMap.set(nome, new Map())
      const m = desCatMonthMap.get(nome)!
      m.set(key, (m.get(key) ?? 0) + valor)
    }
  }

  // 6. Build monthly data array for the period
  const dadosMensais: DadoMensal[] = []
  let totalReceitas = 0
  let totalDespesas = 0
  let mesesComDados = 0

  for (const p of periodoMeses) {
    const { receitas, despesas } = monthMap.get(`${p.ano}-${p.mes}`)!
    totalReceitas += receitas
    totalDespesas += despesas
    if (receitas > 0 || despesas > 0) mesesComDados++
    dadosMensais.push({
      mes: p.mes,
      label: p.label,
      receitas,
      despesas,
      resultado: receitas - despesas,
    })
  }

  const resultado = totalReceitas - totalDespesas
  const divisor = mesesComDados || 1

  // 7. Sort categories descending by value, with monthly breakdown
  const receitasPorCategoria: CategoriaValor[] = Array.from(topLevelRecMap.entries())
    .map(([nome, valor]) => ({
      nome,
      valor,
      dadosMensais: periodoMeses.map(p => {
        const k = `${p.ano}-${p.mes}`
        const v = recCatMonthMap.get(nome)?.get(k) ?? 0
        return { mes: p.mes, label: p.label, receitas: v, despesas: 0, resultado: v }
      }),
    }))
    .filter(x => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const despesasPorCategoria: CategoriaValor[] = Array.from(topLevelDesMap.entries())
    .map(([nome, valor]) => ({
      nome,
      valor,
      dadosMensais: periodoMeses.map(p => {
        const k = `${p.ano}-${p.mes}`
        const v = desCatMonthMap.get(nome)?.get(k) ?? 0
        return { mes: p.mes, label: p.label, receitas: 0, despesas: v, resultado: -v }
      }),
    }))
    .filter(x => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  // 8. YoY aggregation (same logic, leaf-only, over yoyData)
  let yoyReceitas = 0
  let yoyDespesas = 0
  for (const r of yoyData) {
    if (!leafIds.has(r.categoria_id)) continue
    const valor = Number(r.valor_realizado || 0)
    const tipo  = typeMap.get(r.categoria_id)
    if (tipo === 'RECEITA') yoyReceitas += valor
    else if (tipo === 'DESPESA') yoyDespesas += valor
  }
  const yoyResultado = yoyReceitas - yoyDespesas

  return {
    totalReceitas,
    mediaReceitas: totalReceitas / divisor,
    totalDespesas,
    mediaDespesas: totalDespesas / divisor,
    resultado,
    mediaResultado: resultado / divisor,
    saldoAnterior,
    saldoFinal: saldoAnterior + resultado,
    dadosMensais,
    receitasPorCategoria,
    despesasPorCategoria,
    mesesComDados,
    yoyReceitas,
    yoyDespesas,
    yoyResultado,
  }
}
