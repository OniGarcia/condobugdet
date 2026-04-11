'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Calendar, FileText, Pickaxe, Banknote, AlertTriangle, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { criarAporte, deletarAporte } from '@/actions/aportesCentroCusto'
import { AporteCentroCusto, CentroCusto } from '@/types'

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs))
}

export function AportesList({ aportes, centrosDeCusto, role = 'visualizador' }: { aportes: any[], centrosDeCusto: CentroCusto[], role?: string }) {
  const canEdit = role === 'admin' || role === 'gestor'
  const [modalType, setModalType] = useState<'none' | 'create' | 'delete'>('none')
  const [selectedAporte, setSelectedAporte] = useState<any | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleOpenCreate = () => {
    setSelectedAporte(null)
    setModalType('create')
  }

  const handleOpenDelete = (aporte: any) => {
    setSelectedAporte(aporte)
    setModalType('delete')
  }

  const closeModals = () => {
    setModalType('none')
    setSelectedAporte(null)
  }

  const handleDelete = () => {
    if (!selectedAporte) return
    startTransition(async () => {
      await deletarAporte(selectedAporte.id)
      closeModals()
    })
  }

  const handleCreate = (data: { centro_custo_id: string, valor: number, data_aporte: string, origem: string, descricao: string }) => {
    startTransition(async () => {
      await criarAporte(data)
      closeModals()
    })
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDate = (dateStr: string) => {
    // "2024-12-05" -> "05/12/2024"
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Pickaxe className="w-5 h-5 text-amber-500" /> Histórico de Aportes
        </h2>
        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg text-sm font-medium transition-colors border border-sky-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Aporte
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/40 dark:bg-black/20 border-b border-neutral-200 dark:border-white/10 text-xs uppercase font-medium text-neutral-500 shrink-0">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Data</th>
                <th className="px-4 py-3 whitespace-nowrap">Centro de Custo</th>
                <th className="px-4 py-3 whitespace-nowrap">Valor</th>
                <th className="px-4 py-3 whitespace-nowrap">Origem / Referência</th>
                <th className="px-4 py-3 whitespace-nowrap">Descrição</th>
                {canEdit && <th className="px-4 py-3 whitespace-nowrap text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
              {aportes.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-12 text-center text-neutral-500">
                    <Banknote className="w-8 h-8 opacity-30 mx-auto mb-3" />
                    Nenhum aporte financeiro registrado.
                  </td>
                </tr>
              ) : (
                aportes.map(ap => (
                  <tr key={ap.id} className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 font-mono whitespace-nowrap">
                      {formatDate(ap.data_aporte)}
                    </td>
                    <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200 font-medium">
                      {ap.centros_custo?.nome || '-'}
                    </td>
                    <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      {formatCurrency(ap.valor)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {ap.origem}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {ap.descricao || '-'}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenDelete(ap)}
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modalType === 'create' && (
        <CreateModal
          centrosDeCusto={centrosDeCusto}
          onClose={closeModals}
          onSubmit={handleCreate}
          isPending={isPending}
        />
      )}

      {modalType === 'delete' && selectedAporte && (
        <DeleteModal
          aporte={selectedAporte}
          onClose={closeModals}
          onConfirm={handleDelete}
          isPending={isPending}
        />
      )}
    </div>
  )
}

function CreateModal({ centrosDeCusto, onClose, onSubmit, isPending }: any) {
  const [ccId, setCcId] = useState(centrosDeCusto[0]?.id || '')
  const [valorStr, setValorStr] = useState('')
  const [dataAporte, setDataAporte] = useState(new Date().toISOString().split('T')[0])
  const [origem, setOrigem] = useState('Fundo de Reserva')
  const [descricao, setDescricao] = useState('')

  const isValid = ccId && valorStr && Number(valorStr.replace(',', '.')) > 0 && dataAporte && origem

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    onSubmit({
      centro_custo_id: ccId,
      valor: Number(valorStr.replace(',', '.')),
      data_aporte: dataAporte,
      origem,
      descricao
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-5 flex gap-2 items-center">
          <Pickaxe className="w-5 h-5 text-amber-500" /> Registro de Aporte
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Centro de Custo Destino</label>
            <select
              value={ccId}
              onChange={e => setCcId(e.target.value)}
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              {centrosDeCusto.map((cc: any) => (
                <option key={cc.id} value={cc.id}>{cc.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Data</label>
              <input
                type="date"
                value={dataAporte}
                onChange={e => setDataAporte(e.target.value)}
                className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Valor (R$)</label>
              <input
                type="text"
                value={valorStr}
                onChange={e => {
                  let v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
                  // allow only one decimal dot
                  if ((v.match(/\./g) || []).length > 1) {
                    v = v.substring(0, v.lastIndexOf('.'))
                  }
                  // convert back to comma for display tracking
                  setValorStr(v.replace('.', ','))
                }}
                placeholder="0,00"
                className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Origem</label>
            <input
              type="text"
              value={origem}
              onChange={e => setOrigem(e.target.value)}
              placeholder="Ex: Fundo de Reserva, Financiamento Bancário"
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-sky-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Descrição (Opcional)</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Detalhes ou justificativas da transferência"
              rows={3}
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-sky-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !isValid}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Aporte
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ aporte, onClose, onConfirm, isPending }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex gap-3 items-start mb-4">
          <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">Cancelar Aporte</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Deseja remover o aporte de <strong>R$ {aporte.valor}</strong> vinculado à <strong>{aporte.origem}</strong>? Esta ação afetará o saldo projetado na data.
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  )
}
