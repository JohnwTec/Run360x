import React, { useState } from 'react';
import { Trophy, Award, Flame, Zap, Edit2, CheckCircle, Sparkles, Star } from 'lucide-react';
import confetti from 'canvas-confetti';

export interface PersonalRecord {
  id: string;
  category: '1k' | '5k' | '10k' | '21k' | '42k' | 'max_cadence';
  title: string;
  bestValue: string;
  dateUnlocked: string;
  icon: string;
}

interface PersonalRecordsWallProps {
  theme?: 'dark' | 'light';
}

export const PersonalRecordsWall: React.FC<PersonalRecordsWallProps> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  const [records, setRecords] = useState<PersonalRecord[]>([
    { id: '1', category: '1k', title: 'Melhor Tiro de 1km', bestValue: '3:52 min', dateUnlocked: '18/07/2026', icon: '⚡' },
    { id: '2', category: '5k', title: 'Recorde Pessoal 5km', bestValue: '21:40 min', dateUnlocked: '12/07/2026', icon: '🏆' },
    { id: '3', category: '10k', title: 'Recorde Pessoal 10km', bestValue: '46:15 min', dateUnlocked: '05/06/2026', icon: '🔥' },
    { id: '4', category: '21k', title: 'Meia Maratona (21km)', bestValue: '1h 44min', dateUnlocked: '15/05/2026', icon: '🚀' },
    { id: '5', category: '42k', title: 'Maratona (42km)', bestValue: '3h 42min', dateUnlocked: '01/04/2026', icon: '👑' },
    { id: '6', category: 'max_cadence', title: 'Maior Cadência (Passos)', bestValue: '184 PPM', dateUnlocked: '20/07/2026', icon: '🎯' },
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#00f0ff', '#ff0055', '#fbbf24', '#10b981'],
    });
  };

  const handleUpdateRecord = (id: string) => {
    if (!newValue.trim()) return;
    setRecords(records.map((r) => (r.id === id ? { ...r, bestValue: newValue, dateUnlocked: 'Hoje' } : r)));
    setEditingId(null);
    setNewValue('');
    triggerConfetti();
  };

  return (
    <div className={`p-6 rounded-3xl border space-y-6 transition-colors ${
      isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
              isLight ? 'bg-orange-100 text-orange-700' : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
            }`}>
              GALERIA DE CONQUISTAS
            </span>
          </div>
          <h2 className="text-xl font-black uppercase tracking-wide mt-1 flex items-center gap-2">
            Paredão dos Recordes Pessoais (RP)
            <Trophy className="w-5 h-5 text-amber-500" />
          </h2>
          <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Exiba suas melhores marcas históricas. Bater um RP gera celebração com brilho e fogos virtuais!
          </p>
        </div>

        <button
          onClick={triggerConfetti}
          className={`px-4 py-2 rounded-2xl font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            isLight
              ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Celebrar RP</span>
        </button>
      </div>

      {/* Grid of Records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {records.map((rec) => {
          const isEditing = editingId === rec.id;

          return (
            <div
              key={rec.id}
              className={`p-4 rounded-2xl border space-y-2 relative font-mono transition-all hover:scale-[1.02] ${
                isLight
                  ? 'bg-gradient-to-b from-slate-50 to-amber-50/30 border-slate-200 shadow-sm'
                  : 'bg-slate-950 border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.1)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{rec.icon}</span>
                <span className="text-[10px] text-slate-400 uppercase">{rec.dateUnlocked}</span>
              </div>

              <div>
                <span className="text-[10px] text-amber-500 font-bold uppercase block">{rec.title}</span>
                {isEditing ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="Ex: 19:45 min"
                      className={`w-full px-2 py-1 rounded border text-xs focus:outline-none ${
                        isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                    <button
                      onClick={() => handleUpdateRecord(rec.id)}
                      className="p-1 bg-emerald-500 text-white rounded cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                      {rec.bestValue}
                    </span>
                    <button
                      onClick={() => {
                        setEditingId(rec.id);
                        setNewValue(rec.bestValue);
                      }}
                      className="p-1 text-slate-400 hover:text-amber-500 cursor-pointer"
                      title="Editar Recorde"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
