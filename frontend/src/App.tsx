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
import Prontuario from './features/os/Prontuario'
import FichaOs from './features/os/FichaOs'
import PainelMecanico from './features/mecanico/PainelMecanico'
import Execucao from './features/execucao/Execucao'
import Catalogo from './features/catalogo/Catalogo'
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
import Inicio from './features/inicio/Inicio'
import Fornecedores from './features/fornecedores/Fornecedores'

function Protegida({ children }: { children: React.ReactNode }) {
  const { autenticado } = useAuth()
  if (!autenticado) return <Navigate to="/entrar" replace />
  return <>{children}</>
}

/*
 * O mecanico cai na bancada dele; todo o resto cai no painel.
 *
 * Antes o sistema abria na planta do patio. Planta responde "onde esta cada
 * carro" -- pergunta legitima, mas nao e a primeira do dia. A primeira e "o
 * que travou", e e essa que o painel responde.
 */
function TelaInicial() {
  const { ehMecanico } = useAuth()
  if (ehMecanico) return <Navigate to="/meus-servicos" replace />
  return <Inicio />
}

export default function App() {
  return (
    <Routes>
      <Route path="/acompanhar/:token" element={<Acompanhar />} />
      <Route path="/entrar" element={<Login />} />
      {/* Fora do Layout de proposito: a ficha vira papel, e o menu de aco
          da lateral nao deve sair na impressao. */}
      <Route
        path="/os/:id/ficha"
        element={
          <Protegida>
            <FichaOs />
          </Protegida>
        }
      />
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
        <Route path="/fornecedores" element={<Fornecedores />} />
        <Route path="/patio" element={<Patio />} />
        <Route path="/quadro" element={<Quadro />} />
        <Route path="/radar" element={<Radar />} />
        <Route path="/fila" element={<FilaEspera />} />
        <Route path="/novo" element={<Checkin />} />
        <Route path="/os/:id" element={<DetalheOs />} />
        <Route path="/veiculo/:id/prontuario" element={<Prontuario />} />
        <Route path="/meus-servicos" element={<PainelMecanico />} />
        <Route path="/execucao" element={<Execucao />} />
        <Route path="/painel" element={<Dashboard />} />
        <Route path="/leituras" element={<Leituras />} />
        <Route path="/leituras/:id" element={<DetalheLeitura />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/wiki/:id" element={<ArtigoWiki />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/funcionarios" element={<Funcionarios />} />
        <Route path="/pecas" element={<Pecas />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
