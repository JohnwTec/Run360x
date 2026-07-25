import React, { useState } from 'react';
import { Activity, Award, CheckCircle, HelpCircle, Flame, Zap, Compass, X } from 'lucide-react';
import { UserProfile, TrainingLevelId } from '../types';

interface CooperTestModalProps {
  currentProfile: UserProfile;
  onConfirmLevel: (newLevelId: TrainingLevelId, vdot: number, vo2max: number) => void;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const CooperTestModal: React.FC<CooperTestModalProps> = ({
  currentProfile,
  onConfirmLevel,
  onClose,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [distanceMeters, setDistanceMeters] = useState<number | ''>(2200);

  // Cooper Test Calculations: VO2Max = (DistanceInMeters - 504.9) / 44.73
  const dist = Number(distanceMeters) || 0;
  const vo2max = dist > 505 ? Number(((dist - 504.9) / 44.73).toFixed(1)) : 0;

  // Approximate VDOT and recommended Level
  let recommendedLevelId: TrainingLevelId = 'nivel-1';
  let recommendedLevelTitle = 'Nível 1: Iniciante (Exploração Urbana)';
  let estimatedPace = '6:30 - 7:30 min/km';

  if (vo2max >= 54) {
    recommendedLevelId = 'nivel-5';
    recommendedLevelTitle = 'Nível 5: Maratonista / Elite (Odisseia 42K)';
    estimatedPace = '3:45 - 4:30 min/km';
  } else if (vo2max >= 48) {
    recommendedLevelId = 'nivel-4';
    recommendedLevelTitle = 'Nível 4: Meio Maratonista (Especialista em 21K)';
    estimatedPace = '4:30 - 5:00 min/km';
  } else if (vo2max >= 42) {
    recommendedLevelId = 'nivel-3';
    recommendedLevelTitle = 'Nível 3: Velocista / Experiente (Circuito de Elite)';
    estimatedPace = '5:00 - 5:30 min/km';
  } else if (vo2max >= 35) {
    recommendedLevelId = 'nivel-2';
    recommendedLevelTitle = 'Nível 2: Intermediário (Dominador de Bairros)';
    estimatedPace = '5:30 - 6:20 min/km';
  }

  const handleSave = () => {
    onConfirmLevel(recommendedLevelId, Math.round(vo2max * 0.95), vo2max);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className={`relative w-full max-w-xl rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl ${
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
            isLight ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-cyan-950 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
          }`}>
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
              isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
            }`}>
              AVALIAÇÃO FISIOLÓGICA
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1">
              Teste de Nivelamento Cooper (12 Min)
            </h2>
            <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Informe a distância máxima percorrida em 12 minutos de corrida/caminhada para calibrar seus ritmos e categoria.
            </p>
          </div>
        </div>

        {/* Input Distance */}
        <div className="space-y-2">
          <label className={`text-xs font-mono font-bold uppercase block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            Distância percorrida no Teste de 12 minutos (Metros)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={distanceMeters}
              onChange={(e) => setDistanceMeters(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 2400"
              step="50"
              className={`flex-1 px-4 py-3 rounded-2xl border text-base font-mono focus:outline-none transition ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'
                  : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500'
              }`}
            />
            <span className="text-xs font-mono font-bold text-slate-400">METROS</span>
          </div>
        </div>

        {/* Live Calculation Output Card */}
        <div className={`p-4 rounded-2xl border space-y-3 font-mono ${
          isLight ? 'bg-orange-50/50 border-orange-200 text-slate-800' : 'bg-slate-950 border-cyan-500/20 text-slate-200'
        }`}>
          <div className="text-xs font-bold uppercase flex items-center justify-between text-cyan-500">
            <span>Diagnóstico de Capacidade Cardiorrespiratória:</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
              Fórmula de Cooper
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
              <span className="text-[9px] uppercase text-slate-400 block">VO2 Máx Estimado</span>
              <span className="text-base font-black text-rose-500">{vo2max} ml/kg/min</span>
            </div>

            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
              <span className="text-[9px] uppercase text-slate-400 block">Ritmo de Prova Alvo</span>
              <span className="text-xs font-black text-emerald-500">{estimatedPace}</span>
            </div>

            <div className={`p-2.5 rounded-xl border col-span-2 sm:col-span-1 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
              <span className="text-[9px] uppercase text-slate-400 block">Nível Recomendado</span>
              <span className="text-xs font-black text-amber-500 truncate block">{recommendedLevelId.toUpperCase()}</span>
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <span className="font-bold text-orange-600 dark:text-cyan-400 block mb-0.5">
              🎯 RECOMENDAÇÃO DE ENCAIXE:
            </span>
            <span>{recommendedLevelTitle}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSave}
          className={`w-full py-4 font-bold font-mono rounded-2xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
            isLight
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
              : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
          }`}
        >
          <CheckCircle className="w-5 h-5" />
          <span>CONFIRMAR & ATUALIZAR CATEGORIA DE TREINO</span>
        </button>
      </div>
    </div>
  );
};
