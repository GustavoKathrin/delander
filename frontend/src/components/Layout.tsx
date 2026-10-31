import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
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
import { reabrirAjudas } from './AjudaDaTela'
import { useAuth } from '../lib/auth'
import { CHAVES, useConfig } from '../lib/config'
import { cx } from './ui'
import { LogoDelander } from './LogoDelander'

interface ItemMenu {
  para: string
  rotulo: string
  Icone: typeof CalendarDays
  somenteGerencia?: boolean
  /** Gerência + recepção: quem atende o cliente e cuida da compra. */
  somenteAtendimento?: boolean
}

/** Grupos separam o dia a dia do cadastro — o menu deixa de ser uma lista solta. */
const GRUPOS: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: 'Oficina',
    itens: [
      { para: '/', rotulo: 'Início', Icone: LayoutDashboard },
      { para: '/patio', rotulo: 'Pátio', Icone: LayoutGrid },
      // Nao e somenteGerencia: o mecanico tambem ganha em ver a oficina
      // inteira -- e dele que vem a pergunta "quem esta no elevador agora".
      { para: '/execucao', rotulo: 'Oficina agora', Icone: Activity },
      { para: '/quadro', rotulo: 'Semana', Icone: CalendarDays },
      { para: '/meus-servicos', rotulo: 'Meus serviços', Icone: Wrench },
    ],
  },
  {
    titulo: 'Acompanhar',
    itens: [
      { para: '/radar', rotulo: 'Carros parados', Icone: RadarIcone, somenteGerencia: true },
      { para: '/painel', rotulo: 'Revisão do mês', Icone: ChartNoAxesColumn, somenteGerencia: true },
      { para: '/pecas', rotulo: 'Peças para comprar', Icone: Package, somenteAtendimento: true },
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
      // Catalogo com entrada propria: e dele que sai o tempo e o preco de
      // todo servico lancado. Isso nao e configuracao, e o que a oficina
      // vende -- estava numa aba dentro de Configuracoes > Cadastros.
      { para: '/catalogo', rotulo: 'Serviços e mão de obra', Icone: Wrench, somenteGerencia: true },
      { para: '/funcionarios', rotulo: 'Funcionários', Icone: Users, somenteGerencia: true },
      { para: '/configuracoes', rotulo: 'Configurações', Icone: Settings, somenteGerencia: true },
    ],
  },
]

export default function Layout() {
  const { usuario, gerencia, podeAtender, encerrar } = useAuth()
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
          <Link
            to="/"
            className="flex min-h-11 min-w-0 items-center"
            onClick={() => setMenuAberto(false)}
          >
            <LogoDelander altura={30} variante="escuro" />
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded text-zinc-400 hover:bg-white/10 lg:hidden"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto rolagem-suave px-2 py-3">
          {GRUPOS.map((grupo) => {
            const itens = grupo.itens.filter(
              (item) =>
                (!item.somenteGerencia || gerencia) &&
                (!item.somenteAtendimento || podeAtender),
            )
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
                          'flex min-h-11 items-center gap-2.5 rounded px-2.5 py-2 text-sm transition',
                          isActive
                            ? 'bg-marca-600 font-semibold sobre-marca'
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
              className="flex min-h-11 items-center gap-2.5 rounded px-2.5 py-2 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
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
          {/* Traz de volta as explicações que a pessoa já dispensou. Sem isto,
              fechar o cartão sem querer seria irreversível — e o único jeito de
              recuperar seria limpar o navegador. */}
          <button
            type="button"
            onClick={() => {
              reabrirAjudas()
              navegar(0)
            }}
            className="mt-2 flex min-h-11 w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <Lightbulb className="size-4" aria-hidden />
            Como funciona
          </button>
          <button
            type="button"
            onClick={sair}
            className="flex min-h-11 w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
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
            className="grid size-11 place-items-center rounded text-zinc-300 hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <LogoDelander altura={22} variante="escuro" comAssinatura={false} />
          {podeAgendar && (
            <Link
              to="/patio"
              className="fonte-display ml-auto inline-flex min-h-11 items-center gap-1 rounded bg-marca-600 sobre-marca px-3 text-[11px] font-extrabold uppercase tracking-wider sobre-destaque"
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
