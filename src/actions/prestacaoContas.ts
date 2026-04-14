'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { Categoria } from '@/types'

const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function buildTypeMap(cats: Categoria[], map: Map<string, 'RECEITA' | 'DESPESA'> = new Map()) {
  cats.forEach(c => {
    map.set(c.id, c.tipo)
    if (c.children) buildTypeMap(c.children, map)
  })
  return map
}

function buildParentMap(cats: Categoria[], parentMap: Map<string, string> = new Map()) {
  cats.forEach(c => {
    if (c.parent_id) parentMap.set(c.id, c.parent_id)
    if (c.children) buildParentMap(c.children, parentMap)
  })
  return parentMap
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

function getTopLevelId(catId: string, parentMap: Map<string, string>): string {
  let current = catId
  let guard = 0
  while (parentMap.has(current) && guard < 20) {
    current = parentMap.get(current)!
    guard++
  }
  return current
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
}

export async function getPrestacaoContas(ano: number): Promise<PrestacaoContasData> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

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
  const parentMap = buildParentMap(catTree)
  const leafIds = getLeafIds(catTree)
  const catNameMap = new Map(categorias.map(c => [c.id, c.nome_conta]))

  // 2. Fetch realized data for the year (paginated)
  let realData: any[] = []
  let from = 0, to = 999, hasMore = true
  while (hasMore) {
    const { data, error } = await supabase
      .from('dados_realizados')
      .select('categoria_id, ano, mes, valor_realizado')
      .eq('condo_id', condoId)
      .eq('ano', ano)
      .range(from, to)
    if (error) { console.error('prestacaoContas: realizado error', error); break }
    if (data && data.length > 0) {
      realData = realData.concat(data)
      if (data.length < 1000) hasMore = false
      else { from += 1000; to += 1000 }
    } else hasMore = false
  }

  // 3. Saldo anterior: soma dos saldo_inicial dos centros de custo do condo
  const { data: ccData } = await supabase
    .from('centros_custo')
    .select('saldo_inicial')
    .eq('condo_id', condoId)

  const saldoAnterior = (ccData ?? []).reduce(
    (sum: number, cc: any) => sum + Number(cc.saldo_inicial || 0),
    0,
  )

  // 4. Aggregate monthly totals and per-category totals
  const monthMap = new Map<number, { receitas: number; despesas: number }>()
  for (let m = 1; m <= 12; m++) monthMap.set(m, { receitas: 0, despesas: 0 })

  const topLevelRecMap = new Map<string, number>()
  const topLevelDesMap = new Map<string, number>()

  for (const r of realData) {
    // Only count leaf-level categories to avoid double-counting parent + children
    if (!leafIds.has(r.categoria_id)) continue

    const mes = Number(r.mes)
    const valor = Number(r.valor_realizado || 0)
    const tipo = typeMap.get(r.categoria_id)
    const topId = getTopLevelId(r.categoria_id, parentMap)
    const topNome = catNameMap.get(topId) || 'Outros'

    const bucket = monthMap.get(mes)
    if (!bucket) continue

    if (tipo === 'RECEITA') {
      bucket.receitas += valor
      topLevelRecMap.set(topNome, (topLevelRecMap.get(topNome) ?? 0) + valor)
    } else if (tipo === 'DESPESA') {
      bucket.despesas += valor
      topLevelDesMap.set(topNome, (topLevelDesMap.get(topNome) ?? 0) + valor)
    }
  }

  // 5. Build monthly data array (all 12 months)
  const dadosMensais: DadoMensal[] = []
  let totalReceitas = 0
  let totalDespesas = 0
  let mesesComDados = 0

  for (let mes = 1; mes <= 12; mes++) {
    const { receitas, despesas } = monthMap.get(mes)!
    totalReceitas += receitas
    totalDespesas += despesas
    if (receitas > 0 || despesas > 0) mesesComDados++
    dadosMensais.push({
      mes,
      label: NOMES_MESES[mes - 1],
      receitas,
      despesas,
      resultado: receitas - despesas,
    })
  }

  const resultado = totalReceitas - totalDespesas
  const divisor = mesesComDados || 1

  // 6. Sort categories descending by value
  const receitasPorCategoria: CategoriaValor[] = Array.from(topLevelRecMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .filter(x => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  const despesasPorCategoria: CategoriaValor[] = Array.from(topLevelDesMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .filter(x => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)

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
  }
}
