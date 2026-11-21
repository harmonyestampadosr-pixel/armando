import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  QrCode,
  RefreshCw,
  Send,
  Share2,
  X,
} from 'lucide-react';

interface QrCodeCardProps {
  code: string;
  gameId?: string;
  title: string;
  compact?: boolean;
  showProjectorLink?: boolean;
  onOpenProjector?: () => void;
  inviteInfoEndpoint?: string;
  allowedPathPrefix?: string;
}

interface InviteInfoPayload {
  gameId: string;
  code: string;
  title: string;
  status: string;
  signature: string;
  hasPublicUrl: boolean;
  publicOrigin: string | null;
  publicUrlReason: string;
  detectedHost: string;
  inviteUrl: string | null;
  localInvitePath?: string;
  projectorUrl: string;
}

export function getProjectorUrl(code: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?projector=${encodeURIComponent(code)}`;
}

function isClientSideValidPublicInviteUrl(
  urlStr: string | null,
  allowedPathPrefix = '/partida/'
): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    if (
      !host ||
      !host.includes('.') ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '127.0.0.1' ||
      host.startsWith('127.') ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.lan') ||
      host.endsWith('.home') ||
      host.startsWith('ais-dev-') ||
      host === 'aistudio.google.com' ||
      host.endsWith('.aistudio.google.com') ||
      host === 'idx.google.com' ||
      host.endsWith('.idx.google.com') ||
      host === 'cloudshell.dev' ||
      host.endsWith('.cloudshell.dev')
    ) {
      return false;
    }
    return (
      parsed.pathname.startsWith(allowedPathPrefix) &&
      parsed.searchParams.has('s')
    );
  } catch {
    return false;
  }
}

export function QrCodeCard({
  code,
  gameId,
  title,
  compact = false,
  showProjectorLink = true,
  onOpenProjector,
  inviteInfoEndpoint,
  allowedPathPrefix = '/partida/',
}: QrCodeCardProps) {
  const [inviteInfo, setInviteInfo] = useState<InviteInfoPayload | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedType, setCopiedType] = useState<'code' | 'link' | 'share' | null>(
    null
  );
  const [showQrModal, setShowQrModal] = useState(false);

  const targetIdentifier = gameId || code;

  const loadInviteInfo = useCallback(
    async (refresh = false) => {
      if (!targetIdentifier) {
        setInfoError('La partida no tiene un identificador válido.');
        setLoadingInfo(false);
        return;
      }
      setLoadingInfo(true);
      setInfoError(null);
      try {
        const params = new URLSearchParams();
        if (typeof window !== 'undefined' && window.location.origin) {
          params.set('origin', window.location.origin);
        }
        if (refresh) {
          params.set('refresh', '1');
        }
        const baseEndpoint =
          inviteInfoEndpoint ||
          `/api/games/${encodeURIComponent(targetIdentifier)}/invite-info`;
        const res = await fetch(`${baseEndpoint}?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setInviteInfo(null);
          setInfoError(
            data.error || 'No se pudo obtener la invitación de la partida.'
          );
        } else {
          setInviteInfo(data);
        }
      } catch {
        setInviteInfo(null);
        setInfoError('Error de conexión al verificar el enlace de invitación.');
      } finally {
        setLoadingInfo(false);
      }
    },
    [targetIdentifier, inviteInfoEndpoint]
  );

  useEffect(() => {
    loadInviteInfo(false);
  }, [loadInviteInfo]);

  const validInviteUrl =
    inviteInfo &&
    inviteInfo.hasPublicUrl &&
    inviteInfo.gameId &&
    isClientSideValidPublicInviteUrl(inviteInfo.inviteUrl, allowedPathPrefix)
      ? inviteInfo.inviteUrl!
      : '';

  const fallbackOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const localInviteUrl =
    inviteInfo?.localInvitePath && fallbackOrigin
      ? `${fallbackOrigin}${inviteInfo.localInvitePath}`
      : inviteInfo?.gameId && inviteInfo?.signature && fallbackOrigin
        ? `${fallbackOrigin}${allowedPathPrefix}${encodeURIComponent(
            inviteInfo.gameId
          )}?s=${encodeURIComponent(inviteInfo.signature)}`
        : code && fallbackOrigin
          ? `${fallbackOrigin}/?join=${encodeURIComponent(code)}`
          : '';

  const effectiveInviteUrl = validInviteUrl || localInviteUrl;
  const isPreviewFallback = Boolean(
    !loadingInfo && !validInviteUrl && effectiveInviteUrl
  );

  const projectorUrl = inviteInfo?.projectorUrl || getProjectorUrl(code);

  useEffect(() => {
    if (!effectiveInviteUrl) {
      setQrDataUrl('');
      return;
    }
    let active = true;
    QRCode.toDataURL(effectiveInviteUrl, {
      width: 512,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [effectiveInviteUrl]);

  const copyText = async (
    text: string,
    type: 'code' | 'link' | 'share'
  ) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2200);
    } catch {
      // Clipboard blocked in some contexts; ignore silently
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !effectiveInviteUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-DimeTuQueDices-${code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNativeShare = async () => {
    if (!effectiveInviteUrl) return;
    const shareData = {
      title: `${title} — Dime Tú Qué Dices`,
      text: `¡Únete en vivo al concurso bíblico "${title}"! Código: ${code}`,
      url: effectiveInviteUrl,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share unsupported; fall back to copy
      }
    }
    await copyText(effectiveInviteUrl, 'share');
  };

  const whatsappText = effectiveInviteUrl
    ? encodeURIComponent(
        `¡Únete al concurso bíblico "${title}" en DIME TÚ QUÉ DICES!\nCódigo de partida: ${code}\nIngresa directo en este enlace:\n${effectiveInviteUrl}`
      )
    : '';
  const whatsappUrl = effectiveInviteUrl
    ? `https://wa.me/?text=${whatsappText}`
    : '';

  const getPreviewNotice = (reason?: string): string => {
    if (reason === 'AI_STUDIO_PRIVATE_PREVIEW') {
      return 'Vista previa privada de AI Studio: este QR funciona en el dominio actual, pero celulares externos requerirán abrir la app desde su enlace público publicado.';
    }
    if (reason === 'AUTH_REQUIRED') {
      return 'Este dominio requiere sesión externa; en dispositivos sin sesión usa el dominio público publicado.';
    }
    if (reason === 'UNREACHABLE_OR_NOT_DEPLOYED') {
      return 'El servidor aún no está accesible desde un dominio público externo; el QR usa la dirección actual.';
    }
    return 'Entorno local (localhost): el QR y enlace usan la dirección local actual. Para celulares en otra red, publica o abre en red local/pública.';
  };

  return (
    <>
      <div className="bg-[#111A2E] border border-slate-700/70 rounded-2xl p-5 flex flex-col gap-4">
        {loadingInfo ? (
          <div className="py-6 text-center text-sm text-slate-400">
            Generando código QR y enlace de la partida {code}...
          </div>
        ) : (
          <div className="space-y-4">
            {infoError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-2">
                <span>{infoError}</span>
                <button
                  type="button"
                  onClick={() => loadInviteInfo(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold shrink-0 cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="bg-white p-2.5 rounded-xl shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Código QR directo para unirse a la partida ${code}`}
                    className={compact ? 'w-32 h-32' : 'w-44 h-44'}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className={`${
                      compact ? 'w-32 h-32' : 'w-44 h-44'
                    } bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs gap-1`}
                  >
                    <QrCode className="w-6 h-6 opacity-50" />
                    <span>Generando QR...</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Código real de la partida
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="font-mono-num text-2xl sm:text-3xl font-bold tracking-wider text-amber-400">
                      {code}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(code, 'code')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedType === 'code' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Código copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar código
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {effectiveInviteUrl && (
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Enlace de entrada para participantes
                    </p>
                    <div className="mt-1 flex items-center gap-2 bg-[#080E1E] border border-slate-800 rounded-xl px-3 py-2">
                      <span className="text-xs text-slate-300 truncate flex-1 font-mono">
                        {effectiveInviteUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(effectiveInviteUrl, 'link')}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1"
                      >
                        {copiedType === 'link' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Enlace copiado
                          </>
                        ) : (
                          'Copiar enlace'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!qrDataUrl}
                    onClick={() => setShowQrModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Mostrar código QR
                  </button>

                  <button
                    type="button"
                    disabled={!qrDataUrl}
                    onClick={handleDownloadQr}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar QR
                  </button>

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  )}

                  <button
                    type="button"
                    disabled={!effectiveInviteUrl}
                    onClick={handleNativeShare}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {copiedType === 'share' ? 'Enlace copiado' : 'Otras apps'}
                  </button>

                  {showProjectorLink &&
                    (onOpenProjector ? (
                      <button
                        type="button"
                        onClick={onOpenProjector}
                        className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir pantalla de proyección
                      </button>
                    ) : (
                      <a
                        href={projectorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir pantalla de proyección
                      </a>
                    ))}
                </div>
              </div>
            </div>

            {isPreviewFallback && (
              <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200/90">
                <div className="flex items-start gap-2 flex-1 min-w-[200px]">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{getPreviewNotice(inviteInfo?.publicUrlReason)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => loadInviteInfo(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Verificar dominio
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded QR Modal for clear scanning */}
      {showQrModal && qrDataUrl && effectiveInviteUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-[#111A2E] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300">
                Escanea con tu cámara
              </span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                aria-label="Cerrar código QR"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-extrabold text-xl text-white">
                {title}
              </h3>
              <p className="font-mono-num text-2xl font-bold text-amber-400">
                {code}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block mx-auto">
              <img
                src={qrDataUrl}
                alt={`Código QR ampliado de la partida ${code}`}
                className="w-64 h-64 sm:w-72 sm:h-72"
                referrerPolicy="no-referrer"
              />
            </div>

            <p className="text-xs text-slate-400 break-all font-mono">
              {effectiveInviteUrl}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Descargar PNG
              </button>
              <button
                type="button"
                onClick={() => copyText(effectiveInviteUrl, 'link')}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                {copiedType === 'link' ? '¡Enlace copiado!' : 'Copiar enlace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
