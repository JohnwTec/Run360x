import React, { useState } from 'react';
import { User, Shield, Compass, Activity, Heart, Flame, Scale, Ruler, Calendar, Check, X, Sparkles, Mail } from 'lucide-react';
import { UserProfile } from '../types';

interface OnboardingModalProps {
  currentProfile: UserProfile;
  onSaveProfile: (profileData: { name: string; email?: string; age: number; heightCm: number; weightKg: number }) => void;
  onClose?: () => void;
  isInitialSetup?: boolean;
  theme?: 'dark' | 'light';
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  currentProfile,
  onSaveProfile,
  onClose,
  isInitialSetup = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const [name, setName] = useState(currentProfile.name || '');
  const [email, setEmail] = useState(currentProfile.email || '');
  const [age, setAge] = useState<number | ''>(currentProfile.age || 28);
  const [heightCm, setHeightCm] = useState<number | ''>(currentProfile.heightCm || 175);
  const [weightKg, setWeightKg] = useState<number | ''>(currentProfile.weightKg || 70);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Athletic Calculations
  const numAge = Number(age) || 0;
  const numHeight = Number(heightCm) || 0;
  const numWeight = Number(weightKg) || 0;

  // IMC = weight / (heightInMeters ^ 2)
  const heightM = numHeight / 100;
  const imc = heightM > 0 && numWeight > 0 ? (numWeight / (heightM * heightM)).toFixed(1) : null;

  // Max Heart Rate
  const maxHeartRate = numAge > 0 ? 220 - numAge : 190;

  // Estimated Calories per km (approx 1.03 kcal * weightKg)
  const caloriesPerKm = numWeight > 0 ? Math.round(1.03 * numWeight) : 70;

