import React, { useState, useEffect } from 'react';
import { Watch, Headphones, HeartPulse, Radio, Wifi, BatteryCharging, Check, RefreshCw, X, Zap, Volume2, ShieldCheck, Bluetooth, Plus, Activity } from 'lucide-react';
import { ConnectedDevice, DeviceCategory } from '../types';

interface DeviceHubModalProps {
  onClose: () => void;
  theme?: 'dark' | 'light';
}

const DEFAULT_DEVICES: ConnectedDevice[] = [
  {
    id: 'dev-1',
    name: 'Garmin Forerunner 965',
    category: 'watch',
    brand: 'Garmin',
    status: 'connected',
    batteryLevel: 88,
    lastSync: 'Há 2 min',
    metricsProvided: ['Frequência Cardíaca (ECG)', 'Cadência (RPM)', 'GPS Altimetria', 'VO2 Max'],
    connectionType: 'Bluetooth LE',
  },
  {
    id: 'dev-2',
    name: 'Apple Watch Ultra 2',
    category: 'watch',
    brand: 'Apple',
    status: 'disconnected',
    batteryLevel: 94,
    lastSync: 'Ontem',
    metricsProvided: ['Apple HealthKit', 'Zonas de Esforço', 'Oxigenação SpO2'],
    connectionType: 'HealthKit',
  },
  {
    id: 'dev-3',
    name: 'AirPods Pro 2 (Áudio Tático)',
    category: 'headphones',
    brand: 'Apple',
    status: 'connected',
    batteryLevel: 100,
    lastSync: 'Conectado Agora',
    metricsProvided: ['Treinador IA por Voz', 'Áudio Espacial 3D', 'Comando de Toque'],
    connectionType: 'Bluetooth LE',
  },
  {
    id: 'dev-4',
    name: 'Cinta Cardíaca Polar H10',
    category: 'health_sensor',
    brand: 'Polar',
    status: 'connected',
    batteryLevel: 76,
    lastSync: 'Ao Vivo (148 BPM)',
    metricsProvided: ['ECG Precisão', 'Variabilidade Frequência Cardíaca (VFC)'],
    connectionType: 'Bluetooth LE',
  },
  {
    id: 'dev-5',
    name: 'Stryd Foot Pod (Potenciômetro)',
    category: 'health_sensor',
    brand: 'Stryd',
    status: 'disconnected',
    batteryLevel: 62,
    lastSync: 'Há 3 dias',
    metricsProvided: ['Potência de Corrida (Watts)', 'Tempo de Contato com Solo (ms)'],
    connectionType: 'ANT+',
  },
  {
    id: 'dev-6',
    name: 'Balança Bioimpedância Garmin Index',
    category: 'health_sensor',
    brand: 'Garmin',
    status: 'connected',
    batteryLevel: 90,
    lastSync: 'Hoje, 07:30',
    metricsProvided: ['Massa Magra (%)', 'Gordura Corporal (%)', 'Hidratação (L)'],
    connectionType: 'Web API',
  }
];

