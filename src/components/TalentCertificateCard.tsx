import { Award, Download, FileImage, Printer } from 'lucide-react';
import { getTalentCategoryMeta, type TalentCertificateRecord } from '../shared/talentShowData';

interface TalentCertificateCardProps {
  certificate: TalentCertificateRecord;
  compact?: boolean;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + ' ' + w).length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDateEs(ts: number): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleDateString('es-ES');
  }
}

function buildCertificateSvgString(cert: TalentCertificateRecord): string {
  const cat = getTalentCategoryMeta(cert.categoryId);
  const dateText = formatDateEs(cert.issuedAt);
  const msgLines = wrapLines(cert.encouragementMessage, 68).slice(0, 3);
  const verseLines = wrapLines(cert.verseText, 78).slice(0, 2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFDF7"/>
      <stop offset="100%" stop-color="#FBF3E0"/>
    </linearGradient>
    <linearGradient id="goldBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#B45309"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
  </defs>
  <rect width="1400" height="990" fill="url(#bgGrad)"/>
  <rect x="34" y="34" width="1332" height="922" fill="none" stroke="#B45309" stroke-width="5"/>
  <rect x="52" y="52" width="1296" height="886" fill="none" stroke="#D97706" stroke-width="1.5" stroke-dasharray="10 6"/>
  <rect x="34" y="34" width="1332" height="18" fill="url(#goldBar)"/>
  <rect x="34" y="938" width="1332" height="18" fill="url(#goldBar)"/>

  <text x="700" y="128" text-anchor="middle" font-family="Georgia, serif" font-size="22" letter-spacing="5" fill="#92400E" font-weight="bold">
    SOCIEDAD DE JÓVENES · TALENTOS JUVENILES
  </text>
  <text x="700" y="192" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="#0F172A" font-weight="bold">
    CERTIFICADO DE RECONOCIMIENTO
  </text>
  <line x1="420" y1="218" x2="980" y2="218" stroke="#D97706" stroke-width="2.5"/>

  <text x="700" y="268" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" fill="#475569">
    Se otorga con gratitud y aprecio cristiano a:
  </text>

  <text x="700" y="345" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#0B132B" font-weight="bold">
    ${escapeXml(cert.recipientDisplayName)}
  </text>
  <line x1="280" y1="368" x2="1120" y2="368" stroke="#CBD5E1" stroke-width="2"/>

  <text x="700" y="424" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="${escapeXml(cat.color)}" font-weight="bold">
    ${escapeXml(cert.recognitionTitle)}
  </text>

  <text x="700" y="476" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#1E293B">
    Categoría: ${escapeXml(cert.categoryLabel)}  ·  Presentación: “${escapeXml(cert.presentationTitle)}”
  </text>

  ${msgLines
    .map(
      (line, idx) =>
        `<text x="700" y="${544 + idx * 36}" text-anchor="middle" font-family="Georgia, serif" font-size="23" fill="#334155">${escapeXml(line)}</text>`
    )
    .join('\n  ')}

  <rect x="210" y="675" width="980" height="84" rx="10" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1.5"/>
  ${verseLines
    .map(
      (line, idx) =>
        `<text x="700" y="${712 + idx * 30}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#78350F">${escapeXml(line)}</text>`
    )
    .join('\n  ')}

  <text x="330" y="845" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#0F172A" font-weight="bold">
    ${escapeXml(cert.directorSignatureName)}
  </text>
  <line x1="170" y1="860" x2="490" y2="860" stroke="#64748B" stroke-width="1.5"/>
  <text x="330" y="890" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#475569">
    Dirección del Programa
  </text>

  <text x="1070" y="845" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#0F172A" font-weight="bold">
    ${escapeXml(dateText)}
  </text>
  <line x1="910" y1="860" x2="1230" y2="860" stroke="#64748B" stroke-width="1.5"/>
  <text x="1070" y="890" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#475569">
    ${escapeXml(cert.programTitle)}
  </text>
</svg>`;
}

export function TalentCertificateCard({
  certificate,
  compact = false,
}: TalentCertificateCardProps) {
  const cat = getTalentCategoryMeta(certificate.categoryId);
  const dateLabel = formatDateEs(certificate.issuedAt);
  const safeFileName = certificate.recipientDisplayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'participante';

  const handleDownloadSvg = () => {
    const svg = buildCertificateSvgString(certificate);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificado-${safeFileName}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const svg = buildCertificateSvgString(certificate);
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 990;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1400, 990);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `certificado-${safeFileName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      handleDownloadSvg();
    };
    img.src = svgUrl;
  };

  return (
    <article className="bg-[#FFFDF7] text-slate-900 rounded-2xl border-2 border-amber-500/80 shadow-lg overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-amber-700 via-amber-400 to-amber-700" />
      <div className={`${compact ? 'p-5 space-y-3' : 'p-6 sm:p-8 space-y-5'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
          <div className="flex items-center gap-2 text-amber-800">
            <Award className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest">
              Certificado Digital · Talentos Juveniles
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {dateLabel}
          </span>
        </div>

        <div className="text-center space-y-2 py-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Otorgado con gratitud a
          </p>
          <h4 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B132B] text-balance">
            {certificate.recipientDisplayName}
          </h4>
          <p
            className="text-sm sm:text-base font-bold"
            style={{ color: cat.color }}
          >
            {certificate.recognitionTitle}
          </p>
          <p className="text-xs sm:text-sm text-slate-700">
            {certificate.categoryLabel}{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="font-semibold">
              “{certificate.presentationTitle}”
            </span>
          </p>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 text-center max-w-xl mx-auto leading-relaxed">
          {certificate.encouragementMessage}
        </p>

        <blockquote className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-center text-xs italic text-amber-900">
          {certificate.verseText}
        </blockquote>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/80 text-xs text-slate-600">
          <div>
            <p className="font-bold text-slate-800">
              {certificate.directorSignatureName}
            </p>
            <p>{certificate.programTitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileImage className="w-3.5 h-3.5" />
              Descargar PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              SVG
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
