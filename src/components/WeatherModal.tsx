import React from 'react';
import {
  X,
  CloudRain,
  Sun,
  Droplets,
  Wind,
  ShieldCheck,
  Sparkles,
  Info,
  Thermometer,
  RotateCw,
  Clock,
  Compass,
} from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherModalProps {
  weather: WeatherData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  weather,
  isLoading,
  onRefresh,
  onClose,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  if (!weather) return null;

  const {
    temperatureC,
    apparentTemperatureC,
    humidityPercent,
    windSpeedKmh,
    precipitationMm,
    isDay,
    condition,
    hydration,
    gearSuggestions,
    locationName,
    fetchedAt,
  } = weather;

  const urgencyColors = {
    low: isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
    normal: isLight ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',
    high: isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-950/60 text-amber-300 border-amber-500/40',
    critical: isLight ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-rose-950/60 text-rose-300 border-rose-500/40 animate-pulse',
  };

  return (
    <div
      id="weather-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="weather-modal-content"
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col transition-all ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300'
            : 'bg-slate-900 border-cyan-500/30 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.15)]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl border ${
                isLight
                  ? 'bg-orange-100 border-orange-200 text-orange-600'
                  : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
              }`}
            >
              {condition.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black font-mono uppercase tracking-tight">
                  TELEMETRIA METEOROLÓGICA TÁTICA
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                  OPEN-METEO API
                </span>
              </div>
              <p className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {locationName || 'GPS Ao Vivo'} • Sincronizado às {fetchedAt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 text-xs font-mono ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
              }`}
              title="Atualizar dados meteorológicos"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Main Weather Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Temperature */}
            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                <span>TEMPERATURA</span>
                <Thermometer className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono">
                {temperatureC}°<span className="text-sm font-normal text-slate-400">C</span>
              </div>
              <span className={`text-[10px] font-mono block mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Sensação: <strong>{apparentTemperatureC}°C</strong>
              </span>
            </div>

            {/* Weather Condition */}
            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                <span>CONDIÇÃO</span>
                {isDay ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
              </div>
              <div className="text-sm sm:text-base font-black font-mono truncate">
                {condition.label.split(' ')[0]}
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mt-1 truncate">
                {condition.label}
              </span>
            </div>

            {/* Humidity */}
            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                <span>UMIDADE DO AR</span>
                <Droplets className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono">
                {humidityPercent}<span className="text-sm font-normal text-slate-400">%</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                {humidityPercent >= 70 ? 'Ar Muito Úmido' : humidityPercent <= 35 ? 'Ar Seco (Atenção)' : 'Umidade Ideal'}
              </span>
            </div>

            {/* Wind Speed */}
            <div
              className={`p-3.5 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                <span>VENTO</span>
                <Wind className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono">
                {windSpeedKmh}<span className="text-xs font-normal text-slate-400"> km/h</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                {precipitationMm > 0 ? `🌧️ ${precipitationMm}mm chuva` : 'Sem precipitação'}
              </span>
            </div>
          </div>

          {/* Section: Protocolo de Hidratação Inteligente */}
          <div
            className={`p-4 sm:p-5 rounded-3xl border space-y-3 ${
              isLight ? 'bg-sky-50/70 border-sky-200 text-slate-900' : 'bg-slate-950/90 border-cyan-500/30 text-cyan-100'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                <h4 className="font-mono font-black text-sm uppercase tracking-wide">
                  PROTOCOLO DE HIDRATAÇÃO TÁTICA
                </h4>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${urgencyColors[hydration.urgency]}`}>
                {hydration.status.split(':')[0]}
              </span>
            </div>

            <p className={`text-xs font-mono leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              {hydration.tip}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-cyan-500/20">
              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-sky-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block uppercase">
                  Volume / Intervalo
                </span>
                <span className="text-sm font-mono font-black text-cyan-500 dark:text-cyan-400">
                  {hydration.volumePerInterval}
                </span>
                <span className="text-[10px] font-mono block text-slate-500">
                  a cada {hydration.intervalMinutes} minutos
                </span>
              </div>

              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-sky-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block uppercase">
                  Reposição Eletrolítica
                </span>
                <span className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400 block">
                  {hydration.electrolytesRecommendation}
                </span>
              </div>

              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-sky-200' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block uppercase">
                  Meta Diária Total
                </span>
                <span className="text-sm font-mono font-black text-emerald-500 dark:text-emerald-400">
                  {hydration.dailyWaterTargetLiters} Litros / dia
                </span>
                <span className="text-[10px] font-mono block text-slate-500">
                  pré + durante + pós corrida
                </span>
              </div>
            </div>
          </div>

          {/* Section: Equipamento e Vestuário Sugerido */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="font-mono font-black text-sm uppercase tracking-wide">
                  EQUIPAMENTO & VESTUÁRIO SUGERIDO
                </h4>
              </div>
              <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {gearSuggestions.length} Recomendações
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gearSuggestions.map((gear) => {
                const importanceBadge = {
                  obrigatorio: isLight ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-rose-950/80 text-rose-300 border-rose-500/40',
                  recomendado: isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-950/80 text-amber-300 border-amber-500/40',
                  opcional: isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700',
                };

                return (
                  <div
                    key={gear.id}
                    className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all ${
                      isLight
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 hover:border-cyan-500/30'
                    }`}
                  >
                    <span className="text-2xl p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 shrink-0">
                      {gear.icon}
                    </span>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <h5 className="text-xs font-mono font-bold truncate">
                          {gear.title}
                        </h5>
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold border ${importanceBadge[gear.importance]}`}>
                          {gear.importance}
                        </span>
                      </div>
                      <p className={`text-[11px] font-sans leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {gear.reason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between text-xs font-mono ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/80 border-slate-800 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dados meteorológicos públicos de alta precisão via Open-Meteo REST.</span>
          </div>

          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-mono font-bold text-xs uppercase cursor-pointer transition ${
              isLight
                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black'
            }`}
          >
            ENTENDIDO & FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};
