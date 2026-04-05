'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, UserCog } from 'lucide-react'

interface Tab {
  href: string
  label: string
  icon: React.ElementType
}

export function SettingsTabs({
  isMaster,
}: {
  isMaster: boolean
  isAdmin: boolean
}) {
  const pathname = usePathname()

  const tabs: Tab[] = []

  if (isMaster) {
    tabs.push({ href: '/settings/condos', label: 'Condomínios', icon: Building2 })
    tabs.push({ href: '/settings/users', label: 'Usuários', icon: UserCog })
  }

  if (tabs.length === 0) return null

  return (
    <nav className="flex border-b border-neutral-200 dark:border-white/10 gap-1">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              active
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:text-neutral-200 hover:border-white/20'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
