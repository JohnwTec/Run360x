import React from 'react';
import { BarChart3, Monitor, Smartphone, Sparkles, Tablet, Watch } from 'lucide-react';
import { DevicePreference, getDeviceLabel, ResolvedDevice } from '../utils/deviceMode';

interface DeviceModeBarProps {
  preference: DevicePreference;
  activeDevice: ResolvedDevice;
  detectedDevice: ResolvedDevice;
  onChangePreference: (pref: DevicePreference) => void;
  onOpenAnalytics?: () => void;
  isAnalyticsActive?: boolean;
  theme?: 'dark' | 'light';
}

const OPTIONS: { id: DevicePreference; label: string; icon: React.ReactNode }[] = [
  { id: 'auto', label: 'Auto', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'smartwatch', label: 'Smartwatch', icon: <Watch className="w-3.5 h-3.5" /> },
  { id: 'smartphone', label: 'Smartphone', icon: <Smartphone className="w-3.5 h-3.5" /> },
  { id: 'tablet', label: 'Tablet', icon: <Tablet className="w-3.5 h-3.5" /> },
  { id: 'desktop', label: 'Computador', icon: <Monitor className="w-3.5 h-3.5" /> },
];

export const DeviceModeBar: React.FC<DeviceModeBarProps> = ({
  preference,
  activeDevice,
  detectedDevice,
  onChangePreference,
  onOpenAnalytics,
  isAnalyticsActive = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const isExpandedDevice = activeDevice === 'desktop' || activeDevice === 'tablet';

  return (
    <div
      className={`border-b transition-colors ${
        isLight
          ? 'bg-slate-50/95 border-slate-200 text-slate-700'
          : 'bg-slate-950/90 border-slate-800/90 text-slate-300'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className={`font-semibold whitespace-nowrap ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            Modo do Aparelho
          </span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span className={`truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {preference === 'auto'
              ? `Detectado: ${getDeviceLabel(detectedDevice)}`
              : `Visualização: ${getDeviceLabel(activeDevice)}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Selecionar modo estético por aparelho"
            className={`inline-flex items-center gap-1 p-1 rounded-xl border overflow-x-auto max-w-full ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}
          >
            {OPTIONS.map((opt) => {
              const isSelected = preference === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangePreference(opt.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? isLight
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-cyan-400 text-slate-950 shadow-sm'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {isExpandedDevice && onOpenAnalytics && (
            <button
              type="button"
              onClick={onOpenAnalytics}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                isAnalyticsActive
                  ? isLight
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-emerald-400 border-emerald-300 text-slate-950'
                  : isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-slate-900 hover:bg-slate-800 border-cyan-500/35 text-cyan-300'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Métricas & Gráficos</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceModeBar;
