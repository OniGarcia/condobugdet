'use client'

import { useState, useTransition } from 'react'
import { CentroCusto, Categoria } from '@/types'
import { Plus, Edit, Trash2, Boxes, ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Loader2, AlertTriangle, X } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  createCentroCusto,
  updateCentroCusto,
  deleteCentroCusto,
  setCentroCategories,
} from '@/actions/centrosCusto'

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs))
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; centro: CentroCusto }
  | { type: 'delete'; centro: CentroCusto }
  | { type: 'categories'; centro: CentroCusto }

// ─── Main Component ────────────────────────────────────────────────────────────
export function CostCenterView({
  data,
  allFlat,
  categoriaTree,
  role = 'visualizador',
}: {
  data: CentroCusto[]
  allFlat: Categoria[]
  categoriaTree: Categoria[]
  role?: string
}) {
  const canEdit = role === 'admin' || role === 'gestor'
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [isPending, startTransition] = useTransition()

  const closeModal = () => setModal({ type: 'none' })

  const handleDelete = (centro: CentroCusto) => {
    startTransition(async () => {
      await deleteCentroCusto(centro.id)
      closeModal()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Centros de Custo</h2>
        {canEdit && (
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg text-sm font-medium transition-colors border border-sky-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Centro de Custo
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
        {data.length === 0 ? (
          <div className="text-center p-12 text-neutral-500 text-sm">
            <Boxes className="w-8 h-8 mx-auto mb-3 opacity-30" />
            Nenhum centro de custo cadastrado. Clique em &quot;Novo Centro de Custo&quot; para começar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Descrição</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Saldo Inicial</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Categorias</th>
                <th className="px-5 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map(centro => (
                <tr key={centro.id} className="group hover:bg-white/60 dark:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-neutral-800 dark:text-neutral-200">{centro.nome}</td>
                  <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-400">{centro.descricao ?? <span className="italic text-neutral-600">—</span>}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-sky-400 text-sm">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centro.saldo_inicial ?? 0)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setModal({ type: 'categories', centro })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 rounded-lg text-xs font-medium transition-colors border border-violet-500/20"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      {centro.categoria_ids?.length ?? 0} categorias
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    {canEdit && (
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: 'edit', centro })}
                          className="p-1.5 text-neutral-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: 'delete', centro })}
                          disabled={isPending}
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-30"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Modals ────────────────────────────────────────────────────────────── */}

      {(modal.type === 'create' || modal.type === 'edit') && (
        <CostCenterFormModal
          modal={modal}
          isPending={isPending}
          onClose={closeModal}
          onSubmit={(formData) => {
            startTransition(async () => {
              if (modal.type === 'create') {
                await createCentroCusto(formData)
              } else {
                await updateCentroCusto(modal.centro.id, formData)
              }
              closeModal()
            })
          }}
        />
      )}

      {modal.type === 'delete' && (
        <ConfirmModal
          title="Excluir Centro de Custo"
          message={`Deseja excluir permanentemente "${modal.centro.nome}"? As associações de categorias serão removidas.`}
          confirmLabel="Sim, excluir"
          onCancel={closeModal}
          onConfirm={() => handleDelete(modal.centro)}
          isPending={isPending}
        />
      )}

      {modal.type === 'categories' && (
        <CategorySelectorModal
          centro={modal.centro}
          categoriaTree={categoriaTree}
          isPending={isPending}
          onClose={closeModal}
          onSave={(ids) => {
            startTransition(async () => {
              await setCentroCategories(modal.centro.id, ids)
              closeModal()
            })
          }}
        />
      )}
    </div>
  )
}

// ─── Cost Center Form Modal ────────────────────────────────────────────────────
function CostCenterFormModal({
  modal, isPending, onClose, onSubmit,
}: {
  modal: Extract<ModalState, { type: 'create' | 'edit' }>
  isPending: boolean
  onClose: () => void
  onSubmit: (data: { nome: string; descricao: string | null; saldo_inicial: number }) => void
}) {
  const isEdit = modal.type === 'edit'
  const initial = isEdit ? modal.centro : null
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [saldoInicial, setSaldoInicial] = useState(
    String(initial?.saldo_inicial ?? 0)
  )

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-5">
          {isEdit ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Nome</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="ex: Taxa Condominial"
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Descrição <span className="text-neutral-600">(opcional)</span></label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva o agrupamento..."
              rows={3}
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-sky-500 outline-none transition-all resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
              Saldo Inicial <span className="text-neutral-600">(R$)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={saldoInicial}
              onChange={e => setSaldoInicial(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
            />
            <p className="text-xs text-neutral-600 mt-1">Valor financeiro disponível no início do período deste centro de custo.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white rounded-lg hover:bg-white/60 dark:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSubmit({
              nome,
              descricao: descricao || null,
              saldo_inicial: parseFloat(saldoInicial) || 0,
            })}
            disabled={isPending || !nome.trim()}
            className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-neutral-900 dark:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Category Selector Modal ───────────────────────────────────────────────────
function CategorySelectorModal({
  centro, categoriaTree, isPending, onClose, onSave,
}: {
  centro: CentroCusto
  categoriaTree: Categoria[]
  isPending: boolean
  onClose: () => void
  onSave: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(centro.categoria_ids ?? []))

  const toggle = (node: Categoria) => {
    setSelected(prev => {
      const next = new Set(prev)
      const isChecking = !next.has(node.id)
      
      const applyRecursive = (n: Categoria) => {
        if (isChecking) next.add(n.id)
        else next.delete(n.id)
        
        if (n.children) {
          n.children.forEach(applyRecursive)
        }
      }

      applyRecursive(node)
      return next
    })
  }

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Associar Categorias</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">Centro: <span className="text-neutral-800 dark:text-neutral-200 font-medium">{centro.nome}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-white rounded-lg hover:bg-white/60 dark:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-neutral-500 mb-3">{selected.size} categorias selecionadas</p>

        <div className="flex-1 overflow-y-auto bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-2 space-y-0.5">
          {categoriaTree.length === 0 ? (
            <p className="text-center p-8 text-neutral-500 text-sm">Nenhuma categoria cadastrada.</p>
          ) : (
            categoriaTree.map(cat => (
              <CategoryCheckNode
                key={cat.id}
                node={cat}
                depth={0}
                selected={selected}
                onToggle={toggle}
              />
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white rounded-lg hover:bg-white/60 dark:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSave(Array.from(selected))}
            disabled={isPending}
            className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-neutral-900 dark:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar Associações
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Category Checkbox Node ────────────────────────────────────────────────────
function CategoryCheckNode({
  node, depth, selected, onToggle,
}: {
  node: Categoria
  depth: number
  selected: Set<string>
  onToggle: (node: Categoria) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = node.children && node.children.length > 0
  const isChecked = selected.has(node.id)

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-white/60 dark:bg-white/5 group transition-colors cursor-pointer"
        style={{ paddingLeft: `${(depth * 1.25) + 0.5}rem` }}
        onClick={() => onToggle(node)}
      >
        <button
          className="p-0.5 rounded text-neutral-600 hover:text-neutral-900 dark:text-white transition-colors w-5 shrink-0"
          onClick={e => { e.stopPropagation(); hasChildren && setIsExpanded(!isExpanded) }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </button>

        <div className="shrink-0">
          {hasChildren
            ? isExpanded
              ? <FolderOpen className="w-4 h-4 text-sky-400" />
              : <Folder className="w-4 h-4 text-sky-500" />
            : <FileText className="w-4 h-4 text-neutral-600" />}
        </div>

        <span className="text-neutral-500 font-mono text-xs w-14 shrink-0">{node.codigo_reduzido}</span>

        <span className={cn(
          'flex-1 text-sm truncate',
          depth === 0 ? 'text-sky-200 font-semibold' : 'text-neutral-700 dark:text-neutral-300'
        )}>
          {node.nome_conta}
        </span>

        <div
          className={cn(
            'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
            isChecked
              ? 'bg-sky-500 border-sky-500'
              : 'border-white/20 bg-white/60 dark:bg-white/5 hover:border-sky-500/50'
          )}
          onClick={e => { e.stopPropagation(); onToggle(node) }}
        >
          {isChecked && (
            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <CategoryCheckNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({
  title, message, confirmLabel, onCancel, onConfirm, isPending,
}: {
  title: string; message: string; confirmLabel: string
  onCancel: () => void; onConfirm: () => void; isPending: boolean
}) {
  return (
    <Overlay onClose={onCancel}>
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex gap-3 items-start mb-4">
          <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">{title}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white rounded-lg hover:bg-white/60 dark:bg-white/5 transition-colors">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-neutral-900 dark:text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
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
