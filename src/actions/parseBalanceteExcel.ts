'use server'

import * as xlsx from 'xlsx'
import { getCategoriasFlat, createCategoria } from './categorias'
import { Categoria, CategoriaTipo } from '@/types'
import { validateAccess } from '@/lib/supabase/validateAccess'

/**
 * Parses the Trial Balance (Balancete) Excel and extracts realized values.
 * Automatically creates missing categories in the Chart of Accounts.
 */
export async function parseBalanceteExcel(formData: FormData, anoReferencia: number, condoId: string) {
  try {
    const { role } = await validateAccess('gestor')
    
    const file = formData.get('file') as File
    if (!file) return { error: 'Nenhum arquivo enviado.' }

    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    const jsonData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
    
    // 0. Pre-fetch ALL categories for THIS condo only to avoid picking duplicates from other condos
    const initialCats = (await getCategoriasFlat(condoId)).filter(c => c.condo_id === condoId)
    const catMap = new Map<string, Categoria>(initialCats.map(c => [c.codigo_reduzido, c]))
    const categoriesCreated: { codigo: string, nome: string }[] = []

    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    
    let headerRowIndex = -1
    const monthColIndices: Record<number, number> = {}

    // 1. Improved Header Discovery (scans first 10 rows for month names)
    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
        const row = jsonData[i] || []
        let foundCount = 0
        
        for (let col = 0; col < row.length; col++) {
            const cellVal = String(row[col] || '').trim().toLowerCase()
            const mesIdx = mesesNomes.findIndex(m => m.toLowerCase() === cellVal)
            if (mesIdx !== -1) {
                monthColIndices[mesIdx] = col
                foundCount++
            }
        }
        
        if (foundCount >= 3) { // Require at least 3 months to identify header
            headerRowIndex = i
            break
        }
    }

    if (headerRowIndex === -1 || Object.keys(monthColIndices).length === 0) {
        return { error: 'Não foi possível identificar o cabeçalho dos meses na planilha.' }
    }

    const getOrCreateCategory = async (codigo: string, fullName: string): Promise<Categoria | null> => {
        if (catMap.has(codigo)) return catMap.get(codigo)!

        let parentId: string | undefined = undefined
        const lastDot = codigo.lastIndexOf('.')
        if (lastDot > 0) {
            const parentCode = codigo.substring(0, lastDot)
            const parent = await getOrCreateCategory(parentCode, parentCode)
            if (parent) parentId = parent.id
        }

        const tipo: CategoriaTipo = codigo.startsWith('1') ? 'RECEITA' : 'DESPESA'
        const nome = fullName.replace(codigo, '').trim() || codigo
        
        const result = await createCategoria({ codigo_reduzido: codigo, nome_conta: nome, tipo, parent_id: parentId, condo_id: condoId })
        if (result.error) return null

        const newCat = result.data as Categoria
        catMap.set(codigo, newCat)
        categoriesCreated.push({ codigo, nome: newCat.nome_conta })
        return newCat
    }

    /**
     * Parses a raw cell value into a clean float.
     * Handles Brazilian number format: dots = thousands separator, comma = decimal.
     * Also handles trailing minus (e.g. "1.234,56-") and parentheses "(1.234,56)".
     */
    const parseCurrency = (val: any): number => {
        if (typeof val === 'number') return val
        if (typeof val !== 'string') return 0

        let str = val.trim()
        if (!str || str === '-' || str === '.') return 0

        // Handle parentheses: (1.234,56) -> negative
        const isNegativeParens = str.startsWith('(') && str.endsWith(')')
        if (isNegativeParens) str = str.slice(1, -1)

        // Handle trailing minus: 1.234,56- -> negative
        const isNegativeTrailing = str.endsWith('-')
        if (isNegativeTrailing) str = str.slice(0, -1)

        // Brazilian format often uses dot as thousand separator and comma as decimal.
        // But some systems might export dot as decimal.
        // Rule: if it has a comma, the comma is the decimal separator and dots are thousand separators.
        // If it has NO comma but has a dot, we check if it looks like a thousand separator or decimal.
        
        str = str.replace(/[R$\s]/g, '') // Remove currency and spaces

        if (str.includes(',')) {
            str = str.replace(/\./g, '').replace(',', '.')
        } else {
            // No comma. If it has a dot, check if it's likely a decimal separator (e.g. 12.34) 
            // or a thousand separator (e.g. 1.234). 
            // Most Brazilian reports with no decimals would write "1234" or "1.234".
            // If the dot is followed by exactly 3 digits and it's the only dot, it's likely a thousand separator.
            const dotCount = (str.match(/\./g) || []).length
            if (dotCount === 1) {
                const parts = str.split('.')
                if (parts[1].length === 3) {
                    str = str.replace('.', '') // Thousand separator
                }
            } else if (dotCount > 1) {
                str = str.replace(/\./g, '') // Multiple dots -> thousand separators
            }
        }

        const result = parseFloat(str)
        if (isNaN(result)) return 0

        return (isNegativeParens || isNegativeTrailing) ? -result : result
    }

    // 5. Build payload (Summing values for the same category/month if they appear multiple times)
    const payloadMap = new Map<string, any>()
    const monthsFound = new Set<number>()
    let accountsFound = 0

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || []
      
      let acctStr = ''
      for (let c = 0; c < 3; c++) {
        if (row[c] && typeof row[c] === 'string' && (row[c] as string).trim().length > 0) {
          acctStr = (row[c] as string).trim()
          break
        }
      }
      
      const codeMatch = acctStr.match(/^([\d\.]+)/)
      if (!codeMatch) continue; 

      const dbCat = await getOrCreateCategory(codeMatch[1].trim(), acctStr)
      if (!dbCat) continue;
      
      accountsFound++;

      for (let mesIdx = 0; mesIdx < 12; mesIdx++) {
          const colIdx = monthColIndices[mesIdx]
          if (colIdx !== undefined) {
              const val = parseCurrency(row[colIdx])
              if (val !== 0) {
                  monthsFound.add(mesIdx)
                  const key = `${dbCat.id}_${mesIdx + 1}`
                  const existing = payloadMap.get(key)
                  if (existing) {
                    existing.valor_realizado += val
                  } else {
                    payloadMap.set(key, { 
                      categoria_id: dbCat.id, 
                      ano: anoReferencia, 
                      mes: mesIdx + 1, 
                      valor_realizado: val 
                    })
                  }
              }
          }
      }
    }

    const payload = Array.from(payloadMap.values())

    return { 
        success: true, 
        data: payload, 
        accountsFound, 
        categoriesCreated,
        monthsFound: Array.from(monthsFound),
        message: `Planilha lida! Foram processadas ${accountsFound} contas, totalizando ${payload.length} lançamentos para ${anoReferencia}.` 
    }
  } catch (err: any) {
    return { error: err.message || 'Falha ao processar arquivo.' }
  }
}
