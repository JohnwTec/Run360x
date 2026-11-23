import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Instagram,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';

export interface SocialShareMetric {
  label: string;
  value: string;
}

export interface SocialSharePayload {
  kind: 'workout' | 'profile' | 'record' | 'app';
  badge: string;
  title: string;
  subtitle: string;
  metrics: SocialShareMetric[];
  defaultCaption: string;
  hashtags?: string[];
  shareUrl?: string;
}

interface SocialShareModalProps {
  payload: SocialSharePayload;
  onClose: () => void;
  onOpenInstagramStory?: () => void;
  theme?: 'dark' | 'light';
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  payload,
  onClose,
  onOpenInstagramStory,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const shareUrl =
    payload.shareUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://run360x.app');

  const [caption, setCaption] = useState<string>(payload.defaultCaption);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [nativeFeedback, setNativeFeedback] = useState<string | null>(null);
  const [cardTheme, setCardTheme] = useState<'neon' | 'sunset' | 'light'>(
    isLight ? 'light' : 'neon'
  );

  // Sync caption when payload changes
  useEffect(() => {
    setCaption(payload.defaultCaption);
  }, [payload.defaultCaption]);

  // Render 1080x1080 Social Share Card onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 1080;
    canvas.width = size;
    canvas.height = size;

    // Background gradient based on cardTheme
    const bg = ctx.createLinearGradient(0, 0, size, size);
    if (cardTheme === 'light') {
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.5, '#f8fafc');
      bg.addColorStop(1, '#fff7ed');
    } else if (cardTheme === 'sunset') {
      bg.addColorStop(0, '#12071f');
      bg.addColorStop(0.55, '#1f0a2b');
      bg.addColorStop(1, '#0b1021');
    } else {
      bg.addColorStop(0, '#040914');
      bg.addColorStop(0.55, '#071324');
      bg.addColorStop(1, '#09071a');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const accent =
      cardTheme === 'light' ? '#ea580c' : cardTheme === 'sunset' ? '#f43f5e' : '#00f0ff';
    const secondary =
      cardTheme === 'light' ? '#0284c7' : cardTheme === 'sunset' ? '#f59e0b' : '#a855f7';
    const textPrimary = cardTheme === 'light' ? '#0f172a' : '#ffffff';
    const textMuted = cardTheme === 'light' ? '#475569' : '#94a3b8';
    const panelBg =
      cardTheme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.78)';
    const panelBorder =
      cardTheme === 'light' ? '#e2e8f0' : cardTheme === 'sunset' ? 'rgba(244,63,94,0.4)' : 'rgba(0,240,255,0.32)';

    // Subtle tactical grid
    ctx.strokeStyle =
      cardTheme === 'light' ? 'rgba(148,163,184,0.16)' : 'rgba(0,240,255,0.06)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // Top accent bar
    const barGrad = ctx.createLinearGradient(0, 0, size, 0);
    barGrad.addColorStop(0, accent);
    barGrad.addColorStop(1, secondary);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, size, 16);

    // Brand Header
    ctx.fillStyle = accent;
    ctx.font = '900 46px sans-serif';
    ctx.fillText('RUN360X', 72, 112);

    ctx.fillStyle = textMuted;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('RADAR TÁTICO • TELEMETRIA DE CORRIDA', 72, 148);

    // Badge Pill
    ctx.fillStyle = panelBg;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(72, 195, 520, 52, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = 'bold 22px monospace';
    ctx.fillText(payload.badge.toUpperCase().slice(0, 34), 98, 229);

    // Main Title & Subtitle
    ctx.fillStyle = textPrimary;
    ctx.font = '900 54px sans-serif';
    const titleLines = payload.title.length > 26
      ? [payload.title.slice(0, 26), payload.title.slice(26, 52)]
      : [payload.title];
    titleLines.forEach((line, idx) => {
      ctx.fillText(line.trim(), 72, 330 + idx * 66);
    });

    ctx.fillStyle = textMuted;
    ctx.font = '600 26px monospace';
    ctx.fillText(payload.subtitle.slice(0, 48), 72, titleLines.length > 1 ? 446 : 388);

    // Metrics Cards Grid (2x2)
    const visibleMetrics = payload.metrics.slice(0, 4);
    const gridTop = 490;
    const cardW = 446;
    const cardH = 188;
    const gap = 44;

    visibleMetrics.forEach((metric, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 72 + col * (cardW + gap);
      const y = gridTop + row * (cardH + gap);

      ctx.fillStyle = panelBg;
      ctx.strokeStyle = panelBorder;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = textMuted;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(metric.label.toUpperCase(), x + 32, y + 54);

      ctx.fillStyle = idx % 2 === 0 ? accent : secondary;
      ctx.font = '900 54px monospace';
      ctx.fillText(metric.value.slice(0, 12), x + 32, y + 136);
    });

    // Footer Banner
    ctx.fillStyle = panelBg;
    ctx.strokeStyle = panelBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(72, 948, size - 144, 72, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textPrimary;
    ctx.font = 'bold 22px monospace';
    ctx.fillText('⚡ DESAFIE SEUS LIMITES NO RUN360X', 106, 992);

    ctx.fillStyle = accent;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('#RUN360X', size - 230, 992);
  }, [payload, cardTheme]);

  const encodedCaption = encodeURIComponent(caption);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedFull = encodeURIComponent(`${caption}\n\n${shareUrl}`);

  const socialChannels = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      subtitle: 'Enviar para grupos ou status',
      href: `https://wa.me/?text=${encodedFull}`,
      colorClass: 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-400',
      lightClass: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700',
      icon: <MessageCircle className="w-5 h-5" />,
    },
    {
      id: 'x',
      name: 'X (Twitter)',
      subtitle: 'Publicar post com métricas',
      href: `https://twitter.com/intent/tweet?text=${encodedCaption}&url=${encodedUrl}`,
      colorClass: 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-600 text-white',
      lightClass: 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      id: 'facebook',
      name: 'Facebook',
      subtitle: 'Compartilhar no feed',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedCaption}`,
      colorClass: 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/40 text-blue-400',
      lightClass: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
        </svg>
      ),
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      subtitle: 'Destacar disciplina & metas',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      colorClass: 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-400',
      lightClass: 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      ),
    },
    {
      id: 'telegram',
      name: 'Telegram',
      subtitle: 'Enviar para canais de corrida',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedCaption}`,
      colorClass: 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300',
      lightClass: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-700',
      icon: <Send className="w-4 h-4" />,
    },
    {
      id: 'threads',
      name: 'Threads',
      subtitle: 'Compartilhar resumo rápido',
      href: `https://www.threads.net/intent/post?text=${encodedFull}`,
      colorClass: 'bg-purple-500/15 hover:bg-purple-500/25 border-purple-500/40 text-purple-300',
      lightClass: 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700',
      icon: <Sparkles className="w-4 h-4" />,
    },
  ];

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(`${caption}\n\n${shareUrl}`);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2600);
    } catch {
      setNativeFeedback('Não foi possível acessar a área de transferência neste navegador.');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2600);
    } catch {
      setNativeFeedback('Não foi possível copiar o link automaticamente.');
    }
  };

  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `RUN360X_Share_${payload.kind}_${Date.now()}.png`;
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2800);
  };

  const handleNativeShare = async () => {
    setNativeFeedback(null);

    if (typeof navigator === 'undefined' || !navigator.share) {
      await handleCopyCaption();
      setNativeFeedback('Web Share nativo indisponível neste dispositivo — legenda e link copiados!');
      return;
    }

    const canvas = canvasRef.current;
    try {
      if (canvas) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        );
        if (blob) {
          const file = new File([blob], `RUN360X_${payload.kind}.png`, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `RUN360X • ${payload.title}`,
              text: caption,
              files: [file],
            });
            setNativeFeedback('Compartilhamento concluído com imagem HD!');
            return;
          }
        }
      }

      await navigator.share({
        title: `RUN360X • ${payload.title}`,
        text: caption,
        url: shareUrl,
      });
      setNativeFeedback('Compartilhamento nativo concluído!');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        await handleCopyCaption();
        setNativeFeedback('Compartilhamento bloqueado pelo navegador — legenda copiada para colar!');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border shadow-2xl transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-cyan-500/35 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.22)]'
        }`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 z-10 px-6 py-4 border-b backdrop-blur-md flex items-center justify-between gap-3 ${
            isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-950/95 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl border ${
                isLight
                  ? 'bg-orange-100 border-orange-200 text-orange-600'
                  : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
              }`}
            >
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                  isLight
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                CENTRAL SOCIAL • RUN360X
              </span>
              <h3 className="text-lg font-black uppercase tracking-wide mt-0.5">
                Compartilhar nas Redes Sociais
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de compartilhamento"
            className={`p-2 rounded-xl transition cursor-pointer ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Social Card Preview + Export (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div
              className={`p-3 rounded-2xl border space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold uppercase">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Card Social (1080×1080)
                </span>
                <div className="flex items-center gap-1">
                  {(['neon', 'sunset', 'light'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCardTheme(preset)}
                      className={`px-2 py-0.5 rounded-md border transition cursor-pointer ${
                        cardTheme === preset
                          ? isLight
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-cyan-500 border-cyan-400 text-slate-950'
                          : isLight
                          ? 'bg-white border-slate-300 text-slate-600'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset === 'neon' ? 'Neon' : preset === 'sunset' ? 'Sunset' : 'Claro'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full aspect-square rounded-2xl overflow-hidden border border-cyan-500/30 shadow-lg bg-slate-950">
                <canvas ref={canvasRef} className="w-full h-full object-contain" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCard}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
                    isLight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_16px_rgba(6,182,212,0.3)]'
                  }`}
                >
                  {downloaded ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  <span>{downloaded ? 'CARD BAIXADO (.PNG)!' : 'BAIXAR CARD SOCIAL (.PNG HD)'}</span>
                </button>

                {onOpenInstagramStory && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenInstagramStory();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:opacity-95 text-white"
                  >
                    <Instagram className="w-4 h-4" />
                    <span>ABRIR INSTAGRAM STORIES (9:16)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Social Networks Grid + Editable Caption + Native Share (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Direct Social Network Links */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Escolher Rede Social
                </span>
                <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Abre com texto & métricas preenchidos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {socialChannels.map((ch) => (
                  <a
                    key={ch.id}
                    href={ch.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 group ${
                      isLight ? ch.lightClass : ch.colorClass
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-black/10 dark:bg-white/10 shrink-0">
                        {ch.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black font-mono truncate">{ch.name}</div>
                        <div className="text-[10px] opacity-75 truncate">{ch.subtitle}</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 shrink-0" />
                  </a>
                ))}
              </div>
            </div>

            {/* Editable Share Caption */}
            <div
              className={`p-4 rounded-2xl border space-y-2.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="social-share-caption"
                  className="text-xs font-mono font-bold uppercase"
                >
                  Personalizar Legenda & Hashtags
                </label>
                <span className="text-[10px] font-mono opacity-60">{caption.length} caracteres</span>
              </div>
              <textarea
                id="social-share-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className={`w-full p-3 rounded-xl border text-xs font-mono leading-relaxed focus:outline-none resize-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800 focus:border-orange-500'
                    : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-cyan-400'
                }`}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className={`flex-1 min-w-[150px] py-2 px-3 rounded-xl text-xs font-mono font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
                  }`}
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Legenda Copiada!' : 'Copiar Legenda'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`py-2 px-3 rounded-xl text-xs font-mono font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            </div>

            {/* Native Web Share API Trigger */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className={`w-full py-3 px-4 rounded-2xl text-xs font-mono font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 border ${
                  isLight
                    ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
                    : 'bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 hover:from-cyan-500/30 hover:to-pink-500/30 border-cyan-500/40 text-white'
                }`}
              >
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span>Compartilhar via Menu do Dispositivo (Web Share + Imagem)</span>
              </button>

              {nativeFeedback && (
                <p className="text-[11px] font-mono text-emerald-400 text-center">
                  {nativeFeedback}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialShareModal;
