import React, { useState } from 'react';
import { ShieldAlert, Plus, Trash2, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';

export interface RunningShoe {
  id: string;
  brand: string;
  model: string;
  kmAccumulated: number;
  maxKmLimit: number;
  isActive: boolean;
}

interface ShoeTrackerProps {
  theme?: 'dark' | 'light';
}

export const ShoeTracker: React.FC<ShoeTrackerProps> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  const [shoes, setShoes] = useState<RunningShoe[]>([
    { id: '1', brand: 'Olympikus', model: 'Corre 3', kmAccumulated: 340, maxKmLimit: 600, isActive: true },
    { id: '2', brand: 'Asics', model: 'Novablast 4', kmAccumulated: 520, maxKmLimit: 600, isActive: false },
  ]);

  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddShoe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.trim() || !newModel.trim()) return;

    const newShoe: RunningShoe = {
      id: `shoe-${Date.now()}`,
      brand: newBrand.trim(),
      model: newModel.trim(),
      kmAccumulated: 0,
      maxKmLimit: 600,
      isActive: shoes.length === 0,
    };

    setShoes([...shoes, newShoe]);
    setNewBrand('');
    setNewModel('');
    setShowAddForm(false);
  };

  const handleToggleActive = (id: string) => {
    setShoes(shoes.map((s) => ({ ...s, isActive: s.id === id })));
  };

  const handleDeleteShoe = (id: string) => {
    setShoes(shoes.filter((s) => s.id !== id));
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
              PREVENÇÃO DE LESÕES
            </span>
          </div>
          <h2 className="text-xl font-black uppercase tracking-wide mt-1">
            Controle de Quilometragem do Tênis
          </h2>
          <p className={`text-xs font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Monitore a vida útil do amortecimento (limite de 500km a 600km) para proteger articulações e evitar lesões.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2.5 rounded-2xl font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            isLight
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Calçado</span>
        </button>
      </div>

      {/* Form Add Shoe */}
      {showAddForm && (
        <form onSubmit={handleAddShoe} className={`p-4 rounded-2xl border space-y-3 font-mono ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Marca do Tênis</label>
              <input
                type="text"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Ex: Nike, Asics, Olympikus"
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${
                  isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Modelo</label>
              <input
                type="text"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="Ex: Vaporfly 3, Gel Nimbus"
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${
                  isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold"
            >
              Salvar Calçado
            </button>
          </div>
        </form>
      )}

      {/* Shoes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shoes.map((shoe) => {
          const percent = Math.min(100, Math.round((shoe.kmAccumulated / shoe.maxKmLimit) * 100));
          const isWarning = shoe.kmAccumulated >= 500;
          const isDanger = shoe.kmAccumulated >= shoe.maxKmLimit;

          return (
            <div
              key={shoe.id}
              className={`p-4 rounded-2xl border space-y-3 relative font-mono transition-all ${
                shoe.isActive
                  ? isLight
                    ? 'bg-orange-50/60 border-orange-300 ring-1 ring-orange-300'
                    : 'bg-slate-950 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                  : isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-slate-950/60 border-slate-800 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">{shoe.brand}</span>
                    {shoe.isActive && (
                      <span className="text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" /> EM USO NO TREINO
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {shoe.model}
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  {!shoe.isActive && (
                    <button
                      onClick={() => handleToggleActive(shoe.id)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-cyan-500 hover:text-slate-950 cursor-pointer"
                    >
                      Ativar
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteShoe(shoe.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Kilometer Progress Track */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Quilometragem:</span>
                  <span className="font-bold">
                    <span className={isDanger ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-emerald-500'}>
                      {shoe.kmAccumulated} km
                    </span>{' '}
                    / {shoe.maxKmLimit} km ({percent}%)
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden border border-slate-300 dark:border-slate-700">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isDanger
                        ? 'bg-rose-500'
                        : isWarning
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Status Warning Alert Banner */}
              {isWarning && (
                <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-[11px] font-bold ${
                  isDanger
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {isDanger
                      ? '⚠️ Limite de 600km atingido! Substitua este tênis imediatamente.'
                      : '⚠️ Absorção de impacto reduzida! Risco de canelite elevado.'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
