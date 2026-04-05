'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { RelatorioCategoriaAno, StatusSemaforo, Categoria } from '@/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeStatus(saldo: number): StatusSemaforo {
  if (Math.abs(saldo) < 0.01) return 'AMARELO'
  return saldo > 0 ? 'VERDE' : 'VERMELHO'
}

interface ValsCat {
  orcAnual: number      // sum of all 12 months of the FIM year (for Orç. Anual / previstoMes)
  orcPeriodo: number    // sum of monthly budgets for the selected period months (for previstoYTD)
  realizadoMes: number
  realizadoYTD: number
}

const EMPTY_VALS: ValsCat = { orcAnual: 0, orcPeriodo: 0, realizadoMes: 0, realizadoYTD: 0 }

function aggSubtree(cat: Categoria, leafMap: Map<string, ValsCat>): ValsCat {
  if (!cat.children || cat.children.length === 0) {
    return leafMap.get(cat.id) ?? { ...EMPTY_VALS }
  }
  const result: ValsCat = { ...EMPTY_VALS }
  for (const child of cat.children) {
    const cv = aggSubtree(child, leafMap)
    result.orcAnual    += cv.orcAnual
    result.orcPeriodo  += cv.orcPeriodo
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
    if (vals.orcPeriodo === 0 && vals.realizadoYTD === 0) continue

    const previstoMes = round2(vals.orcAnual / 12)
    const previstoYTD = round2(vals.orcPeriodo)
    const saldo = round2(vals.orcAnual - vals.realizadoYTD)

    const hasVisibleChildren = !!(cat.children?.some(c => {
      const cv = aggSubtree(c, leafMap)
      return cv.orcPeriodo > 0 || cv.realizadoYTD > 0
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
  anoInicio?: number,
  mesInicio?: number,
  simAnoInicio?: number,
  simMesInicio?: number,
  simAnoFim?: number,
  simMesFim?: number,
): Promise<RelatorioCategoriaAno[]> {
  const anoIni = anoInicio ?? ano
  const mesIni = mesInicio ?? 1
  const startKey = anoIni * 100 + mesIni
  const endKey   = ano   * 100 + mesAlvo
  const numMeses = (ano - anoIni) * 12 + (mesAlvo - mesIni + 1)

  // Simulation annual bounds (fallback to filter period if not provided)
  const sAnoIni = simAnoInicio ?? anoIni
  const sMesIni = simMesInicio ?? mesIni
  const sAnoFim = simAnoFim ?? ano
  const sMesFim = simMesFim ?? mesAlvo
  const simStartKey = sAnoIni * 100 + sMesIni
  const simEndKey   = sAnoFim * 100 + sMesFim

  if (!simulacaoId || !ano || !mesAlvo || numMeses <= 0) return []

  const { condoId } = await validateAccess()
  const supabase = await createClient()

  // 1. Fetch flat categories
  const { data: catData, error: catErr } = await supabase
    .from('categorias')
    .select('*')
    .or(`condo_id.eq.${condoId},condo_id.is.null`)
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

  // 4. Fetch orcamentos for all relevant years (cross-year support) — with pagination
  //    orcAnual  = sum of simulation annual bounds  → for "Orç. Anual" column
  //    orcPeriodo = sum of monthly budgets for the selected period only → for "YTD Previsto"
  const qAnoMin = Math.min(anoIni, sAnoIni)
  const qAnoMax = Math.max(ano,    sAnoFim)
  let orcData: any[] = []
  {
    let from = 0, to = 999, hasMore = true
    while (hasMore) {
      const { data, error } = await supabase
        .from('orcamento_previsto')
        .select('categoria_id, ano, mes, valor_previsto')
        .eq('simulacao_id', simulacaoId)
        .eq('condo_id', condoId)
        .gte('ano', qAnoMin)
        .lte('ano', qAnoMax)
        .range(from, to)
      if (error) { console.error('relatorio: orc error', error); return [] }
      if (data && data.length > 0) {
        orcData = orcData.concat(data)
        if (data.length < 1000) { hasMore = false } else { from += 1000; to += 1000 }
      } else { hasMore = false }
    }
  }

  // 5. Fetch realizados for the selected period (cross-year: anoIni → ano) — with pagination
  let realData: any[] = []
  {
    let from = 0, to = 999, hasMore = true
    while (hasMore) {
      const { data, error } = await supabase
        .from('dados_realizados')
        .select('categoria_id, ano, mes, valor_realizado')
        .eq('condo_id', condoId)
        .gte('ano', anoIni)
        .lte('ano', ano)
        .range(from, to)
      if (error) { console.error('relatorio: real error', error); return [] }
      if (data && data.length > 0) {
        realData = realData.concat(data)
        if (data.length < 1000) { hasMore = false } else { from += 1000; to += 1000 }
      } else { hasMore = false }
    }
  }
  // Filter in memory to the exact period window
  const realDataFilt = (realData ?? []).filter((r: any) => {
    const k = Number(r.ano) * 100 + Number(r.mes)
    return k >= startKey && k <= endKey
  })

  // 6. Apply CC filter
  const orcFilt = ccCatIds
    ? (orcData ?? []).filter((o: any) => ccCatIds!.has(o.categoria_id))
    : (orcData ?? [])
  const realFilt = ccCatIds
    ? realDataFilt.filter((r: any) => ccCatIds!.has(r.categoria_id))
    : realDataFilt

  // 7. Build per-category leaf value map
  const leafMap = new Map<string, ValsCat>()

  const ensureEntry = (id: string) => {
    if (!leafMap.has(id)) leafMap.set(id, { ...EMPTY_VALS })
    return leafMap.get(id)!
  }

  orcFilt.forEach((o: any) => {
    const oAno = Number(o.ano)
    const oMes = Number(o.mes)
    const entry = ensureEntry(o.categoria_id)
    
    // orcAnual: Sum all months within the simulation's annual bounds
    const ok = oAno * 100 + oMes
    if (ok >= simStartKey && ok <= simEndKey) {
      entry.orcAnual += Number(o.valor_previsto || 0)
    }
    
    // orcPeriodo: Sum all months within the [startKey, endKey] window
    const k = oAno * 100 + oMes
    if (k >= startKey && k <= endKey) {
      entry.orcPeriodo += Number(o.valor_previsto || 0)
    }
  })

  realFilt.forEach((r: any) => {
    const rAno = Number(r.ano)
    const rMes = Number(r.mes)
    const entry = ensureEntry(r.categoria_id)
    
    entry.realizadoYTD += Number(r.valor_realizado || 0)
    
    if (rAno === ano && rMes === mesAlvo) {
      entry.realizadoMes += Number(r.valor_realizado || 0)
    }
  })


  // 8. Build report rows (hierarchical, DFS order)
  const rows: RelatorioCategoriaAno[] = []
  flattenTree(catTree, leafMap, mesAlvo, 0, rows)

  // 9. Handle "Não Categorizado" — realizados without a known category
  let naoCatYTD = 0
  let naoCatMes = 0
  for (const r of realFilt) {
    if (!catIdSet.has(r.categoria_id)) {
      naoCatYTD += Number(r.valor_realizado)
      if (Number(r.ano) === ano && Number(r.mes) === mesAlvo) naoCatMes += Number(r.valor_realizado)
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
