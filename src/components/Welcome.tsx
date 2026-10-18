import { useEffect, useState } from 'react';
import { ClipboardCheck, Database, Rocket, ShieldCheck, Snowflake, Wind } from 'lucide-react';
import { isInitialized, markInitialized, seedDemo } from '../db/seed';
import { Button, Modal } from './ui';
import { AUTO_DEMO } from '../lib/env';

let autoIniciado = false;

/** Tela de boas-vindas no primeiro acesso: começar do zero ou carregar a demonstração. */
export default function Welcome() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    isInitialized()
      .then(async (ok) => {
        if (ok) return;
        if (AUTO_DEMO) {
          if (autoIniciado) return;
          autoIniciado = true;
          await seedDemo();
        }
        else setOpen(true);
      })
      .catch(() => {});
  }, []);
  const demo = async () => {
    setBusy(true);
    try {
      await seedDemo();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  const zero = async () => {
    await markInitialized();
    setOpen(false);
  };
  return (
    <Modal open={open} onClose={zero} title="Bem-vindo ao PMOC Pro" size="md">
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 p-4 text-white">
          <Snowflake size={36} />
          <div>
            <p className="text-base font-bold">Gestão completa de PMOC e manutenção HVAC-R</p>
            <p className="text-xs text-brand-50">Lei 13.589/2018 · Portaria GM/MS 3.523/98 · RE ANVISA 09/2003 · ABNT NBR 13971</p>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="flex gap-2"><ClipboardCheck size={18} className="shrink-0 text-brand-600" /> OS com checklist, medições, fotos, peças e assinatura digital</li>
          <li className="flex gap-2"><Wind size={18} className="shrink-0 text-brand-600" /> Cadastro de equipamentos com QR Code e histórico</li>
          <li className="flex gap-2"><Rocket size={18} className="shrink-0 text-brand-600" /> Cronograma anual e geração automática de preventivas</li>
          <li className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-brand-600" /> Documento PMOC pronto para impressão/PDF</li>
        </ul>
        <p>Seus dados ficam salvos <b>neste navegador</b> (funciona offline). Faça backups em Configurações.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" icon={<Database size={16} />} onClick={demo} disabled={busy}>
            {busy ? 'Carregando…' : 'Explorar com dados de demonstração'}
          </Button>
          <Button className="flex-1" variant="outline" onClick={zero} disabled={busy}>
            Começar do zero
          </Button>
        </div>
      </div>
    </Modal>
  );
}
