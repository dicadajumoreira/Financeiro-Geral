import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, LogOut, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/contexts/OrgContext'
import { navSections } from './nav'
import { CompanySwitcher } from './CompanySwitcher'
import { Badge } from '@/components/ui/badge'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { org, role } = useOrg()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-semibold">Financeiro Geral</span>
        </div>
        <nav className="flex flex-col gap-5 overflow-y-auto p-3" style={{ maxHeight: 'calc(100vh - 3.5rem)' }}>
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.soon && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        em breve
                      </Badge>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <CompanySwitcher />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{org?.name}</p>
              <p className="text-xs text-muted-foreground">
                {user?.email} · {role}
              </p>
            </div>
            <Link to="/configuracoes" className="text-sm text-muted-foreground hover:text-foreground">
              Config
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
