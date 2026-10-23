import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Welcome from './components/Welcome';
import ErrorBoundary from './components/ErrorBoundary';
import { ConfirmProvider, ToastProvider } from './components/ui';
import { EntityPage } from './components/crud';
import { LookupsProvider } from './lib/lookups';
import { SessaoProvider } from './lib/sessao';
import { CampoHome, CampoOS } from './pages/Campo';
import {
  ambientesCfg, clientesCfg, contratosCfg, equipamentosCfg, fluidosCfg, fornecedoresCfg, pecasCfg, profissionaisCfg, qualidadeArCfg, servicosCfg, unidadesCfg,
} from './modules/entities';
import { ocorrenciasCfg, orcamentosCfg } from './modules/operacao';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import OsList from './pages/OsList';
import OsEdit from './pages/OsEdit';
import OsPrint from './pages/OsPrint';
import OrcamentoPrint from './pages/OrcamentoPrint';
import OcorrenciaPrint from './pages/OcorrenciaPrint';
import ContratoPrint from './pages/ContratoPrint';
import Estoque from './pages/Estoque';
import { PlanoEdit, PlanosList } from './pages/Planos';
import { PmocDocumento, pmocsCfg } from './pages/Pmoc';
import Cronograma from './pages/Cronograma';
import Preventivas from './pages/Preventivas';
import PainelComercial from './pages/PainelComercial';
import { oportunidadesCfg } from './modules/comercial';
import { cargosCfg } from './modules/precificacao';
import EstudosPage from './pages/precificacao/Estudos';
import EstudoEditor from './pages/precificacao/EstudoEditor';
import EstudoPrint from './pages/precificacao/EstudoPrint';
import TributosPage from './pages/precificacao/Tributos';
import CustosPage from './pages/precificacao/Custos';
import { EquipamentoDetalhe, Etiquetas } from './pages/Equipamento';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import Busca from './pages/Busca';

export default function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
      <ConfirmProvider>
        <LookupsProvider>
          <SessaoProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="campo" element={<CampoHome />} />
                <Route path="campo/os/:id" element={<CampoOS />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="os" element={<OsList />} />
                <Route path="os/nova" element={<OsEdit />} />
                <Route path="os/:id" element={<OsEdit key="edit" />} />
                <Route path="os/:id/imprimir" element={<OsPrint />} />
                <Route path="ocorrencias" element={<EntityPage key="oc" cfg={ocorrenciasCfg} />} />
                <Route path="ocorrencias/:id/imprimir" element={<OcorrenciaPrint />} />
                <Route path="orcamentos" element={<EntityPage key="orc" cfg={orcamentosCfg} />} />
                <Route path="orcamentos/:id/imprimir" element={<OrcamentoPrint />} />
                <Route path="pmoc" element={<EntityPage key="pmoc" cfg={pmocsCfg} />} />
                <Route path="pmoc/:id/documento" element={<PmocDocumento />} />
                <Route path="cronograma" element={<Cronograma />} />
                <Route path="preventivas" element={<Preventivas />} />
                <Route path="comercial" element={<PainelComercial />} />
                <Route path="oportunidades" element={<EntityPage key="op" cfg={oportunidadesCfg} />} />
                <Route path="precificacao" element={<EstudosPage />} />
                <Route path="precificacao/equipe" element={<EntityPage key="cargos" cfg={cargosCfg} />} />
                <Route path="precificacao/tributos" element={<TributosPage />} />
                <Route path="precificacao/custos" element={<CustosPage />} />
                <Route path="precificacao/:id" element={<EstudoEditor />} />
                <Route path="precificacao/:id/imprimir" element={<EstudoPrint />} />
                <Route path="planos" element={<PlanosList />} />
                <Route path="planos/:id" element={<PlanoEdit />} />
                <Route path="qualidade-ar" element={<EntityPage key="ar" cfg={qualidadeArCfg} />} />
                <Route path="fluidos" element={<EntityPage key="fl" cfg={fluidosCfg} />} />
                <Route path="clientes" element={<EntityPage key="cli" cfg={clientesCfg} />} />
                <Route path="unidades" element={<EntityPage key="uni" cfg={unidadesCfg} />} />
                <Route path="ambientes" element={<EntityPage key="amb" cfg={ambientesCfg} />} />
                <Route path="equipamentos" element={<EntityPage key="eq" cfg={equipamentosCfg} />} />
                <Route path="equipamentos/:id" element={<EquipamentoDetalhe />} />
                <Route path="etiquetas" element={<Etiquetas />} />
                <Route path="profissionais" element={<EntityPage key="prof" cfg={profissionaisCfg} />} />
                <Route path="servicos" element={<EntityPage key="serv" cfg={servicosCfg} />} />
                <Route path="pecas" element={<EntityPage key="pec" cfg={pecasCfg} />} />
                <Route path="estoque" element={<Estoque />} />
                <Route path="fornecedores" element={<EntityPage key="forn" cfg={fornecedoresCfg} />} />
                <Route path="contratos" element={<EntityPage key="ct" cfg={contratosCfg} />} />
                <Route path="contratos/:id/imprimir" element={<ContratoPrint />} />
                <Route path="relatorios" element={<Relatorios />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="busca" element={<Busca />} />
                <Route path="*" element={<Dashboard />} />
              </Route>
            </Routes>
            <Welcome />
          </HashRouter>
          </SessaoProvider>
        </LookupsProvider>
      </ConfirmProvider>
    </ToastProvider>
    </ErrorBoundary>
  );
}