  // Basal Metabolic Rate (Mifflin-St Jeor approx)
  const bmr = numWeight > 0 && numHeight > 0 && numAge > 0
    ? Math.round(10 * numWeight + 6.25 * numHeight - 5 * numAge + 5)
    : 1600;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Por favor, informe seu nome ou codinome.';
    }
    if (email && (!email.includes('@') || !email.includes('.'))) {
      newErrors.email = 'Por favor, informe um endereço de e-mail válido.';
    }
    if (!age || Number(age) < 10 || Number(age) > 120) {
      newErrors.age = 'Informe uma idade válida (entre 10 e 120 anos).';
    }
    if (!heightCm || Number(heightCm) < 100 || Number(heightCm) > 250) {
      newErrors.heightCm = 'Informe uma altura válida em cm (ex: 175).';
    }
    if (!weightKg || Number(weightKg) < 30 || Number(weightKg) > 300) {
      newErrors.weightKg = 'Informe um peso válido em kg (ex: 70).';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSaveProfile({
      name: name.trim(),
      email: email.trim(),
      age: Number(age),
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className={`relative w-full max-w-xl rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl transition-all my-8 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-orange-500/10'
          : 'bg-slate-900 border-cyan-500/30 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.15)]'
      }`}>
        {/* Close button if not forced initial setup */}
        {!isInitialSetup && onClose && (
          <button
            onClick={onClose}
            className={`absolute top-5 right-5 p-2 rounded-xl border transition cursor-pointer ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center gap-3.5">
          <div className={`p-3.5 rounded-2xl border ${
            isLight
              ? 'bg-orange-50 border-orange-200 text-orange-600'
              : 'bg-cyan-950 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
          }`}>
            <Compass className="w-8 h-8 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
              }`}>
                {isInitialSetup ? 'BEM-VINDO AO RUNLEVEL' : 'PERFIL DO ATLETA'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1">
              Registro de Atleta Tático
            </h2>
            <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Insira suas métricas corporais para calibração personalizada de ritmo, zonas de FC e queima calórica.
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className={`text-xs font-mono font-bold uppercase flex items-center gap-1.5 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <User className="w-3.5 h-3.5 text-cyan-500" /> Nome Completo ou Codinome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              placeholder="Ex: Carlos Silva ou Atleta Alpha"
              className={`w-full px-4 py-3 rounded-2xl border text-sm font-sans focus:outline-none transition ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500 focus:bg-white'
                  : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500 focus:bg-slate-900'
              }`}
            />
            {errors.name && <p className="text-[11px] text-rose-500 font-mono">{errors.name}</p>}
          </div>

          {/* E-mail de Registro & Notificações de Metas */}
          <div className="space-y-1.5">
            <label className={`text-xs font-mono font-bold uppercase flex items-center gap-1.5 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <Mail className="w-3.5 h-3.5 text-emerald-400" /> Endereço de E-mail (Recebimento de Metas)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              placeholder="Ex: atleta@runlevel.com"
              className={`w-full px-4 py-3 rounded-2xl border text-sm font-mono focus:outline-none transition ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500 focus:bg-white'
                  : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500 focus:bg-slate-900'
              }`}
            />
            {errors.email && <p className="text-[11px] text-rose-500 font-mono">{errors.email}</p>}
            <p className="text-[11px] font-mono text-emerald-500 dark:text-emerald-400 flex items-center gap-1 mt-1 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              <span>📧</span>
              <span>
                As suas informações de treino, metas atingidas, relatórios semanais de evolução e certificados serão enviados para o seu e-mail cadastrado.
              </span>
            </p>
          </div>

          {/* Grid: Idade, Altura, Peso */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Idade */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-bold uppercase flex items-center gap-1.5 ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> Idade (Anos)
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value === '' ? '' : Number(e.target.value));
                  if (errors.age) setErrors({ ...errors, age: '' });
                }}
                placeholder="Ex: 28"
                min="10"
                max="120"
                className={`w-full px-4 py-3 rounded-2xl border text-sm font-mono focus:outline-none transition ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'
                    : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500'
                }`}
              />
              {errors.age && <p className="text-[11px] text-rose-500 font-mono">{errors.age}</p>}
            </div>

            {/* Altura */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-bold uppercase flex items-center gap-1.5 ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <Ruler className="w-3.5 h-3.5 text-emerald-500" /> Altura (cm)
              </label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => {
                  setHeightCm(e.target.value === '' ? '' : Number(e.target.value));
                  if (errors.heightCm) setErrors({ ...errors, heightCm: '' });
                }}
                placeholder="Ex: 175"
                min="100"
                max="250"
                className={`w-full px-4 py-3 rounded-2xl border text-sm font-mono focus:outline-none transition ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'
                    : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500'
                }`}
              />
              {errors.heightCm && <p className="text-[11px] text-rose-500 font-mono">{errors.heightCm}</p>}
            </div>

            {/* Peso */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-bold uppercase flex items-center gap-1.5 ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <Scale className="w-3.5 h-3.5 text-purple-500" /> Peso (kg)
              </label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => {
                  setWeightKg(e.target.value === '' ? '' : Number(e.target.value));
                  if (errors.weightKg) setErrors({ ...errors, weightKg: '' });
                }}
                placeholder="Ex: 70"
                min="30"
                max="300"
                className={`w-full px-4 py-3 rounded-2xl border text-sm font-mono focus:outline-none transition ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'
                    : 'bg-slate-950 border-slate-800 text-slate-100 focus:border-cyan-500'
                }`}
              />
              {errors.weightKg && <p className="text-[11px] text-rose-500 font-mono">{errors.weightKg}</p>}
            </div>
          </div>

          {/* Athletic Metrics Live Cards */}
          <div className={`p-4 rounded-2xl border space-y-2 text-xs font-mono ${
            isLight ? 'bg-orange-50/50 border-orange-200 text-slate-800' : 'bg-slate-950 border-cyan-500/20 text-slate-300'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Métricas Fisiológicas Calculadas em Tempo Real:
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[9px] uppercase text-slate-400 block">IMC Corporal</span>
                <span className="text-sm font-bold font-mono text-cyan-500">{imc || '--'}</span>
              </div>

              <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[9px] uppercase text-slate-400 block">FC Máx Estimada</span>
                <span className="text-sm font-bold font-mono text-rose-500">{maxHeartRate} bpm</span>
              </div>

              <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[9px] uppercase text-slate-400 block">Metabolismo Basal</span>
                <span className="text-sm font-bold font-mono text-amber-500">{bmr} kcal/dia</span>
              </div>

              <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[9px] uppercase text-slate-400 block">Gasto Estimado</span>
                <span className="text-sm font-bold font-mono text-emerald-500">~{caloriesPerKm} kcal/km</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            className={`w-full py-4 font-bold font-mono rounded-2xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
              isLight
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            }`}
          >
            <Check className="w-5 h-5" />
            <span>{isInitialSetup ? 'CONFIRMAR CADASTRO & ENTRAR NO RADAR' : 'SALVAR ALTERAÇÕES DO PERFIL'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
