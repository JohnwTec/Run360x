import React, { useRef, useEffect, useState } from 'react';
import { X, Instagram, Download, Share2, Copy, Check, Sparkles, Zap, Award, Flame, Map } from 'lucide-react';
import { WorkoutStats, TrainingLevel } from '../types';
import { generateStoryHeatmapCanvas } from '../utils/generateStoryHeatmap';

interface InstagramShareModalProps {
  stats: WorkoutStats;
  level: TrainingLevel;
  onClose: () => void;
  isLevelUp?: boolean;
}

export const InstagramShareModal: React.FC<InstagramShareModalProps> = ({
  stats,
  level,
  onClose,
  isLevelUp = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [stylePreset, setStylePreset] = useState<'neon' | 'sunset' | 'stealth'>('neon');

  const levelNum = level.levelNumber || 1;

  const captionText = `🚀 NOVO NÍVEL ALCANÇADO NO RUNLEVEL! 🏃‍♂️⚡\n\n` +
    `📍 Nível ${levelNum}: ${level.title}\n` +
    `⚡ Distância: ${(stats.totalDistanceMeters / 1000).toFixed(2)} KM\n` +
    `⏱️ Pace Médio: ${stats.avgPaceMinKm.toFixed(2)} min/km\n` +
    `🔥 XP Acumulado: +${stats.xpGained} XP\n` +
    `🗺️ Mapa de Calor Registrado com Sucesso!\n\n` +
    `Superando limites em cada km! @RunLevel #RunLevel #Heatmap #LevelUp #Corrida #Running #Pace #Gamificacao #RunApp`;

  // Draw 1080x1920 Instagram Story Heatmap Canvas
  useEffect(() => {
    const targetCanvas = canvasRef.current;
    if (!targetCanvas) return;

    // Generate story heatmap canvas using utility function
    const renderedCanvas = generateStoryHeatmapCanvas(stats, level, {
      stylePreset,
      width: 1080,
      height: 1920,
    });

    targetCanvas.width = 1080;
    targetCanvas.height = 1920;

    const ctx = targetCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(renderedCanvas, 0, 0);
    }
  }, [stats, level, stylePreset]);

  // Download Story Canvas as PNG Image
  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `RunLevel_LevelUp_Nivel${levelNum}.png`;
    link.href = dataUrl;
    link.click();

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  // Web Share API or Direct Copy
  const handleShareDirect = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `RunLevel_Story_Nivel${levelNum}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Level Up Nível ${levelNum} - RunLevel`,
            text: captionText,
            files: [file],
          });
        } catch {
          // Fallback if user canceled
        }
      } else {
        // Fallback: Copy Caption & trigger download
        navigator.clipboard.writeText(captionText);
        handleDownloadImage();
      }
    }, 'image/png');
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(captionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn font-sans">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border border-cyan-500/30 p-6 text-white shadow-[0_0_50px_rgba(6,182,212,0.25)] space-y-6">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-lg">
            <Instagram className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/40 uppercase">
                CONECTIVIDADE INSTAGRAM
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                1080 x 1920 HD
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide mt-1">
              Publicar Conquista no Instagram Stories
            </h2>
          </div>
        </div>

        {/* Style Preset Selector */}
        <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400 font-bold uppercase hidden sm:inline">Tema Visual do Story:</span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setStylePreset('neon')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl border font-bold transition flex items-center justify-center gap-1.5 ${
                stylePreset === 'neon'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> Neon Cyber
            </button>

            <button
              onClick={() => setStylePreset('sunset')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl border font-bold transition flex items-center justify-center gap-1.5 ${
                stylePreset === 'sunset'
                  ? 'bg-pink-500/20 border-pink-400 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.3)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-pink-400" /> Synthwave Sunset
            </button>

            <button
              onClick={() => setStylePreset('stealth')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl border font-bold transition flex items-center justify-center gap-1.5 ${
                stylePreset === 'stealth'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" /> Stealth Gold
            </button>
          </div>
        </div>

        {/* Content Layout: Left Canvas Preview, Right Action Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Canvas Story Preview */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase mb-2 block">
              Prévia de Cartão para Instagram Story (9:16)
            </span>
            <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-cyan-500/50">
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Publishing & Download Actions */}
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-pink-400 font-bold">
                <Instagram className="w-4 h-4" />
                <span className="uppercase">Legenda Pronta para Publicação</span>
              </div>
              <textarea
                value={captionText}
                readOnly
                rows={5}
                className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none resize-none font-mono"
              />
              <button
                onClick={handleCopyCaption}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold transition flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                <span>{copied ? 'Legenda Copiada!' : 'Copiar Legenda com Hashtags'}</span>
              </button>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleShareDirect}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 hover:opacity-95 text-white font-black text-sm uppercase tracking-wide shadow-lg transition flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                <span>Compartilhar Direto no Instagram</span>
              </button>

              <button
                onClick={handleDownloadImage}
                className="w-full py-3 rounded-2xl bg-slate-950 border border-cyan-500/50 hover:bg-slate-800 text-cyan-300 font-bold text-xs uppercase transition flex items-center justify-center gap-2"
              >
                {downloaded ? <Check className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4 text-cyan-400" />}
                <span>{downloaded ? 'Imagem Baixada!' : 'Baixar Imagem HD para Instagram (1080x1920)'}</span>
              </button>

              <a
                href="instagram://story-camera"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-2xl bg-slate-950 border border-pink-500/30 hover:bg-pink-950/30 text-pink-300 font-bold text-xs transition flex items-center justify-center gap-2 text-center block"
              >
                <Instagram className="w-4 h-4 text-pink-400 inline" />
                <span>Abrir Câmera do Instagram Stories</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
