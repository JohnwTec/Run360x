import React, { useEffect, useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Gauge,
  Flag,
  ShieldAlert,
  Sliders,
  Play,
  Square,
  Radio,
  History,
  Trash2,
} from 'lucide-react';
import { AudioCoachSettings } from '../types';
import { AudioCoachSnapshot, tacticalAudio } from '../utils/audio';

interface AudioCoachSettingsModalProps {
  onClose: () => void;
  theme?: 'dark' | 'light';
  currentPaceMinKm?: number;
  targetPaceMinKm?: number;
  currentSpeedKmh?: number;
  totalDistanceMeters?: number;
  elapsedSeconds?: number;
}

export const AudioCoachSettingsModal: React.FC<AudioCoachSettingsModalProps> = ({
  onClose,
  theme = 'dark',
  currentPaceMinKm = 5.25,
  targetPaceMinKm = 5.5,
  currentSpeedKmh = 11.4,
  totalDistanceMeters = 1000,
  elapsedSeconds = 315,
}) => {
  const isLight = theme === 'light';
  const [snapshot, setSnapshot] = useState<AudioCoachSnapshot>(() => tacticalAudio.getSnapshot());

  useEffect(() => {
    return tacticalAudio.subscribe(setSnapshot);
  }, []);

  const { settings, availableVoices, isSpeaking, recentAnnouncements, supported } = snapshot;

  const update = (patch: Partial<AudioCoachSettings>) => {
    tacticalAudio.updateSettings(patch);
  };

  const categoryBadge = (category: string) => {
    switch (category) {
      case 'pace':
        return {
          label: 'RITMO',
          cls: isLight
            ? 'bg-sky-100 text-sky-800 border-sky-200'
            : 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
        };
      case 'milestone':
        return {
          label: 'MARCO',
          cls: isLight
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
        };
      case 'combat_zone':
        return {
          label: 'COMBATE',
          cls: isLight
            ? 'bg-rose-100 text-rose-800 border-rose-200'
            : 'bg-rose-950 text-rose-300 border-rose-500/40',
        };
      default:
        return {
          label: 'SISTEMA',
          cls: isLight
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-amber-950 text-amber-300 border-amber-500/40',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
            : 'bg-slate-900 border-cyan-500/30 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.15)]'
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                settings.enabled
                  ? isLight
                    ? 'bg-orange-100 border-orange-200 text-orange-600'
                    : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {settings.enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black font-mono uppercase tracking-tight">
                  AUDIO COACH • WEB SPEECH API
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                    supported
                      ? isLight
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-950 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {supported ? 'VOZ ATIVA' : 'SEM SUPORTE TTS'}
                </span>
              </div>
              <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Alertas por voz de ritmo, marcos de distância e zonas de combate durante o treino
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
            aria-label="Fechar configurações do Audio Coach"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {!supported && (
            <div className="p-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-xs font-mono text-amber-300">
              Seu navegador não oferece suporte nativo à Web Speech API (`speechSynthesis`). Os avisos continuarão sendo exibidos no painel visual de legendas ao vivo do HUD.
            </div>
          )}

          {/* Master Toggle */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div>
              <p className="text-sm font-black font-mono uppercase">Narrador Tático por Voz</p>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Ativa ou silencia todos os comandos de voz e sinais sonoros da sessão
              </p>
            </div>
            <button
              onClick={() => update({ enabled: !settings.enabled })}
              className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase transition cursor-pointer border ${
                settings.enabled
                  ? isLight
                    ? 'bg-orange-500 hover:bg-orange-600 border-orange-600 text-white'
                    : 'bg-cyan-500 hover:bg-cyan-400 border-cyan-400 text-slate-950'
                  : isLight
                  ? 'bg-slate-200 text-slate-600 border-slate-300'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {settings.enabled ? 'LIGADO' : 'MUDO'}
            </button>
          </div>

          {/* Prompt Categories */}
          <div className="space-y-2.5">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              CATEGORIAS DE ANÚNCIO AUTOMÁTICO
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Pace */}
              <button
                onClick={() => update({ announcePace: !settings.announcePace })}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer space-y-1.5 ${
                  settings.announcePace
                    ? isLight
                      ? 'bg-sky-50 border-sky-400 text-sky-900'
                      : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-100'
                    : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-mono font-bold">
                    {settings.announcePace ? 'ATIVO' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs font-mono font-bold uppercase">Ritmo (Pace)</p>
                <p className="text-[10px] opacity-80 leading-snug">
                  Lê ritmo atual, comparação com a meta e alertas de desvio.
                </p>
              </button>

              {/* Milestones */}
              <button
                onClick={() => update({ announceMilestones: !settings.announceMilestones })}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer space-y-1.5 ${
                  settings.announceMilestones
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                      : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100'
                    : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Flag className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-mono font-bold">
                    {settings.announceMilestones ? 'ATIVO' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs font-mono font-bold uppercase">Marcos de Distância</p>
                <p className="text-[10px] opacity-80 leading-snug">
                  Parciais de distância, metade do percurso e conclusão da meta.
                </p>
              </button>

              {/* Combat Zones */}
              <button
                onClick={() => update({ announceCombatZones: !settings.announceCombatZones })}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer space-y-1.5 ${
                  settings.announceCombatZones
                    ? isLight
                      ? 'bg-rose-50 border-rose-400 text-rose-900'
                      : 'bg-rose-950/50 border-rose-500/50 text-rose-100'
                    : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span className="text-[10px] font-mono font-bold">
                    {settings.announceCombatZones ? 'ATIVO' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs font-mono font-bold uppercase">Zonas de Combate</p>
                <p className="text-[10px] opacity-80 leading-snug">
                  Aviso de aproximação, entrada com prioridade máxima e conquista.
                </p>
              </button>
            </div>
          </div>

          {/* Cadence & Milestone Interval Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Milestone Step */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <span className="text-[10px] font-mono font-bold uppercase block opacity-80">
                Intervalo dos Marcos de Distância
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {([250, 500, 1000] as const).map((meters) => (
                  <button
                    key={meters}
                    onClick={() => update({ milestoneStepMeters: meters })}
                    className={`py-1.5 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                      settings.milestoneStepMeters === meters
                        ? isLight
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : isLight
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {meters === 1000 ? '1 km' : `${meters}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Pace Update Frequency */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <span className="text-[10px] font-mono font-bold uppercase block opacity-80">
                Frequência de Relatório de Ritmo
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[30, 45, 60, 120].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => update({ paceIntervalSeconds: sec })}
                    className={`py-1.5 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                      settings.paceIntervalSeconds === sec
                        ? isLight
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : isLight
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Voice Selection, Rate & Volume */}
          <div
            className={`p-4 rounded-2xl border space-y-3.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Parâmetros de Síntese de Voz</span>
            </div>

            {/* Voice Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase opacity-75 block">
                Voz do Navegador (Web Speech API)
              </label>
              <select
                value={settings.voiceURI || ''}
                onChange={(e) => update({ voiceURI: e.target.value || null })}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                <option value="">Automática (Prioridade Português Brasil)</option>
                {availableVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Rate & Volume Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="opacity-80">Velocidade da Fala</span>
                  <span className="font-bold text-cyan-500">{settings.rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.85}
                  max={1.35}
                  step={0.05}
                  value={settings.rate}
                  onChange={(e) => update({ rate: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="opacity-80">Volume do Coach</span>
                  <span className="font-bold text-cyan-500">{Math.round(settings.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={settings.volume}
                  onChange={(e) => update({ volume: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Live Voice Test Triggers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                TESTAR COMANDOS DE VOZ AGORA
              </span>
              {isSpeaking && (
                <button
                  onClick={() => tacticalAudio.stopAllSpeech()}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/30"
                >
                  <Square className="w-3 h-3 fill-current" /> PARAR FALA
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() =>
                  tacticalAudio.announcePaceUpdate({
                    currentPaceMinKm,
                    targetPaceMinKm,
                    speedKmh: currentSpeedKmh,
                    totalDistanceMeters,
                    elapsedSeconds,
                    reason: 'manual',
                  })
                }
                disabled={!settings.enabled}
                className={`px-3 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 ${
                  isLight
                    ? 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800'
                    : 'bg-cyan-950/80 hover:bg-cyan-900 border-cyan-500/40 text-cyan-300'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Testar Ritmo
              </button>

              <button
                onClick={() =>
                  tacticalAudio.announceDistanceMilestone({
                    distanceMeters: Math.max(settings.milestoneStepMeters, totalDistanceMeters),
                    targetDistanceMeters: 3000,
                    currentPaceMinKm,
                    elapsedSeconds,
                  })
                }
                disabled={!settings.enabled}
                className={`px-3 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/40 text-emerald-300'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Testar Marco
              </button>

              <button
                onClick={() =>
                  tacticalAudio.announceCombatZoneAlert({
                    phase: 'entered',
                    zoneTitle: 'Zona de Combate: Tiro de 400 Metros',
                    description: 'Mantenha ritmo acima de 12 quilômetros por hora durante esta reta!',
                    manual: true,
                  })
                }
                disabled={!settings.enabled}
                className={`px-3 py-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 ${
                  isLight
                    ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800'
                    : 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-300'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Testar Combate
              </button>
            </div>
          </div>

          {/* Recent Announcements Log */}
          {recentAnnouncements.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <History className="w-3.5 h-3.5" /> HISTÓRICO DE ANÚNCIOS DA SESSÃO
                </span>
                <button
                  onClick={() => tacticalAudio.clearHistory()}
                  className="text-[10px] font-mono text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Limpar
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {recentAnnouncements.map((item) => {
                  const badge = categoryBadge(item.category);
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <p className="flex-1 leading-snug text-[11px]">{item.text}</p>
                      <span className="text-[9px] font-mono opacity-60 shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
