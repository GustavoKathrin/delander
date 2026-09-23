import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './features/Login'
import Patio from './features/patio/Patio'
import Quadro from './features/quadro/Quadro'
import Radar from './features/quadro/Radar'
import FilaEspera from './features/quadro/FilaEspera'
import Checkin from './features/checkin/Checkin'
import DetalheOs from './features/os/DetalheOs'
import PainelMecanico from './features/mecanico/PainelMecanico'
import Dashboard from './features/dashboard/Dashboard'
import Clientes from './features/cadastros/Clientes'
import Funcionarios from './features/cadastros/Funcionarios'
import Pecas from './features/cadastros/Pecas'
import Configuracoes from './features/config/Configuracoes'
import Leituras from './features/leituras/Leituras'
import DetalheLeitura from './features/leituras/DetalheLeitura'
import Wiki from './features/wiki/Wiki'
import ArtigoWiki from './features/wiki/ArtigoWiki'
import Acompanhar from './features/publico/Acompanhar'
import ModoTv from './features/tv/ModoTv'

function Protegida({ children }: { children: React.ReactNode }) {
  const { autenticado } = useAuth()
  if (!autenticado) return <Navigate to="/entrar" replace />
  return <>{children}</>
}

/** O mecanico cai direto no painel dele; o dono, na planta do patio. */
function TelaInicial() {
  const { ehMecanico } = useAuth()
  return <Navigate to={ehMecanico ? '/meus-servicos' : '/patio'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/acompanhar/:token" element={<Acompanhar />} />
      <Route path="/entrar" element={<Login />} />
      <Route
        path="/tv"
        element={
          <Protegida>
            <ModoTv />
          </Protegida>
        }
      />
      <Route
        element={
          <Protegida>
            <Layout />
          </Protegida>
        }
      >
        <Route path="/" element={<TelaInicial />} />
        <Route path="/patio" element={<Patio />} />
        <Route path="/quadro" element={<Quadro />} />
        <Route path="/radar" element={<Radar />} />
        <Route path="/fila" element={<FilaEspera />} />
        <Route path="/novo" element={<Checkin />} />
        <Route path="/os/:id" element={<DetalheOs />} />
        <Route path="/meus-servicos" element={<PainelMecanico />} />
        <Route path="/painel" element={<Dashboard />} />
        <Route path="/leituras" element={<Leituras />} />
        <Route path="/leituras/:id" element={<DetalheLeitura />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/wiki/:id" element={<ArtigoWiki />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/funcionarios" element={<Funcionarios />} />
        <Route path="/pecas" element={<Pecas />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
