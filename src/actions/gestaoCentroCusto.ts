'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import {
  GestaoCCResult, GestaoCCMes, GestaoCCCategoria,
  GestaoCCMatrizCategoria, CategoriaTipo, StatusSemaforo,
} from '@/types'

function r2(n: number) { return Math.round(n * 100) / 100 }

function computeStatus(saldo: number): StatusSemaforo {
  if (Math.abs(saldo) < 0.01) return 'AMARELO'
  return saldo > 0 ? 'VERDE' : 'VERMELHO'
}

function gerarMesesNoPeriodo(
  anoIni: number, mesIni: number,
  anoFim: number, mesFim: number,
): Array<{ ano: number; mes: number }> {
  const meses: Array<{ ano: number; mes: number }> = []
  let a = anoIni, m = mesIni
  while (a < anoFim || (a === anoFim && m <= mesFim)) {
    meses.push({ ano: a, mes: m })
    m++; if (m > 12) { m = 1; a++ }
  }
  return meses
}

export async function getGestaoCentroCusto(
  centroCustoId: string,
  anoInicio: number,
  mesInicio: number,
  anoFim: number,
  mesFim: number,
  simulacaoId?: string,
): Promise<GestaoCCResult | null> {
  if (!centroCustoId || centroCustoId === 'all') return null

  const { condoId } = await validateAccess()
  const supabase = await createClient()
  const startKey = anoInicio * 100 + mesInicio
  const endKey   = anoFim   * 100 + mesFim
  const temSimulacao = !!(simulacaoId && simulacaoId !== '')

  // 1. Centro de custo
  const { data: cc, error: ccErr } = await supabase
    .from('centros_custo')
    .select('id, nome, saldo_inicial')
    .eq('id', centroCustoId)
    .eq('condo_id', condoId)
    .single()
  if (ccErr || !cc) return null
  const saldoInicialCC = r2(Number(cc.saldo_inicial ?? 0))

  // 2. Categorias associadas
  const { data: assoc, error: assocErr } = await supabase
    .from('categoria_centro_custo')
    .select('categoria_id')
    .eq('centro_custo_id', centroCustoId)
  if (assocErr || !assoc || assoc.length === 0) {
    const mesesVazios: GestaoCCMes[] = gerarMesesNoPeriodo(anoInicio, mesInicio, anoFim, mesFim).map(m => ({
      ...m, saldoInicial: saldoInicialCC, entradas: 0, saidas: 0,
      entradasPrevisto: 0, saidasPrevisto: 0,
      resultado: 0, resultadoPrevisto: 0, saldoFinal: saldoInicialCC, categorias: [],
    }))
    return {
      centroCustoId: cc.id, centroCustoNome: cc.nome, saldoInicial: saldoInicialCC,
      totalEntradas: 0, totalEntradasPrevisto: 0,
      totalSaidas: 0, totalSaidasPrevisto: 0,
      resultado: 0, resultadoPrevisto: 0, saldoFinal: saldoInicialCC,
      meses: mesesVazios, matriz: [],
      periodo: { anoInicio, mesInicio, anoFim, mesFim }, temSimulacao,
    }
  }
  const catIds = assoc.map((r: any) => r.categoria_id as string)

  // 3. Detalhes das categorias
  const { data: catData, error: catErr } = await supabase
    .from('categorias')
    .select('id, codigo_reduzido, nome_conta, tipo')
    .in('id', catIds)
  if (catErr) return null
  const catMap = new Map((catData ?? []).map((c: any) => [c.id as string, c]))

  // 4. Realizados (com paginação)
  let realData: any[] = []
  {
    let from = 0, to = 999, hasMore = true
    while (hasMore) {
      const { data, error } = await supabase
        .from('dados_realizados')
        .select('categoria_id, ano, mes, valor_realizado')
        .eq('condo_id', condoId)
        .in('categoria_id', catIds)
        .gte('ano', anoInicio).lte('ano', anoFim)
        .range(from, to)
      if (error) break
      if (data && data.length > 0) {
        realData = realData.concat(data)
        if (data.length < 1000) { hasMore = false } else { from += 1000; to += 1000 }
      } else { hasMore = false }
    }
  }

  // 5. Orçamento previsto — apenas se houver simulação selecionada
  let orcData: any[] = []
  if (temSimulacao) {
    let from = 0, to = 999, hasMore = true
    while (hasMore) {
      const { data, error } = await supabase
        .from('orcamento_previsto')
        .select('categoria_id, ano, mes, valor_previsto')
        .eq('simulacao_id', simulacaoId!)
        .eq('condo_id', condoId)
        .in('categoria_id', catIds)
        .gte('ano', anoInicio).lte('ano', anoFim)
        .range(from, to)
      if (error) break
      if (data && data.length > 0) {
        orcData = orcData.concat(data)
        if (data.length < 1000) { hasMore = false } else { from += 1000; to += 1000 }
      } else { hasMore = false }
    }
  }

  // 6. Indexa realizado e previsto por mesKey → Map<catId, valor>
  const realPorMes = new Map<number, Map<string, number>>()
  const orcPorMes  = new Map<number, Map<string, number>>()

  for (const r of realData) {
    const k = Number(r.ano) * 100 + Number(r.mes)
    if (k < startKey || k > endKey) continue
    if (!realPorMes.has(k)) realPorMes.set(k, new Map())
    const mm = realPorMes.get(k)!
    mm.set(r.categoria_id, r2((mm.get(r.categoria_id) ?? 0) + Number(r.valor_realizado || 0)))
  }
  for (const o of orcData) {
    const k = Number(o.ano) * 100 + Number(o.mes)
    if (k < startKey || k > endKey) continue
    if (!orcPorMes.has(k)) orcPorMes.set(k, new Map())
    const mm = orcPorMes.get(k)!
    mm.set(o.categoria_id, r2((mm.get(o.categoria_id) ?? 0) + Number(o.valor_previsto || 0)))
  }

  // 7. Totalizadores de período por categoria (para matriz)
  const realPorCat = new Map<string, number>()
  const orcPorCat  = new Map<string, number>()
  const orcAnualPorCat = new Map<string, number>() // orçamento anual completo (todos os meses do ano)

  for (const r of realData) {
    const k = Number(r.ano) * 100 + Number(r.mes)
    if (k < startKey || k > endKey) continue
    realPorCat.set(r.categoria_id, r2((realPorCat.get(r.categoria_id) ?? 0) + Number(r.valor_realizado || 0)))
  }
  for (const o of orcData) {
    const k = Number(o.ano) * 100 + Number(o.mes)
    if (k < startKey || k > endKey) continue
    orcPorCat.set(o.categoria_id, r2((orcPorCat.get(o.categoria_id) ?? 0) + Number(o.valor_previsto || 0)))
    // Orçamento anual: soma TODOS os meses (sem filtro de período)
  }
  for (const o of orcData) {
    orcAnualPorCat.set(o.categoria_id, r2((orcAnualPorCat.get(o.categoria_id) ?? 0) + Number(o.valor_previsto || 0)))
  }

  // 8. Monta matriz previsto vs realizado com hierarquia (mesmo algoritmo de relatorios.ts)
  //    Busca TODAS as categorias (com parent_id) para montar a árvore corretamente
  const { data: allCatData } = await supabase
    .from('categorias')
    .select('id, codigo_reduzido, nome_conta, tipo, parent_id')
    .or(`condo_id.eq.${condoId},condo_id.is.null`)
    .order('codigo_reduzido', { ascending: true })

  const allCats: Array<{ id: string; codigo_reduzido: string; nome_conta: string; tipo: string; parent_id: string | null; children?: any[] }> = allCatData ?? []

  // Filtra catIds em folhas (apenas os associados ao CC) para os valores-base
  const catIdSet = new Set(catIds)

  // Monta mapa de filhos
  function buildCatTree(cats: typeof allCats, parentId: string | null): typeof allCats {
    return cats
      .filter(c => c.parent_id === parentId)
      .map(c => ({ ...c, children: buildCatTree(cats, c.id) }))
      .sort((a, b) => a.codigo_reduzido.localeCompare(b.codigo_reduzido, undefined, { numeric: true }))
  }
  const catTree = buildCatTree(allCats, null)

  interface CatVals { previsto: number; realizado: number; orcAnual: number }
  const ZERO: CatVals = { previsto: 0, realizado: 0, orcAnual: 0 }

  // Agrega recursivamente das folhas para cima, filtrando só catIds do CC
  function aggCat(cat: typeof allCats[0]): CatVals {
    if (!cat.children || cat.children.length === 0) {
      if (!catIdSet.has(cat.id)) return { ...ZERO }
      return {
        previsto:  r2(orcPorCat.get(cat.id)  ?? 0),
        realizado: r2(realPorCat.get(cat.id) ?? 0),
        orcAnual:  r2(orcAnualPorCat.get(cat.id) ?? 0),
      }
    }
    const agg: CatVals = { previsto: 0, realizado: 0, orcAnual: 0 }
    for (const child of cat.children) {
      const cv = aggCat(child)
      agg.previsto  += cv.previsto
      agg.realizado += cv.realizado
      agg.orcAnual  += cv.orcAnual
    }
    return agg
  }

  function hasVisibleChildren(cat: typeof allCats[0]): boolean {
    if (!cat.children || cat.children.length === 0) return false
    return cat.children.some(c => {
      const cv = aggCat(c)
      return cv.previsto !== 0 || cv.realizado !== 0
    })
  }

  // Achata em DFS, pulando nós sem movimento
  const matriz: GestaoCCMatrizCategoria[] = []

  function flattenMatriz(cats: typeof allCats, depth: number) {
    for (const cat of cats) {
      const vals = aggCat(cat)
      if (vals.previsto === 0 && vals.realizado === 0) continue

      const variacao = cat.tipo === 'RECEITA'
        ? r2(vals.realizado - vals.previsto)
        : r2(vals.previsto  - vals.realizado)
      const pct = vals.previsto !== 0 ? r2((vals.realizado / vals.previsto) * 100) : null

      const orcAnual = r2(vals.orcAnual)
      const saldoAno = r2(orcAnual - vals.realizado)

      matriz.push({
        categoriaId:    cat.id,
        categoriaNome:  cat.nome_conta,
        codigoReduzido: cat.codigo_reduzido,
        tipo: cat.tipo as CategoriaTipo,
        previsto:  r2(vals.previsto),
        realizado: r2(vals.realizado),
        variacao, pct,
        orcamentoAnualTotal: orcAnual,
        saldoDisponivelAno: saldoAno,
        statusSemaforoAno: computeStatus(saldoAno),
        depth,
        hasChildren: hasVisibleChildren(cat),
        parentId: cat.parent_id,
      })

      if (cat.children && cat.children.length > 0) {
        flattenMatriz(cat.children, depth + 1)
      }
    }
  }
  flattenMatriz(catTree, 0)

  // Categorias-folha no contexto do CC:
  // Uma categoria é "pai no CC" se algum dos seus filhos (diretos) também está em catIdSet.
  // Categoriaspai não devem aparecer diretamente no extrato — seus valores já sobem via filhos.
  const parentsInCC = new Set(
    allCats
      .filter(c => c.parent_id !== null && catIdSet.has(c.parent_id) && catIdSet.has(c.id))
      .map(c => c.parent_id!)
  )
  const leafCatIds = catIds.filter(id => !parentsInCC.has(id))

  // 9. Extrato mensal com saldo corrido
  const mesesPeriodo = gerarMesesNoPeriodo(anoInicio, mesInicio, anoFim, mesFim)
  let saldoCorrente     = saldoInicialCC
  let totalEntradas     = 0, totalEntradasPrevisto = 0
  let totalSaidas       = 0, totalSaidasPrevisto   = 0

  const meses: GestaoCCMes[] = mesesPeriodo.map(({ ano, mes }) => {
    const mesKey  = ano * 100 + mes
    const mesReal = realPorMes.get(mesKey) ?? new Map<string, number>()
    const mesOrc  = orcPorMes.get(mesKey)  ?? new Map<string, number>()

    const categorias: GestaoCCCategoria[] = []
    let entradas = 0, saidas = 0
    let entradasPrevisto = 0, saidasPrevisto = 0

    // Usa apenas categorias-folha para evitar dupla contagem com categorias pai
    for (const catId of leafCatIds) {
      const cat     = catMap.get(catId)
      if (!cat) continue
      const valor   = mesReal.get(catId) ?? 0
      const previsto = mesOrc.get(catId) ?? 0
      if (valor === 0 && previsto === 0) continue

      categorias.push({
        categoriaId: catId,
        categoriaNome: cat.nome_conta,
        codigoReduzido: cat.codigo_reduzido,
        tipo: cat.tipo as CategoriaTipo,
        valor:   r2(valor),
        previsto: r2(previsto),
      })
      if (cat.tipo === 'RECEITA') { entradas += valor; entradasPrevisto += previsto }
      else { saidas += valor; saidasPrevisto += previsto }
    }
    categorias.sort((a, b) =>
      a.codigoReduzido.localeCompare(b.codigoReduzido, undefined, { numeric: true })
    )

    entradas = r2(entradas); saidas = r2(saidas)
    entradasPrevisto = r2(entradasPrevisto); saidasPrevisto = r2(saidasPrevisto)
    const resultado         = r2(entradas - saidas)
    const resultadoPrevisto = r2(entradasPrevisto - saidasPrevisto)
    const saldoInicial      = r2(saldoCorrente)
    const saldoFinal        = r2(saldoCorrente + resultado)

    totalEntradas         += entradas
    totalSaidas           += saidas
    totalEntradasPrevisto += entradasPrevisto
    totalSaidasPrevisto   += saidasPrevisto
    saldoCorrente          = saldoFinal

    return { ano, mes, saldoInicial, entradas, saidas, entradasPrevisto, saidasPrevisto, resultado, resultadoPrevisto, saldoFinal, categorias }
  })

  return {
    centroCustoId: cc.id,
    centroCustoNome: cc.nome,
    saldoInicial: saldoInicialCC,
    totalEntradas:         r2(totalEntradas),
    totalEntradasPrevisto: r2(totalEntradasPrevisto),
    totalSaidas:           r2(totalSaidas),
    totalSaidasPrevisto:   r2(totalSaidasPrevisto),
    resultado:             r2(totalEntradas - totalSaidas),
    resultadoPrevisto:     r2(totalEntradasPrevisto - totalSaidasPrevisto),
    saldoFinal:            r2(saldoCorrente),
    meses, matriz,
    periodo: { anoInicio, mesInicio, anoFim, mesFim },
    temSimulacao,
  }
}
