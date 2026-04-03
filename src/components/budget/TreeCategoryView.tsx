'use client'

import { useState, useRef, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { Categoria } from '@/types'
import {
  ChevronRight, ChevronDown, Plus, Edit, Trash2,
  Folder, FolderOpen, FileText, Upload, X, AlertTriangle, Check, Loader2
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  createCategoria,
  updateCategoria,
  deleteCategoria,
  checkCategoriaVinculos,
  transferAndDeleteCategoria,
} from '@/actions/categorias'
import { importCategoryTree } from '@/actions/importCategoryTree'

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs))
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'none' }
  | { type: 'create'; parentId: string | null; parentCodigo: string | null }
  | { type: 'edit'; categoria: Categoria }
  | { type: 'delete-confirm'; categoria: Categoria }
  | { type: 'delete-transfer'; categoria: Categoria; vinculos: { orcamentos: number; realizados: number } }

// ─── Main Component ────────────────────────────────────────────────────────────
export function TreeCategoryView({ data, allFlat }: { data: Categoria[]; allFlat: Categoria[] }) {
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [isPending, startTransition] = useTransition()
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; errors?: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeModal = () => setModal({ type: 'none' })

  // ─── XLSX Import ─────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    // Extract rows - column B is nome/code combined, column C may have codigo_reduzido
    const rows = rawRows
      .slice(5) // skip the header rows
      .map((row: any[]) => ({
        conta: String(row[1] ?? '').trim(),
        codigo: row[2] ? String(row[2]).trim() : null,
      }))
      .filter(r => r.conta.length > 0)

    startTransition(async () => {
      const result = await importCategoryTree(rows)
      if ('error' in result) {
        alert(`Erro na importação: ${result.error}`)
      } else {
        setImportResult(result)
      }
    })

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Delete Flow ──────────────────────────────────────────────────────────────
  const handleDeleteClick = (categoria: Categoria) => {
    startTransition(async () => {
      const vinculos = await checkCategoriaVinculos(categoria.id)
      if (vinculos.orcamentos > 0 || vinculos.realizados > 0) {
        setModal({ type: 'delete-transfer', categoria, vinculos })
      } else {
        setModal({ type: 'delete-confirm', categoria })
      }
    })
  }

  const handleDeleteConfirm = (id: string) => {
    startTransition(async () => {
      await deleteCategoria(id)
      closeModal()
    })
  }

  const handleTransferAndDelete = (fromId: string, toId: string) => {
    startTransition(async () => {
      const result = await transferAndDeleteCategoria(fromId, toId)
      if (result.error) alert(result.error)
      closeModal()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Plano de Contas</h2>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg text-sm font-medium transition-colors border border-blue-500/20 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar XLSX
          </button>
          <button
            onClick={() => setModal({ type: 'create', parentId: null, parentCodigo: null })}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Nova Categoria
          </button>
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Importação concluída!</span>{' '}
            {importResult.inserted} inseridas · {importResult.updated} atualizadas.
            {importResult.errors && importResult.errors.length > 0 && (
              <p className="text-amber-400 mt-1">⚠ {importResult.errors.length} erros: {importResult.errors.join('; ')}</p>
            )}
          </div>
          <button onClick={() => setImportResult(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tree */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-2">
          {data.length === 0 ? (
            <div className="text-center p-12 text-neutral-500 text-sm">
              <Upload className="w-8 h-8 mx-auto mb-3 opacity-30" />
              Nenhuma categoria. Importe o modelo XLSX ou crie manualmente.
            </div>
          ) : (
            <div className="space-y-0.5">
              {data.map(cat => (
                <CategoryNode
                  key={cat.id}
                  node={cat}
                  depth={0}
                  onEdit={c => setModal({ type: 'edit', categoria: c })}
                  onDelete={handleDeleteClick}
                  onAddChild={c => setModal({ type: 'create', parentId: c.id, parentCodigo: c.codigo_reduzido })}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals ────────────────────────────────────────────────────────────── */}

      {/* Create / Edit Modal */}
      {(modal.type === 'create' || modal.type === 'edit') && (
        <CategoryFormModal
          modal={modal}
          onClose={closeModal}
          isPending={isPending}
          onSubmit={(formData) => {
            startTransition(async () => {
              if (modal.type === 'create') {
                await createCategoria({
                  ...formData,
                  parent_id: modal.parentId,
                })
              } else {
                await updateCategoria(modal.categoria.id, formData)
              }
              closeModal()
            })
          }}
        />
      )}

      {/* Delete Confirmation (no linked data) */}
      {modal.type === 'delete-confirm' && (
        <ConfirmModal
          title="Excluir Categoria"
          message={`Deseja excluir permanentemente "${modal.categoria.nome_conta}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Sim, excluir"
          danger
          onCancel={closeModal}
          onConfirm={() => handleDeleteConfirm(modal.categoria.id)}
          isPending={isPending}
        />
      )}

      {/* Delete with Transfer (has linked data) */}
      {modal.type === 'delete-transfer' && (
        <TransferModal
          categoria={modal.categoria}
          vinculos={modal.vinculos}
          allFlat={allFlat.filter(c => c.id !== modal.categoria.id)}
          onCancel={closeModal}
          onConfirm={(toId) => handleTransferAndDelete(modal.categoria.id, toId)}
          isPending={isPending}
        />
      )}
    </div>
  )
}

// ─── Category Node ─────────────────────────────────────────────────────────────
function CategoryNode({
  node, depth, onEdit, onDelete, onAddChild, isPending
}: {
  node: Categoria
  depth: number
  onEdit: (c: Categoria) => void
  onDelete: (c: Categoria) => void
  onAddChild: (c: Categoria) => void
  isPending: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-white/5 group transition-colors',
          depth === 0 ? 'font-medium' : ''
        )}
        style={{ paddingLeft: `${(depth * 1.25) + 0.5}rem` }}
      >
        <button
          className="p-0.5 rounded text-neutral-600 hover:text-white transition-colors w-5 shrink-0"
          onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </button>

        <div className="text-neutral-500 shrink-0">
          {hasChildren
            ? isExpanded
              ? <FolderOpen className="w-4 h-4 text-emerald-400" />
              : <Folder className="w-4 h-4 text-emerald-500" />
            : <FileText className="w-4 h-4 text-neutral-600" />
          }
        </div>

        <span className="text-neutral-500 font-mono text-xs w-14 shrink-0">{node.codigo_reduzido}</span>

        <span className={cn(
          'flex-1 text-sm truncate',
          depth === 0 ? 'text-emerald-200 font-semibold' : 'text-neutral-300'
        )}>
          {node.nome_conta}
        </span>

        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded-md shrink-0 font-medium opacity-0 group-hover:opacity-100 transition-opacity',
          node.tipo === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {node.tipo}
        </span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddChild(node)}
            className="p-1.5 text-neutral-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
            title="Adicionar Sub-categoria"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(node)}
            className="p-1.5 text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(node)}
            disabled={isPending}
            className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-30"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <CategoryNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Form Modal (Create/Edit) ──────────────────────────────────────────────────
function CategoryFormModal({
  modal, onClose, onSubmit, isPending
}: {
  modal: Extract<ModalState, { type: 'create' | 'edit' }>
  onClose: () => void
  onSubmit: (data: { codigo_reduzido: string; nome_conta: string; tipo: 'RECEITA' | 'DESPESA' }) => void
  isPending: boolean
}) {
  const isEdit = modal.type === 'edit'
  const initial = isEdit ? modal.categoria : null

  const [nome, setNome] = useState(initial?.nome_conta ?? '')
  const [codigo, setCodigo] = useState(initial?.codigo_reduzido ?? '')
  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>(initial?.tipo ?? 'DESPESA')

  const parentSuffix = modal.type === 'create' && modal.parentCodigo ? `${modal.parentCodigo}.` : ''

  return (
    <Overlay onClose={onClose}>
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-5">
          {isEdit ? 'Editar Categoria' : modal.parentCodigo ? `Nova Sub-categoria em ${modal.parentCodigo}` : 'Nova Categoria Raiz'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1.5">Código Reduzido</label>
            <div className="flex gap-2 items-center">
              {parentSuffix && <span className="text-neutral-500 text-sm font-mono">{parentSuffix}</span>}
              <input
                value={codigo.replace(parentSuffix, '')}
                onChange={e => setCodigo(`${parentSuffix}${e.target.value}`)}
                placeholder="ex: 1, 1.1, 2.3.1"
                disabled={isEdit}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1.5">Nome da Conta</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="ex: Taxa Condominial"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1.5">Tipo</label>
            <div className="flex gap-2">
              {(['RECEITA', 'DESPESA'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
                    tipo === t
                      ? t === 'RECEITA'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSubmit({ codigo_reduzido: codigo, nome_conta: nome, tipo })}
            disabled={isPending || !nome || !codigo}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({
  title, message, confirmLabel, danger, onCancel, onConfirm, isPending
}: {
  title: string; message: string; confirmLabel: string; danger?: boolean
  onCancel: () => void; onConfirm: () => void; isPending: boolean
}) {
  return (
    <Overlay onClose={onCancel}>
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex gap-3 items-start mb-4">
          <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
            <p className="text-sm text-neutral-400">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              'px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50',
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            )}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Transfer Modal ────────────────────────────────────────────────────────────
function TransferModal({
  categoria, vinculos, allFlat, onCancel, onConfirm, isPending
}: {
  categoria: Categoria
  vinculos: { orcamentos: number; realizados: number }
  allFlat: Categoria[]
  onCancel: () => void
  onConfirm: (toId: string) => void
  isPending: boolean
}) {
  const [targetId, setTargetId] = useState('')

  return (
    <Overlay onClose={onCancel}>
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex gap-3 items-start mb-5">
          <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Transferência Obrigatória</h3>
            <p className="text-sm text-neutral-400">
              A categoria <strong className="text-white">"{categoria.nome_conta}"</strong> possui dados vinculados:
            </p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {vinculos.orcamentos > 0 && <li className="text-amber-300">• {vinculos.orcamentos} registro(s) de orçamento previsto</li>}
              {vinculos.realizados > 0 && <li className="text-amber-300">• {vinculos.realizados} registro(s) de dados realizados</li>}
            </ul>
            <p className="text-sm text-neutral-400 mt-2">Escolha uma categoria de destino para mover esses dados antes de excluir.</p>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-neutral-400 mb-1.5">Categoria de Destino</label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
          >
            <option value="">Selecionar categoria...</option>
            {allFlat.map(c => (
              <option key={c.id} value={c.id}>{c.codigo_reduzido} — {c.nome_conta}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
          <button
            onClick={() => targetId && onConfirm(targetId)}
            disabled={isPending || !targetId}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Transferir e Excluir
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Overlay ───────────────────────────────────────────────────────────────────
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  )
}
