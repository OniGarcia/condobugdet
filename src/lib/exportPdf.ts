import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

interface ExportPdfOptions {
  filename?: string
  margin?: number
  quality?: number
}

/** CSS injected temporarily to override the dark theme for a clean, high-contrast PDF output */
const PRINT_OVERRIDE_CSS = `
  /* ── Root reset ── */
  [data-pdf-root], [data-pdf-root] * {
    color-scheme: light !important;
  }

  /* ── Font size reduction for compact PDF layout ── */
  [data-pdf-root] [class*="text-xl"],
  [data-pdf-root] [class*="text-2xl"],
  [data-pdf-root] [class*="text-3xl"] {
    font-size: 13px !important;
    line-height: 1.3 !important;
  }
  [data-pdf-root] [class*="text-lg"] {
    font-size: 12px !important;
    line-height: 1.3 !important;
  }
  [data-pdf-root] [class*="text-sm"] {
    font-size: 11px !important;
  }
  [data-pdf-root] [class*="text-xs"] {
    font-size: 10px !important;
  }
  [data-pdf-root] [class*="text-\\[10px\\]"] {
    font-size: 9px !important;
  }

  /* ── KPI Card layout tightening ── */
  [data-pdf-root] [class*="gap-2\\.5"],
  [data-pdf-root] [class*="gap-3"],
  [data-pdf-root] [class*="gap-4"] {
    gap: 4px !important;
  }
  [data-pdf-root] [class*="p-5"] {
    padding: 8px !important;
  }
  [data-pdf-root] [class*="mt-2"] {
    margin-top: 4px !important;
  }
  /* Ensure Previsto label + value don't collide */
  [data-pdf-root] [class*="text-neutral-600"] + [class*="tabular-nums"] {
    margin-left: 4px !important;
  }

  /* ── Backgrounds ── */
  [data-pdf-root] {
    background: #ffffff !important;
    border-color: #e5e7eb !important;
  }
  [data-pdf-root] [class*="bg-white/"],
  [data-pdf-root] [class*="bg-black/"],
  [data-pdf-root] [class*="backdrop-blur"] {
    background: #f8fafc !important;
    backdrop-filter: none !important;
  }
  [data-pdf-root] [class*="bg-emerald-500/"] {
    background: #d1fae5 !important;
  }
  [data-pdf-root] [class*="bg-red-500/"] {
    background: #fee2e2 !important;
  }
  [data-pdf-root] [class*="bg-sky-500/"] {
    background: #e0f2fe !important;
  }
  [data-pdf-root] [class*="bg-amber-500/"] {
    background: #fef3c7 !important;
  }
  [data-pdf-root] [class*="bg-gradient"],
  [data-pdf-root] [class*="from-emerald"] {
    background: #f0fdf4 !important;
  }

  /* ── Text colours ── */
  [data-pdf-root] [class*="text-neutral-200"],
  [data-pdf-root] [class*="text-neutral-300"],
  [data-pdf-root] [class*="text-neutral-400"] {
    color: #374151 !important;
  }
  [data-pdf-root] [class*="text-neutral-500"],
  [data-pdf-root] [class*="text-neutral-600"],
  [data-pdf-root] [class*="text-neutral-700"] {
    color: #6b7280 !important;
  }
  [data-pdf-root] .text-white {
    color: #111827 !important;
  }

  /* Semantic colours — vivid on white */
  [data-pdf-root] [class*="text-emerald-400"],
  [data-pdf-root] [class*="text-emerald-300"] { color: #059669 !important; }
  [data-pdf-root] [class*="text-red-400"],
  [data-pdf-root] [class*="text-red-300"]     { color: #dc2626 !important; }
  [data-pdf-root] [class*="text-sky-400"]     { color: #0284c7 !important; }
  [data-pdf-root] [class*="text-amber-400"],
  [data-pdf-root] [class*="text-amber-300"]   { color: #d97706 !important; }
  [data-pdf-root] [class*="text-emerald-600"] { color: #047857 !important; }
  [data-pdf-root] [class*="text-red-600"]     { color: #b91c1c !important; }

  /* ── Borders ── */
  [data-pdf-root] [class*="border-white/"],
  [data-pdf-root] [class*="border-white"]     { border-color: #d1d5db !important; }
  [data-pdf-root] [class*="border-emerald-500/"] { border-color: #6ee7b7 !important; }
  [data-pdf-root] [class*="border-red-500/"]     { border-color: #fca5a5 !important; }
  [data-pdf-root] [class*="border-t-2"]           { border-color: #d1d5db !important; }

  /* ── Badge / pill overrides ── */
  [data-pdf-root] [class*="bg-emerald-500/10"],
  [data-pdf-root] [class*="bg-emerald-500/15"] {
    background: #d1fae5 !important;
    border-color: #6ee7b7 !important;
  }
  [data-pdf-root] [class*="bg-red-500/10"],
  [data-pdf-root] [class*="bg-red-500/15"] {
    background: #fee2e2 !important;
    border-color: #fca5a5 !important;
  }
  [data-pdf-root] [class*="bg-amber-500/10"] { background: #fef3c7 !important; }
  [data-pdf-root] [class*="bg-sky-500/5"]    { background: #f0f9ff !important; }
`

