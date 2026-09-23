import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  ClipboardList,
  LayoutGrid,
  ListOrdered,
  LogOut,
  Menu,
  Monitor,
  Package,
  Plus,
  Radar as RadarIcone,
  ScanLine,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { CHAVES, useConfig } from '../lib/config'
import { cx } from './ui'
import { LogoDelander } from './LogoDelander'

interface ItemMenu {
  para: string
  rotulo: string
  Icone: typeof CalendarDays
  somenteGerencia?: boolean
}

/** Grupos separam o dia a dia do cadastro — o menu deixa de ser uma lista solta. */
const GRUPOS: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: 'Oficina',
    itens: [
      { para: '/patio', rotulo: 'Pátio', Icone: LayoutGrid },
      { para: '/quadro', rotulo: 'Semana', Icone: CalendarDays },
      { para: '/fila', rotulo: 'Fila de espera', Icone: ListOrdered },
      { para: '/meus-servicos', rotulo: 'Meus serviços', Icone: Wrench },
    ],
  },
  {
    titulo: 'Acompanhar',
    itens: [
      { para: '/radar', rotulo: 'Carros parados', Icone: RadarIcone, somenteGerencia: true },
      { para: '/painel', rotulo: 'Painel do dono', Icone: ChartNoAxesColumn, somenteGerencia: true },
      { para: '/pecas', rotulo: 'Peças pendentes', Icone: Package, somenteGerencia: true },
    ],
  },
  {
    // Nao e somenteGerencia: e o mecanico que mais precisa achar o dado do modulo.
    titulo: 'Conhecimento',
    itens: [
      { para: '/leituras', rotulo: 'Leituras', Icone: ScanLine },
      { para: '/wiki', rotulo: 'Wiki', Icone: BookOpen },
    ],
  },
  {
    titulo: 'Cadastro',
    itens: [
      { para: '/clientes', rotulo: 'Clientes e veículos', Icone: ClipboardList },
      { para: '/funcionarios', rotulo: 'Funcionários', Icone: Users, somenteGerencia: true },
      { para: '/configuracoes', rotulo: 'Configurações', Icone: Settings, somenteGerencia: true },
    ],
  },
]

export default function Layout() {
  const { usuario, gerencia, encerrar } = useAuth()
  const { texto, flag } = useConfig()
  const navegar = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)

  const podeAgendar = gerencia || flag(CHAVES.mecanicoCriaOs)

  const sair = async () => {
    await encerrar()
    navegar('/entrar', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* ---------------- menu de aço ---------------- */}
      <aside
        className={cx(
          'chapa fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r-4 border-aco-900 transition-transform lg:static lg:translate-x-0',
          menuAberto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-white/10 px-4">
          <Link to="/" className="flex min-w-0 items-center" onClick={() => setMenuAberto(false)}>
            <LogoDelander altura={30} variante="escuro" />
          </Link>
          <button
            type="button"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 lg:hidden"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto rolagem-suave px-2 py-3">
          {GRUPOS.map((grupo) => {
            const itens = grupo.itens.filter((item) => gerencia || !item.somenteGerencia)
            if (itens.length === 0) return null
            return (
              <div key={grupo.titulo} className="mb-4">
                <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  {grupo.titulo}
                </p>
                <div className="space-y-0.5">
                  {itens.map(({ para, rotulo, Icone }) => (
                    <NavLink
                      key={para}
                      to={para}
                      onClick={() => setMenuAberto(false)}
                      className={({ isActive }) =>
                        cx(
                          'flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition',
                          isActive
                            ? 'bg-faixa font-semibold sobre-destaque'
                            : 'text-zinc-300 hover:bg-white/10 hover:text-white',
                        )
                      }
                    >
                      <Icone className="size-4 flex-none" aria-hidden />
                      {rotulo}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}

          {gerencia && flag(CHAVES.modoTv) && (
            <a
              href="/tv"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              <Monitor className="size-4 flex-none" aria-hidden />
              Modo TV
            </a>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="truncate text-sm font-medium text-white">{usuario?.nome}</p>
          <p className="truncate text-[11px] uppercase tracking-wider text-zinc-500">
            {usuario?.papelDescricao}
          </p>
          <button
            type="button"
            onClick={sair}
            className="mt-2 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      {menuAberto && (
        <div
          className="fixed inset-0 z-30 bg-aco-900/60 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      )}

      {/* ---------------- conteúdo ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="chapa sticky top-0 z-20 flex h-12 items-center gap-3 px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="rounded p-1.5 text-zinc-300 hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <LogoDelander altura={22} variante="escuro" comAssinatura={false} />
          {podeAgendar && (
            <Link
              to="/patio"
              className="fonte-display ml-auto inline-flex items-center gap-1 rounded bg-faixa px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider sobre-destaque"
            >
              <Plus className="size-3.5" aria-hidden />
              Agendar
            </Link>
          )}
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