export const DeviceHubModal: React.FC<DeviceHubModalProps> = ({ onClose, theme = 'dark' }) => {
  const isLight = theme === 'light';
  const [activeCategory, setActiveCategory] = useState<DeviceCategory | 'all'>('all');
  const [devices, setDevices] = useState<ConnectedDevice[]>(() => {
    const saved = localStorage.getItem('runlevel_connected_devices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_DEVICES;
      }
    }
    return DEFAULT_DEVICES;
  });

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');
  const [voiceCoachEnabled, setVoiceCoachEnabled] = useState<boolean>(true);
  const [bpmStream, setBpmStream] = useState<number>(142);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('runlevel_connected_devices', JSON.stringify(devices));
  }, [devices]);

  // Live heart rate telemetry ticker simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setBpmStream((prev) => {
        const delta = (Math.random() - 0.5) * 4;
        return Math.round(Math.min(185, Math.max(120, prev + delta)));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleDeviceStatus = (id: string) => {
    setDevices((prev) =>
      prev.map((dev) => {
        if (dev.id === id) {
          const nextStatus = dev.status === 'connected' ? 'disconnected' : 'connected';
          return {
            ...dev,
            status: nextStatus,
            lastSync: nextStatus === 'connected' ? 'Conectado Agora' : 'Desconectado',
          };
        }
        return dev;
      })
    );
  };

  // Real Web Bluetooth pairing attempt
  const handleScanWebBluetooth = async () => {
    setIsScanning(true);
    setScanMessage('Procurando dispositivos Bluetooth LE (Cintas, Relógios, Sensores)...');

    if ('bluetooth' in navigator) {
      try {
        // @ts-ignore
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ['heart_rate'] }],
          optionalServices: ['battery_service']
        });

        if (device) {
          const newDev: ConnectedDevice = {
            id: `ble-${Date.now()}`,
            name: device.name || 'Sensor Cardíaco Bluetooth LE',
            category: 'health_sensor',
            brand: 'Bluetooth LE',
            status: 'connected',
            batteryLevel: 95,
            lastSync: 'Conectado via Web Bluetooth',
            metricsProvided: ['Frequência Cardíaca (BPM Ao Vivo)', 'Bateria GATT'],
            connectionType: 'Bluetooth LE',
          };
          setDevices((prev) => [newDev, ...prev]);
          setScanMessage(`✅ Dispositivo "${newDev.name}" pareado com sucesso!`);
        }
      } catch (error) {
        setScanMessage('⚠️ Pareamento Bluetooth simulado concluído (Dispositivo adicionado à lista).');
        simulateNewDevice();
      }
    } else {
      setScanMessage('ℹ️ Navegador não possui Web Bluetooth habilitado. Ativando pareamento simulado tático...');
      simulateNewDevice();
    }

    setTimeout(() => {
      setIsScanning(false);
    }, 2500);
  };

  const simulateNewDevice = () => {
    const simDevice: ConnectedDevice = {
      id: `sim-${Date.now()}`,
      name: 'Smart Sensor HR Pro',
      category: 'health_sensor',
      brand: 'Garmin / Polar Compatible',
      status: 'connected',
      batteryLevel: 99,
      lastSync: 'Conectado Agora',
      metricsProvided: ['ECG Frequência Cardíaca', 'Cadência de Corrida'],
      connectionType: 'Bluetooth LE',
    };
    setDevices((prev) => [simDevice, ...prev]);
  };

  const filteredDevices = activeCategory === 'all'
    ? devices
    : devices.filter((d) => d.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div
        className={`relative w-full max-w-3xl rounded-3xl border p-6 sm:p-8 space-y-6 shadow-2xl transition-all my-8 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-orange-500/10'
            : 'bg-slate-900 border-cyan-500/40 text-slate-100 shadow-[0_0_60px_rgba(6,182,212,0.2)]'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-5 right-5 p-2 rounded-xl border transition cursor-pointer ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
              : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Bluetooth className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30 uppercase">
                  CENTRAL DE CONECTIVIDADE BLE / HEALTH
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span>HR: {bpmStream} BPM</span>
                </span>
              </div>
              <h2 className="text-xl font-black uppercase tracking-wide mt-1">
                Dispositivos & Sensores de Saúde
              </h2>
            </div>
          </div>

          <button
            onClick={handleScanWebBluetooth}
            disabled={isScanning}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'PROCURANDO...' : '+ CONECTAR NOVO DISPOSITIVO'}</span>
          </button>
        </div>

        {scanMessage && (
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 font-mono text-xs text-cyan-400 flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer ${
              activeCategory === 'all'
                ? isLight ? 'bg-orange-500 text-white border-orange-500' : 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                : isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            TODOS OS DISPOSITIVOS ({devices.length})
          </button>

          <button
            onClick={() => setActiveCategory('watch')}
            className={`px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'watch'
                ? isLight ? 'bg-orange-500 text-white border-orange-500' : 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                : isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <Watch className="w-3.5 h-3.5" /> SMARTWATCHES
          </button>

          <button
            onClick={() => setActiveCategory('headphones')}
            className={`px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'headphones'
                ? isLight ? 'bg-orange-500 text-white border-orange-500' : 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                : isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" /> FONES DE OUVIDO
          </button>

          <button
            onClick={() => setActiveCategory('health_sensor')}
            className={`px-3 py-1.5 rounded-xl border font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'health_sensor'
                ? isLight ? 'bg-orange-500 text-white border-orange-500' : 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                : isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" /> SENSORES DE SAÚDE
          </button>
        </div>

        {/* Audio Coach via Headphones Quick Switch */}
        <div className={`p-4 rounded-2xl border space-y-3 font-mono ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase text-slate-200">
                Avisos Sonoros no Fone de Ouvido (Audio Coach AI)
              </span>
            </div>
            <button
              onClick={() => setVoiceCoachEnabled(!voiceCoachEnabled)}
              className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition ${
                voiceCoachEnabled
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {voiceCoachEnabled ? 'ATIVADO' : 'DESATIVADO'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Transmissão tática em tempo real para os fones conectando alertas de zona cardíaca, tempo restante de tiros e orbes de XP coletados no mapa.
          </p>
        </div>

        {/* Devices Grid List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredDevices.map((dev) => {
            const isConnected = dev.status === 'connected';

            return (
              <div
                key={dev.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 font-mono ${
                  isConnected
                    ? isLight
                      ? 'bg-emerald-50/50 border-emerald-300 text-slate-900'
                      : 'bg-slate-950 border-emerald-500/40 text-slate-100 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                    : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-600 opacity-80'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${
                      dev.category === 'watch' ? 'bg-amber-500/20 text-amber-400' :
                      dev.category === 'headphones' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-rose-500/20 text-rose-400'
                    }`}>
                      {dev.category === 'watch' && <Watch className="w-5 h-5" />}
                      {dev.category === 'headphones' && <Headphones className="w-5 h-5" />}
                      {dev.category === 'health_sensor' && <HeartPulse className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold uppercase text-slate-100">{dev.name}</h4>
                      <span className="text-[10px] text-slate-400">{dev.brand} • {dev.connectionType}</span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* Metrics Badges */}
                <div className="flex flex-wrap gap-1">
                  {dev.metricsProvided.map((metric, i) => (
                    <span
                      key={i}
                      className="text-[9px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      {metric}
                    </span>
                  ))}
                </div>

                {/* Battery & Action Controls */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{dev.batteryLevel ?? 85}%</span>
                    <span className="text-[10px] text-slate-500">• {dev.lastSync}</span>
                  </div>

                  <button
                    onClick={() => toggleDeviceStatus(dev.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition border ${
                      isConnected
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                    }`}
                  >
                    {isConnected ? 'DESCONECTAR' : 'CONECTAR'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sync External Platforms */}
        <div className={`p-4 rounded-2xl border space-y-3 font-mono ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-950 border-slate-800 text-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">
              Sincronização com Plataformas de Saúde & Fitness:
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold flex flex-col items-center justify-center gap-1">
              <span className="text-orange-400">🔥 STRAVA</span>
              <span className="text-[9px] text-emerald-400">Sincronizado</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold flex flex-col items-center justify-center gap-1">
              <span className="text-cyan-400">⌚ GARMIN CONNECT</span>
              <span className="text-[9px] text-emerald-400">Sincronizado</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold flex flex-col items-center justify-center gap-1">
              <span className="text-rose-400">🍎 APPLE HEALTH</span>
              <span className="text-[9px] text-emerald-400">Sincronizado</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold flex flex-col items-center justify-center gap-1">
              <span className="text-emerald-400">🟢 POLAR FLOW</span>
              <span className="text-[9px] text-emerald-400">Sincronizado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
