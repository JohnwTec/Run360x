import React, { useState } from 'react';
import { ShieldAlert, Share2, Users, MapPin, Check, Copy, PhoneCall, X, Radio } from 'lucide-react';

interface CommunitySafetyModalProps {
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const CommunitySafetyModal: React.FC<CommunitySafetyModalProps> = ({ onClose, theme = 'dark' }) => {
  const isLight = theme === 'light';

  const [copiedLink, setCopiedLink] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState('(11) 98765-4321');

  const liveLink = `https://runlevel.app/live-track/runner-alpha-${Date.now().toString().slice(-4)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(liveLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleTriggerSOS = () => {
    setSosTriggered(true);
  };

  const nearbyRunners = [
    { name: 'Fernanda M.', pace: '5:15 min/km', distanceKm: 1.2, sector: 'Parque Ibirapuera' },
    { name: 'Lucas R.', pace: '5:20 min/km', distanceKm: 2.4, sector: 'Ciclovia Pinheiros' },
    { name: 'Gabriel K.', pace: '5:10 min/km', distanceKm: 3.1, sector: 'Avenida Paulista' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className={`relative w-full max-w-xl rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl my-8 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-slate-900 border-cyan-500/30 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.15)]'
      }`}>
        <button
          onClick={onClose}
          className={`absolute top-5 right-5 p-2 rounded-xl border transition cursor-pointer ${
            isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5">
          <div className={`p-3.5 rounded-2xl border ${
            isLight ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-rose-950 border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
          }`}>
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
              isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-950 text-rose-400 border border-rose-500/30'
            }`}>
              SEGURANÇA & COMUNIDADE TÁTICA
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1">
              Live Tracking & SOS de Emergência
            </h2>
            <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Compartilhe sua localização em tempo real com familiares ou acione socorro em caso de emergência.
            </p>
          </div>
        </div>

        {/* Section 1: Live Tracking Link */}
        <div className={`p-4 rounded-2xl border space-y-2 font-mono ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <span className="text-xs font-bold uppercase text-cyan-500 flex items-center gap-1.5">
            <Share2 className="w-4 h-4" /> Link de Rastreamento ao Vivo (Live GPS)
          </span>
          <p className="text-[11px] text-slate-400">
            Envie este link para familiares acompanharem sua bolinha no mapa em tempo real durante o longão.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              readOnly
              value={liveLink}
              className={`flex-1 px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none ${
                isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                copiedLink
                  ? 'bg-emerald-500 text-white'
                  : isLight
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'COPIADO!' : 'COPIAR'}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Botão de Pânico (SOS) */}
        <div className={`p-4 rounded-2xl border space-y-3 font-mono ${
          sosTriggered
            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
            : isLight
            ? 'bg-rose-50 border-rose-200'
            : 'bg-slate-950 border-rose-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-rose-500 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Botão de Pânico (SOS)
            </span>
            <span className="text-[10px] text-slate-400">Contato: {emergencyContact}</span>
          </div>

          {sosTriggered ? (
            <div className="p-3 bg-rose-600 text-white rounded-xl text-xs font-bold text-center space-y-1">
              <p>🚨 ALERTA SOS DISPARADO COM SUCESSO!</p>
              <p className="text-[10px] font-normal opacity-90">
                SMS enviado para {emergencyContact} com coordenadas exatas de GPS (-23.5505, -46.6333).
              </p>
            </div>
          ) : (
            <button
              onClick={handleTriggerSOS}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30"
            >
              <PhoneCall className="w-4 h-4" /> DISPARAR ALERTA DE EMERGÊNCIA SOS (PRESSIONE)
            </button>
          )}
        </div>

        {/* Section 3: Match de Pace (Corredores Próximos) */}
        <div className={`p-4 rounded-2xl border space-y-3 font-mono ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <span className="text-xs font-bold uppercase text-amber-500 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Match de Pace (Corredores na Região)
          </span>

          <div className="space-y-2">
            {nearbyRunners.map((runner, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">{runner.name}</span>
                  <span className="text-[10px] text-slate-400">
                    Pace: {runner.pace} • {runner.sector} ({runner.distanceKm} km de distância)
                  </span>
                </div>
                <button
                  onClick={() => alert(`Convite de treino enviado para ${runner.name}!`)}
                  className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-bold cursor-pointer"
                >
                  Conectar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
