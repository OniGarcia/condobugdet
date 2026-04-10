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
  cutoffAno?: number,
  cutoffMes?: number,
): Promise<GestaoCCResult | null> {
  if (!centroCustoId || centroCustoId === 'all') return null

  const { condoId } = await validateAccess()
  const supabase = await createClient()
  const startKey = anoInicio * 100 + mesInicio
  const endKey   = anoFim   * 100 + mesFim
  const temSimulacao = !!(simulacaoId && simulacaoId !== '')

  // Chave de corte: se não informada, assume um futuro distante
  const cutoffKey = (cutoffAno && cutoffMes) ? (cutoffAno * 100 + cutoffMes) : 999999

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
      totalEntradas: 0, totalEntradasPrevisto: 0, totalEntradasPrevistoAnual: 0,
      totalSaidas: 0, totalSaidasPrevisto: 0, totalSaidasPrevistoAnual: 0,
      totalMetaEntradasPct: null, totalMetaSaidasPct: null,
      resultado: 0, resultadoPrevisto: 0, resultadoPrevistoAnual: 0,
      saldoFinal: saldoInicialCC,
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
    if (k > cutoffKey) continue // Filtra dados realizados após o corte
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
  const orcAcumuladoAtéCorte = new Map<string, number>()
  const orcAnualPorCat = new Map<string, number>()

  for (const r of realData) {
    const k = Number(r.ano) * 100 + Number(r.mes)
    if (k < startKey || k > endKey) continue
    if (k > cutoffKey) continue // Filtra dados realizados após o corte (para matriz)
    realPorCat.set(r.categoria_id, r2((realPorCat.get(r.categoria_id) ?? 0) + Number(r.valor_realizado || 0)))
  }
  for (const o of orcData) {
    const k = Number(o.ano) * 100 + Number(o.mes)
    if (k < startKey || k > endKey) continue
    orcPorCat.set(o.categoria_id, r2((orcPorCat.get(o.categoria_id) ?? 0) + Number(o.valor_previsto || 0)))
    
    // Calcula o acumulado do orçamento até a data de corte
    if (k <= cutoffKey) {
      orcAcumuladoAtéCorte.set(o.categoria_id, r2((orcAcumuladoAtéCorte.get(o.categoria_id) ?? 0) + Number(o.valor_previsto || 0)))
    }
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

  interface CatVals { previsto: number; realizado: number; orcAnual: number; acumCorte: number }
  const ZERO: CatVals = { previsto: 0, realizado: 0, orcAnual: 0, acumCorte: 0 }

  // Agrega recursivamente das folhas para cima, filtrando só catIds do CC
  function aggCat(cat: typeof allCats[0]): CatVals {
    if (!cat.children || cat.children.length === 0) {
      if (!catIdSet.has(cat.id)) return { ...ZERO }
      return {
        previsto:  r2(orcPorCat.get(cat.id)  ?? 0),
        realizado: r2(realPorCat.get(cat.id) ?? 0),
        orcAnual:  r2(orcAnualPorCat.get(cat.id) ?? 0),
        acumCorte: r2(orcAcumuladoAtéCorte.get(cat.id) ?? 0),
      }
    }
    const agg: CatVals = { previsto: 0, realizado: 0, orcAnual: 0, acumCorte: 0 }
    for (const child of cat.children) {
      const cv = aggCat(child)
      agg.previsto  += cv.previsto
      agg.realizado += cv.realizado
      agg.orcAnual  += cv.orcAnual
      agg.acumCorte += cv.acumCorte
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
        ? r2(vals.realizado - vals.acumCorte)
        : r2(vals.acumCorte  - vals.realizado)
      
      const pct = vals.acumCorte !== 0 ? r2((vals.realizado / vals.acumCorte) * 100) : null
      const metaPct = vals.orcAnual !== 0 ? r2((vals.acumCorte / vals.orcAnual) * 100) : null

      const orcAnual = r2(vals.orcAnual)
      const saldoAno = r2(orcAnual - vals.realizado)

      matriz.push({
        categoriaId:    cat.id,
        categoriaNome:  cat.nome_conta,
        codigoReduzido: cat.codigo_reduzido,
        tipo: cat.tipo as CategoriaTipo,
        previsto:  r2(vals.acumCorte),
        realizado: r2(vals.realizado),
        metaPct,
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
  const parentsInCC = new Set(
    allCats
      .filter(c => c.parent_id !== null && catIdSet.has(c.parent_id) && catIdSet.has(c.id))
      .map(c => c.parent_id!)
  )
  const leafCatIds = catIds.filter(id => !parentsInCC.has(id))

  // 9. Extrato mensal com saldo corrido
  // Agora calculamos os totais globais a partir da matriz (roots) para garantir consistência total
  const roots = matriz.filter(r => r.depth === 0)
  
  const totalRealEntradas     = r2(roots.filter(r => r.tipo === 'RECEITA').reduce((acc, r) => acc + r.realizado, 0))
  const totalOrcTargetEntradas = r2(roots.filter(r => r.tipo === 'RECEITA').reduce((acc, r) => acc + r.previsto, 0))
  const totalOrcAnualEntradas  = r2(roots.filter(r => r.tipo === 'RECEITA').reduce((acc, r) => acc + r.orcamentoAnualTotal, 0))
  
  const totalRealSaidas       = r2(roots.filter(r => r.tipo === 'DESPESA').reduce((acc, r) => acc + r.realizado, 0))
  const totalOrcTargetSaidas   = r2(roots.filter(r => r.tipo === 'DESPESA').reduce((acc, r) => acc + r.previsto, 0))
  const totalOrcAnualSaidas    = r2(roots.filter(r => r.tipo === 'DESPESA').reduce((acc, r) => acc + r.orcamentoAnualTotal, 0))

  // Meta do período % (ex: 4 meses / 12 meses = 33.3%)
  const totalMetaEntradasPct = totalOrcAnualEntradas !== 0 ? r2((totalOrcTargetEntradas / totalOrcAnualEntradas) * 100) : null
  const totalMetaSaidasPct   = totalOrcAnualSaidas   !== 0 ? r2((totalOrcTargetSaidas   / totalOrcAnualSaidas)   * 100) : null

  const mesesPeriodo = gerarMesesNoPeriodo(anoInicio, mesInicio, anoFim, mesFim)
  let saldoCorrente = saldoInicialCC

  const meses: GestaoCCMes[] = mesesPeriodo.map(({ ano, mes }) => {
    const mesKey  = ano * 100 + mes
    const mesReal = realPorMes.get(mesKey) ?? new Map<string, number>()
    const mesOrc  = orcPorMes.get(mesKey)  ?? new Map<string, number>()

    const categorias: GestaoCCCategoria[] = []
    let entradas = 0, saidas = 0
    let entradasPrevisto = 0, saidasPrevisto = 0

    for (const catId of leafCatIds) {
      const cat     = catMap.get(catId)
      if (!cat) continue
      const valor   = mesReal.get(catId) ?? 0
      const previsto = mesOrc.get(catId) ?? 0
      if (valor === 0 && previsto === 0) continue

      const mPct = previsto !== 0 ? r2(((orcAcumuladoAtéCorte.get(catId) || 0) / previsto) * 100) : null

      categorias.push({
        categoriaId: catId,
        categoriaNome: cat.nome_conta,
        codigoReduzido: cat.codigo_reduzido,
        tipo: cat.tipo as CategoriaTipo,
        valor:   r2(valor),
        previsto: r2(previsto),
        metaPct: mPct,
      })
      if (cat.tipo === 'RECEITA') { entradas += valor; entradasPrevisto += previsto }
      else { saidas += valor; saidasPrevisto += previsto }
    }
    categorias.sort((a, b) =>
      a.codigoReduzido.localeCompare(b.codigoReduzido, undefined, { numeric: true })
    )

    entradas = r2(entradas); saidas = r2(saidas)
    const resultado         = r2(entradas - saidas)
    const saldoInicial      = r2(saldoCorrente)
    const saldoFinal        = r2(saldoCorrente + resultado)
    saldoCorrente           = saldoFinal

    return { 
      ano, mes, saldoInicial, entradas, saidas, 
      entradasPrevisto: r2(entradasPrevisto), saidasPrevisto: r2(saidasPrevisto),
      resultado, resultadoPrevisto: r2(entradasPrevisto - saidasPrevisto), 
      saldoFinal, categorias 
    }
  })

  return {
    centroCustoId: cc.id,
    centroCustoNome: cc.nome,
    saldoInicial: saldoInicialCC,
    totalEntradas:              totalRealEntradas,
    totalEntradasPrevisto:      totalOrcTargetEntradas,
    totalEntradasPrevistoAnual: totalOrcAnualEntradas,
    totalSaidas:                totalRealSaidas,
    totalSaidasPrevisto:        totalOrcTargetSaidas,
    totalSaidasPrevistoAnual:   totalOrcAnualSaidas,
    totalMetaEntradasPct,
    totalMetaSaidasPct,
    resultado:             r2(totalRealEntradas - totalRealSaidas),
    resultadoPrevisto:     r2(totalOrcTargetEntradas - totalOrcTargetSaidas),
    resultadoPrevistoAnual: r2(totalOrcAnualEntradas - totalOrcAnualSaidas),
    saldoFinal:            r2(saldoCorrente),
    meses: meses.filter(m => (m.ano * 100 + m.mes) <= cutoffKey),
    matriz,
    periodo: { anoInicio, mesInicio, anoFim, mesFim },
    temSimulacao,
  }
}
