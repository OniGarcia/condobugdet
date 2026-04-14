'use server'

import * as xlsx from 'xlsx'
import { getCategoriasFlat, createCategoria } from './categorias'
import { Categoria, CategoriaTipo } from '@/types'

/**
 * Parses the Trial Balance (Balancete) Excel and extracts realized values.
 * Automatically creates missing categories in the Chart of Accounts.
 */
export async function parseBalanceteExcel(formData: FormData, anoReferencia: number) {
  try {
    const file = formData.get('file') as File
    if (!file) return { error: 'Nenhum arquivo enviado.' }

    const buffer = await file.arrayBuffer()
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to strict 2D array matrix for easier parsing.
    const jsonData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
    
    // Fetch DB Categories and initialize a local Map for fast lookup and caching new ones
    const initialCats = await getCategoriasFlat()
    const catMap = new Map<string, Categoria>(initialCats.map(c => [c.codigo_reduzido, c]))
    const categoriesCreated: { codigo: string, nome: string }[] = []

    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    
    let headerRowIndex = -1
    const monthColIndices: Record<number, number> = {}

    // Find the Header Row that contains "Janeiro"
    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] || []
        let foundAnyMonth = false
        
        for (let col = 0; col < row.length; col++) {
            const cellVal = String(row[col] || '').trim().toLowerCase()
            
            mesesNomes.forEach((nomeMes, mesIdx) => {
                if (cellVal === nomeMes.toLowerCase()) {
                    monthColIndices[mesIdx] = col;
                    foundAnyMonth = true
                }
            })
        }
        
        if (foundAnyMonth) {
            headerRowIndex = i
            break
        }
    }

    if (headerRowIndex === -1 || Object.keys(monthColIndices).length === 0) {
        return { error: 'Não foi possível encontrar o cabeçalho com os meses (Janeiro, Fevereiro, etc.) na planilha.' }
    }

    // Helper to get or create category recursively
    const getOrCreateCategory = async (codigo: string, fullName: string): Promise<Categoria | null> => {
        // 1. Check local cache
        if (catMap.has(codigo)) return catMap.get(codigo)!

        // 2. Determine parent if applicable
        let parentId: string | undefined = undefined
        const lastDot = codigo.lastIndexOf('.')
        if (lastDot > 0) {
            const parentCode = codigo.substring(0, lastDot)
            // Recursive call for parent. We might not have the parent's full name if it's not in the sheet yet,
            // so we use the parent code as name for now (it will be updated if it appears later in the sheet).
            const parent = await getOrCreateCategory(parentCode, parentCode)
            if (parent) parentId = parent.id
        }

        // 3. Create the new category
        const tipo: CategoriaTipo = codigo.startsWith('1') ? 'RECEITA' : 'DESPESA'
        // Extract name: remove the code from the beginning
        const nome = fullName.replace(codigo, '').trim() || codigo
        
        console.log(`Creating missing category: ${codigo} - ${nome} (${tipo})`)
        const result = await createCategoria({
            codigo_reduzido: codigo,
            nome_conta: nome,
            tipo,
            parent_id: parentId
        })

        if (result.error) {
            console.error(`Failed to auto-create category ${codigo}:`, result.error)
            return null
        }

        const newCat = result.data as Categoria
        catMap.set(codigo, newCat)
        categoriesCreated.push({ codigo, nome: newCat.nome_conta })
        return newCat
    }

    const payload: { categoria_id: string, ano: number, mes: number, valor_realizado: number }[] = []
    let accountsFound = 0;

    // Iterate the rows below the header
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || []
      
      let acctStr = ''
      for (let c = 0; c < 3; c++) {
          if (row[c] && typeof row[c] === 'string' && row[c].trim().length > 0) {
              acctStr = row[c].trim()
              break
          }
      }

      if (!acctStr) continue;

      const codeMatch = acctStr.match(/^([\d\.]+)/)
      if (!codeMatch) continue; 

      const codigo_reduzido = codeMatch[1].trim()

      // Find or Create in DB
      const dbCat = await getOrCreateCategory(codigo_reduzido, acctStr)
      if (!dbCat) continue; // Skip if creation failed
      
      accountsFound++;

      // Now grab the 12 months for this account
      for (let mesIdx = 0; mesIdx < 12; mesIdx++) {
          const colIdx = monthColIndices[mesIdx]
          if (colIdx !== undefined) {
              let val = row[colIdx];
              if (typeof val === 'string') {
                  let cleaned = val.replace(/[^\d,\.-]/g, '');
                  if (cleaned.includes(',')) {
                      cleaned = cleaned.replace(/\./g, ''); 
                      cleaned = cleaned.replace(',', '.');  
                  }
                  val = parseFloat(cleaned);
              }
              
              if (typeof val === 'number' && !isNaN(val) && val !== 0) {
                  payload.push({
                      categoria_id: dbCat.id,
                      ano: anoReferencia,
                      mes: mesIdx + 1, 
                      valor_realizado: val
                  })
              }
          }
      }
    }

    return { 
        success: true, 
        data: payload, 
        accountsFound, 
        categoriesCreated,
        message: `Planilha lida! Foram processadas ${accountsFound} contas, totalizando ${payload.length} lançamentos para ${anoReferencia}.` 
    }

  } catch (err: any) {
    console.error('Error parsing Balancete Excel:', err)
    return { error: err.message || 'Falha desconhecida ao processar o arquivo.' }
  }
}
