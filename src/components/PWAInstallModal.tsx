import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Share2,
  PlusSquare,
  Download,
  X,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Globe,
  ExternalLink,
  ChevronRight,
  ArrowDown,
} from 'lucide-react';
import { tacticalAudio } from '../utils/audio';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Detect Standalone Mode (installed PWA)
    const isInStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isInStandaloneMode);

    // Detect OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);

    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);

    // Capture Android/Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalledSuccess(true);
        tacticalAudio.playLevelUpSound();
      }
      setDeferredPrompt(null);
    } else {
      // Direct user fallback
      alert('Para instalar no Android/Chrome: acesse o menu do seu navegador (⋮) e toque em "Instalar aplicativo" ou "Adicionar à tela inicial".');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-sans">
      <div
        className={`w-full max-w-lg rounded-3xl p-6 sm:p-8 relative overflow-hidden border transition-all shadow-2xl ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-xl'
            : 'bg-slate-900 border-cyan-500/50 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.25)]'
        }`}
      >
        {/* Glow backdrop decorative accent */}
        {!isLight && (
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-5 right-5 p-2 rounded-full border transition cursor-pointer z-20 ${
            isLight
              ? 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600'
              : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-3 mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              INSTALAÇÃO MOBILE (ANDROID & APPLE iOS)
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2">
            Instalar App RUN360X
          </h2>

          <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Rode o RUN360X como um app nativo no seu smartphone sem precisar baixar pela Google Play Store ou App Store! Funciona em tela cheia com alta velocidade e acesso offline ao GPS.
          </p>
        </div>

        {/* Already Installed Notification */}
        {isStandalone ? (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono space-y-2 mb-6">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>O RUN360X JÁ ESTÁ INSTALADO NESTE APARELHO!</span>
            </div>
            <p className="text-[11px] text-emerald-200/80">
              Você já está executando o app em modo nativo Standalone. Desfrute de rastreamento tático com máxima precisão.
            </p>
          </div>
        ) : installedSuccess ? (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono space-y-2 mb-6">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
              <span>INSTALAÇÃO INICIADA COM SUCESSO!</span>
            </div>
            <p className="text-[11px] text-emerald-200/80">
              O ícone do RUN360X está sendo adicionado à sua tela inicial. Procure pelo símbolo do raio tático nos seus aplicativos.
            </p>
          </div>
        ) : null}

        {/* Instructions Tabs / Accordion for Android vs Apple iOS */}
        <div className="space-y-4 font-mono text-xs mb-6 relative z-10">
          {/* Apple iOS Section */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isIOS
                ? 'bg-gradient-to-r from-slate-900 to-indigo-950/90 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                : isLight
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-black text-sm text-cyan-300">
                <span className="text-lg">🍎</span>
                <span>NO IPHONE / IPAD (APPLE iOS)</span>
              </div>
              {isIOS && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500 text-slate-950 uppercase">
                  SEU DISPOSITIVO
                </span>
              )}
            </div>

            <ol className="space-y-2.5 text-[11px] text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  1
                </span>
                <span>
                  Abra este site no navegador <strong>Safari</strong> do iPhone.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  2
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Toque no botão <strong>Compartilhar</strong>
                  <Share2 className="w-4 h-4 text-cyan-400 inline shrink-0" />
                  na barra inferior do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  3
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Role o menu e selecione <strong>"Adicionar à Tela de Início"</strong>
                  <PlusSquare className="w-4 h-4 text-emerald-400 inline shrink-0" />.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  4
                </span>
                <span>
                  Toque em <strong>"Adicionar"</strong> no canto superior direito. Pronto!
                </span>
              </li>
            </ol>
          </div>

          {/* Android / Chrome Section */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isAndroid
                ? 'bg-gradient-to-r from-slate-900 to-teal-950/90 border-teal-400/80 shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                : isLight
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-black text-sm text-teal-300">
                <span className="text-lg">🤖</span>
                <span>NO ANDROID (CHROME / SAMSUNG INTERNET)</span>
              </div>
              {isAndroid && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500 text-slate-950 uppercase">
                  SEU DISPOSITIVO
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-300 mb-3">
              Clique no botão de instalação direta abaixo ou acesse as opções do Chrome (⋮) e clique em "Adicionar à tela inicial" ou "Instalar aplicativo".
            </p>

            <button
              onClick={handleInstallClick}
              className="w-full py-3 px-4 rounded-xl font-mono text-xs font-black uppercase tracking-wider bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 hover:from-teal-300 hover:to-emerald-300 transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(20,184,166,0.3)]"
            >
              <Download className="w-4 h-4" />
              <span>INSTALAR AGORA NO ANDROID</span>
            </button>
          </div>
        </div>

        {/* Benefits Footnote */}
        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
            <span>Execução Rápida</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
            <span>GPS Sem Falhas</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400">
            <Smartphone className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
            <span>Tela Cheia HD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
