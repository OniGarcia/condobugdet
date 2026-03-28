'use client'

import { useState, useTransition } from 'react'
import { Categoria } from '@/types'
import { ChevronRight, ChevronDown, Plus, Edit, Trash2, Folder, FolderOpen, FileText } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs))
}

export function TreeCategoryView({ data }: { data: Categoria[] }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
        <h2 className="text-lg font-semibold text-white">Plano de Contas</h2>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20">
          <Plus className="w-4 h-4" />
          Nova Categoria
        </button>
      </div>
      <div className="p-2">
        {data.length === 0 ? (
          <div className="text-center p-8 text-neutral-500 text-sm">Nenhuma categoria cadastrada.</div>
        ) : (
          <div className="space-y-1">
            {data.map(cat => (
              <CategoryNode key={cat.id} node={cat} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryNode({ node, depth = 0 }: { node: Categoria, depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 group transition-colors cursor-pointer",
          depth === 0 ? "bg-white/5 font-medium" : ""
        )}
        style={{ paddingLeft: `${(depth * 1.5) + 0.5}rem` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        <button className="p-0.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-colors">
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="w-4 h-4" /> // Spacer
          )}
        </button>
        
        <div className="text-neutral-400">
          {hasChildren ? (
            isExpanded ? <FolderOpen className="w-4 h-4 text-emerald-400" /> : <Folder className="w-4 h-4 text-emerald-500" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
        </div>
        
        <span className="text-sm text-neutral-400 font-mono w-16">{node.codigo_reduzido}</span>
        <span className={cn(
          "flex-1 text-sm truncate",
          depth === 0 ? "text-emerald-100" : "text-neutral-300"
        )}>
          {node.nome_conta}
        </span>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors" title="Adicionar Sub-categoria">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Editar">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Excluir">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {node.children!.map(child => (
            <CategoryNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