// ─── Smart page-break helper ──────────────────────────────────────────────────

/**
 * Returns an array of Y positions (in canvas pixels, relative to `root`)
 * where it is safe to cut the page — i.e. between the bottom of one
 * table row and the top of the next, never mid-row.
 */
function buildSafeBreakpoints(root: HTMLElement, scale: number): number[] {
  const rootRect = root.getBoundingClientRect()
  const rows = Array.from(root.querySelectorAll<HTMLElement>('tr, [data-pdf-row]'))

  const breakpoints: number[] = []
  for (const row of rows) {
    const rect = row.getBoundingClientRect()
    // bottom edge of this row in canvas pixels
    const bottom = (rect.bottom - rootRect.top) * scale
    breakpoints.push(bottom)
  }

  // Remove duplicates, sort ascending
  return [...new Set(breakpoints)].sort((a, b) => a - b)
}

/**
 * Given a desired cut position and the list of safe breakpoints,
 * returns the largest safe breakpoint that is ≤ maxY.
 * Falls back to maxY if no safe point found (guarantees progress).
 */
function findSafeCut(maxY: number, breakpoints: number[], minY: number): number {
  let best = -1
  for (const bp of breakpoints) {
    if (bp > minY && bp <= maxY) best = bp
  }
  // If no breakpoint fits, just cut at maxY to avoid infinite loop
  return best > 0 ? best : maxY
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportElementToPdf(
  element: HTMLElement,
  options: ExportPdfOptions = {},
): Promise<void> {
  const {
    filename = 'relatorio.pdf',
    margin = 10,
    quality = 3,
  } = options

  // 1. Inject high-contrast override stylesheet
  const styleEl = document.createElement('style')
  styleEl.id = '__pdf-override__'
  styleEl.textContent = PRINT_OVERRIDE_CSS
  document.head.appendChild(styleEl)

  // 2. Mark the target element so CSS selectors are scoped
  element.setAttribute('data-pdf-root', '1')

  // 3. Wait two frames so browser fully applies the injected styles
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => requestAnimationFrame(r))

  try {
    // 4. Build safe cut points BEFORE the canvas snapshot
    //    (we need live DOM positions while element still rendered)
    const safeBreakpoints = buildSafeBreakpoints(element, quality)

    const canvas = await html2canvas(element, {
      scale: quality,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
    })

    const imgWidth  = canvas.width
    const imgHeight = canvas.height

    const pdfWidth     = 297  // A4 landscape width in mm
    const pdfHeight    = 210  // A4 landscape height in mm
    const contentWidth  = pdfWidth  - margin * 2
    const contentHeight = pdfHeight - margin * 2

    // px per mm — how many canvas pixels fit in one PDF page vertically
    const pixelsPerPage = contentHeight / (contentWidth / imgWidth)

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const ratio = contentWidth / imgWidth

    let position  = 0   // current Y in canvas pixels
    let pageNum   = 0

    while (position < imgHeight) {
      if (pageNum > 0) pdf.addPage()

      // Find the safe cut: largest row-bottom that fits within this page
      const maxCut = Math.min(position + pixelsPerPage, imgHeight)
      const cutAt  = position + pixelsPerPage >= imgHeight
        ? imgHeight                                      // last page — take the rest
        : findSafeCut(maxCut, safeBreakpoints, position)

      const sliceHeight = cutAt - position

      // Draw the slice onto a fresh canvas
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width  = imgWidth
      sliceCanvas.height = Math.ceil(sliceHeight)
      const ctx = sliceCanvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
      ctx.drawImage(
        canvas,
        0, position,
        imgWidth, sliceHeight,
        0, 0,
        imgWidth, sliceHeight,
      )

      const sliceData     = sliceCanvas.toDataURL('image/png')
      const sliceScaledH  = sliceHeight * ratio

      pdf.addImage(sliceData, 'PNG', margin, margin, contentWidth, sliceScaledH)

      position = cutAt
      pageNum++
    }

    pdf.save(filename)
  } finally {
    // 5. Always restore dark theme
    element.removeAttribute('data-pdf-root')
    document.head.removeChild(styleEl)
  }
}
