'use server'

import * as xlsx from 'xlsx'
import { createClient } from '@/lib/supabase/server'

export async function parseBudgetExcel(formData: FormData) {
  const file = formData.get('file') as File
  if (!file) {
    return { error: 'Nenhum arquivo enviado.' }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Parse the file
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Read as 2D array
    const data: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let headerIndex = -1;
    let mediaColIndex = -1;

    // Find the header row (containing 'Categorias' and 'Média' or similar)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const firstCell = String(row[0] || '').trim().toLowerCase();
      // Tenta cruzar headers comuns
      if (firstCell === 'categorias' || firstCell.includes('categoria')) {
        headerIndex = i;
        // Search for 'Média' in this row (looking through all columns since it varies)
        for (let j = 0; j < row.length; j++) {
           const cell = String(row[j] || '').trim().toLowerCase();
           if (cell === 'média' || cell === 'media' || cell.includes('méd') || cell.includes('med')) {
             mediaColIndex = j;
             break;
           }
        }
        break;
      }
    }

    if (headerIndex === -1) {
       return { error: 'Não foi possível encontrar a linha principal de cabeçalho "Categorias" no Excel.' }
    }
    if (mediaColIndex === -1) {
       return { error: 'Não foi possível encontrar a coluna "Média" na mesma linha de cabeçalho que "Categorias".' }
    }

    // Fetch DB mapping
    const supabase = await createClient();
    const { data: dbCategories, error: dbError } = await supabase
       .from('categorias')
       .select('id, codigo_reduzido');
       
    if (dbError) throw dbError;

    const results = [];
    
    // Loop mapping
    for (let i = headerIndex + 1; i < data.length; i++) {
       const row = data[i];
       if (!row || !row[0]) continue;
       
       const descStr = String(row[0]).trim();
       const valueStr = row[mediaColIndex];
       
       // Match pattern: "2.1.2 Nome"
       const match = descStr.match(/^([\d\.]+)\s+(.*)/);
       if (match) {
         const codigo = match[1];
         // Sanitize numeric val
         let val = 0;
         if (typeof valueStr === 'number') {
            val = valueStr;
          } else if (typeof valueStr === 'string') {
             // Clean strings: e.g. "R$ 1.500.250,00"
             let cleaned = valueStr.replace(/[^\d,\.-]/g, '');
             if (cleaned.includes(',')) {
                 cleaned = cleaned.replace(/\./g, '');
                 cleaned = cleaned.replace(',', '.');
             }
             val = parseFloat(cleaned);
          }
         
         if (isNaN(val)) val = 0;

         const catObj = dbCategories.find(c => c.codigo_reduzido === codigo);
         if (catObj && val !== 0) {
            results.push({
               categoria_id: catObj.id,
               valor: val,
               codigo_reduzido: codigo
            });
         }
       }
    }

    return { success: true, count: results.length, data: results };

  } catch (error: any) {
    console.error('Error importing Budget XL:', error);
    return { error: error.message || 'Erro ao processar o arquivo Excel.' };
  }
}
