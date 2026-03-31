'use server'

import { createClient } from '@/lib/supabase/server'
import { RelatorioCategoriaAno, StatusSemaforo, Categoria } from '@/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeStatus(saldo: number): StatusSemaforo {
  if (Math.abs(saldo) < 0.01) return 'AMARELO'
  return saldo > 0 ? 'VERDE' : 'VERMELHO'
}

interface ValsCat {
  orcAnual: number
  realizadoMes: number
  realizadoYTD: number
}

function aggSubtree(cat: Categoria, leafMap: Map<string, ValsCat>): ValsCat {
  if (!cat.children || cat.children.length === 0) {
    return leafMap.get(cat.id) ?? { orcAnual: 0, realizadoMes: 0, realizadoYTD: 0 }
  }
  const result: ValsCat = { orcAnual: 0, realizadoMes: 0, realizadoYTD: 0 }
  for (const child of cat.children) {
    const cv = aggSubtree(child, leafMap)
    result.orcAnual += cv.orcAnual
    result.realizadoMes += cv.realizadoMes
    result.realizadoYTD += cv.realizadoYTD
  }
  return result
}

function flattenTree(
  cats: Categoria[],
  leafMap: Map<string, ValsCat>,
  mesAlvo: number,
  depth: number,
  out: RelatorioCategoriaAno[],
) {
  for (const cat of cats) {
    const vals = aggSubtree(cat, leafMap)
    if (vals.orcAnual === 0 && vals.realizadoYTD === 0) continue

    const previstoMes = round2(vals.orcAnual / 12)
    const previstoYTD = round2(previstoMes * mesAlvo)
    const saldo = round2(vals.orcAnual - vals.realizadoYTD)

    const hasVisibleChildren = !!(cat.children?.some(c => {
      const cv = aggSubtree(c, leafMap)
      return cv.orcAnual > 0 || cv.realizadoYTD > 0
    }))

    out.push({
      categoriaId: cat.id,
      categoriaNome: cat.nome_conta,
      codigoReduzido: cat.codigo_reduzido,
      tipo: cat.tipo,
      previstoMes,
      realizadoMes: round2(vals.realizadoMes),
      previstoAcumuladoYTD: previstoYTD,
      realizadoAcumuladoYTD: round2(vals.realizadoYTD),
      orcamentoAnualTotal: round2(vals.orcAnual),
      saldoDisponivelAno: saldo,
      statusSemaforoAno: computeStatus(saldo),
      depth,
      hasChildren: hasVisibleChildren,
      parentId: cat.parent_id,
    })

    if (cat.children && cat.children.length > 0) {
      flattenTree(cat.children, leafMap, mesAlvo, depth + 1, out)
    }
  }
}

export async function getRelatorioAnual(
  simulacaoId: string,
  ano: number,
  mesAlvo: number,
  centroCustoId?: string,
): Promise<RelatorioCategoriaAno[]> {
  if (!simulacaoId || !ano || !mesAlvo) return []

  const supabase = await createClient()

  // 1. Fetch flat categories
  const { data: catData, error: catErr } = await supabase
    .from('categorias')
    .select('*')
    .order('codigo_reduzido', { ascending: true })
  if (catErr) {
    console.error('relatorio: cat error', catErr)
    return []
  }
  const categorias = catData as Categoria[]

  // 2. Build tree for hierarchy
  function buildTree(cats: Categoria[], parentId: string | null = null): Categoria[] {
    return cats
      .filter(c => c.parent_id === parentId)
      .map(c => ({ ...c, children: buildTree(cats, c.id) }))
      .sort((a, b) => a.codigo_reduzido.localeCompare(b.codigo_reduzido, undefined, { numeric: true }))
  }
  const catTree = buildTree(categorias)
  const catIdSet = new Set(categorias.map(c => c.id))

  // 3. Optionally resolve CC category IDs
  let ccCatIds: Set<string> | null = null
  if (centroCustoId && centroCustoId !== 'all') {
    const { data: ccRows, error: ccErr } = await supabase
      .from('categoria_centro_custo')
      .select('categoria_id')
      .eq('centro_custo_id', centroCustoId)
    if (!ccErr && ccRows) {
      ccCatIds = new Set(ccRows.map((r: any) => r.categoria_id as string))
    }
  }

  // 4. Fetch orcamento for all 12 months of the target year
  const { data: orcData, error: orcErr } = await supabase
    .from('orcamento_previsto')
    .select('categoria_id, mes, valor_previsto')
    .eq('simulacao_id', simulacaoId)
    .eq('ano', ano)
  if (orcErr) {
    console.error('relatorio: orc error', orcErr)
    return []
  }

  // 5. Fetch realizados from January through mesAlvo
  const { data: realData, error: realErr } = await supabase
    .from('dados_realizados')
    .select('categoria_id, mes, valor_realizado')
    .eq('ano', ano)
    .lte('mes', mesAlvo)
  if (realErr) {
    console.error('relatorio: real error', realErr)
    return []
  }

  // 6. Apply CC filter
  const orcFilt = ccCatIds
    ? (orcData ?? []).filter((o: any) => ccCatIds!.has(o.categoria_id))
    : (orcData ?? [])
  const realFilt = ccCatIds
    ? (realData ?? []).filter((r: any) => ccCatIds!.has(r.categoria_id))
    : (realData ?? [])

  // 7. Build per-category leaf value map
  const leafMap = new Map<string, ValsCat>()

  for (const o of orcFilt) {
    if (!leafMap.has(o.categoria_id)) {
      leafMap.set(o.categoria_id, { orcAnual: 0, realizadoMes: 0, realizadoYTD: 0 })
    }
    leafMap.get(o.categoria_id)!.orcAnual += Number(o.valor_previsto)
  }

  for (const r of realFilt) {
    if (!leafMap.has(r.categoria_id)) {
      leafMap.set(r.categoria_id, { orcAnual: 0, realizadoMes: 0, realizadoYTD: 0 })
    }
    const entry = leafMap.get(r.categoria_id)!
    entry.realizadoYTD += Number(r.valor_realizado)
    if (r.mes === mesAlvo) entry.realizadoMes += Number(r.valor_realizado)
  }

  // 8. Build report rows (hierarchical, DFS order)
  const rows: RelatorioCategoriaAno[] = []
  flattenTree(catTree, leafMap, mesAlvo, 0, rows)

  // 9. Handle "Não Categorizado" — realizados without a known category
  let naoCatYTD = 0
  let naoCatMes = 0
  for (const r of realFilt) {
    if (!catIdSet.has(r.categoria_id)) {
      naoCatYTD += Number(r.valor_realizado)
      if (r.mes === mesAlvo) naoCatMes += Number(r.valor_realizado)
    }
  }
  if (naoCatYTD > 0) {
    const saldo = round2(-naoCatYTD)
    rows.push({
      categoriaId: '__nao_categorizado__',
      categoriaNome: 'Não Categorizado',
      codigoReduzido: '---',
      tipo: 'DESPESA',
      previstoMes: 0,
      realizadoMes: round2(naoCatMes),
      previstoAcumuladoYTD: 0,
      realizadoAcumuladoYTD: round2(naoCatYTD),
      orcamentoAnualTotal: 0,
      saldoDisponivelAno: saldo,
      statusSemaforoAno: 'VERMELHO',
      depth: 0,
      hasChildren: false,
      parentId: null,
    })
  }

  return rows
}
