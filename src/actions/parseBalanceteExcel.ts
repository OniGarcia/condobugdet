'use server'

import * as xlsx from 'xlsx'
import { getCategoriasFlat } from './categorias'

// Mapeamento dos índices de coluna (0-based) na planilha "Balancete contabil.xlsx"
// Baseado na análise de: ` , ,,,Janeiro,,Fevereiro,,Março,,Abril,,Maio,,Junho,,,Julho,,Agosto,,` etc.
// Encontramos via script que:
// Jan: 3 (ou 4 dependendo se tem coluna Ocra, usando os dados reais é a primeira pos com número)
// Na real, a melhor forma é encontrar a linha "Janeiro", "Fevereiro", etc, e varrer a linha das contas.

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
    
    // Fetch DB Categories
    const categoriasDB = await getCategoriasFlat()
    
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    
    let headerRowIndex = -1
    // A mapping of month index (0=Jan) to the column index in the sheet
    const monthColIndices: Record<number, number> = {}

    // Find the Header Row that contains "Janeiro"
    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] || []
        let foundAnyMonth = false
        
        for (let col = 0; col < row.length; col++) {
            const cellVal = String(row[col] || '').trim().toLowerCase()
            
            // Try to match against our months list
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

    const payload: { categoria_id: string, ano: number, mes: number, valor_realizado: number }[] = []
    let accountsFound = 0;

    // Iterate the rows below the header
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] || []
      
      // We assume the account name/code is somewhere in the first few columns
      // Find the first non-empty string in the row
      let acctStr = ''
      for (let c = 0; c < 3; c++) {
          if (row[c] && typeof row[c] === 'string') {
              acctStr = row[c].trim()
              break
          }
      }

      if (!acctStr) continue;

      // Try to extract the code "1.1", "1.1.1.1.1" from "1.1 Taxa Condominial"
      const codeMatch = acctStr.match(/^([\d\.]+)/)
      if (!codeMatch) continue; // If doesn't start with numbers, it's not a valid account line

      const codigo_reduzido = codeMatch[1].trim()

      // Find in DB
      const dbCat = categoriasDB.find(c => c.codigo_reduzido === codigo_reduzido)
      if (!dbCat) continue; // Category not found or is a header that we skip
      
      accountsFound++;

      // Now grab the 12 months for this account
      for (let mesIdx = 0; mesIdx < 12; mesIdx++) {
          const colIdx = monthColIndices[mesIdx]
          if (colIdx !== undefined) {
              let val = row[colIdx];
              // Try parsing value
              if (typeof val === 'string') {
                 // Remove R$, spaces, and everything EXCEPT digits, commas, dots, and minus
                 let cleaned = val.replace(/[^\d,\.-]/g, '');
                 if (cleaned.includes(',')) {
                     // Brazilian format: 1.500,25
                     cleaned = cleaned.replace(/\./g, ''); // Remove thousands separator
                     cleaned = cleaned.replace(',', '.');  // Convert decimal
                 }
                 // If no comma, assume it's already using dot as decimal (e.g., 1500.25)
                 val = parseFloat(cleaned);
              }
              
              if (typeof val === 'number' && !isNaN(val)) {
                 payload.push({
                     categoria_id: dbCat.id,
                     ano: anoReferencia,
                     mes: mesIdx + 1, // 1-indexed (1 to 12)
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
        message: `Planilha lida! Foram processadas ${accountsFound} contas, totalizando ${payload.length} valores mensais extraídos para ${anoReferencia}.` 
    }

  } catch (err: any) {
    console.error('Error parsing Balancete Excel:', err)
    return { error: err.message || 'Falha desconhecida ao processar o arquivo.' }
  }
}
