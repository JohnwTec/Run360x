import React from 'react';
import { Key, MapPin, Zap, CheckCircle2, ShieldAlert } from 'lucide-react';

interface KeySetupModalProps {
  apiKey: string;
  hasValidKey: boolean;
  onClose: () => void;
  onUseSimulationMode: () => void;
}

export const KeySetupModal: React.FC<KeySetupModalProps> = ({
  apiKey,
  hasValidKey,
  onClose,
  onUseSimulationMode,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-slate-100 font-sans overflow-hidden">
        {/* Neon Glow corner line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500" />

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white uppercase flex items-center gap-2">
              Chave Google Maps <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono">O GRID</span>
            </h2>
            <p className="text-xs text-slate-400">Configuração de Renderização de Alta Precisão</p>
          </div>
        </div>

        {hasValidKey ? (
          <div className="my-6 p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Chave do Google Maps Detectada!</p>
              <p className="text-xs text-emerald-400/80 mt-1">
                A API <code className="font-mono text-xs bg-black/40 px-1 py-0.5 rounded text-emerald-200">GOOGLE_MAPS_PLATFORM_KEY</code> está configurada. Seu mapa tático em Dark Neon renderizará com azimute e estilo do Google Maps em tempo real.
              </p>
            </div>
          </div>
        ) : (
          <div className="my-5 space-y-4 text-xs sm:text-sm text-slate-300">
            <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-cyan-200">Como ativar a integração nativa do Google Maps:</p>
                <ol className="list-decimal list-inside text-slate-300 mt-1.5 space-y-1">
                  <li>Obtenha uma chave no Google Cloud Console.</li>
                  <li>No menu superior do AI Studio, clique em <strong>Settings (⚙️) → Secrets</strong>.</li>
                  <li>Crie o secret chamado <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">GOOGLE_MAPS_PLATFORM_KEY</code> e cole a chave.</li>
                </ol>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-300">Não tem chave agora? Você pode usar o <strong>Mapa Tático Interativo Grid</strong> nativo imediatamente.</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          <button
            onClick={() => {
              onUseSimulationMode();
              onClose();
            }}
            className="w-full sm:flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            {hasValidKey ? 'Entrar no Mapa Google Maps Neon' : 'Entrar no Mapa Tático AR (Grid Simulator)'}
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition border border-slate-700 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
