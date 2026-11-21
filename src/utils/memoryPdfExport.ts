import { jsPDF } from 'jspdf';
import {
  anonymizeDisplayName,
  formatMemoryDateEs,
  isPhotoPubliclyAllowed,
  type SaturdayMemoryRecord,
} from '../shared/memoriesData';

export interface MemoryPdfExportOptions {
  hideNames?: boolean;
  hidePhotos?: boolean;
  requireMinorGuardianConsent?: boolean;
  adminToken?: string;
  memberToken?: string;
}

async function fetchImageAsDataUrl(
  url: string,
  adminToken?: string,
  memberToken?: string
): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' | 'WEBP' } | null> {
  try {
    const headers: Record<string, string> = {};
    if (adminToken) headers['x-memory-admin-token'] = adminToken;
    if (memberToken) headers['x-memory-member-token'] = memberToken;

    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type.toLowerCase();

    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;

    // jsPDF supports JPEG and PNG most reliably across viewers; convert webp via canvas if needed
    if (mime.includes('webp')) {
      const converted = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
      if (!converted) return null;
      return { dataUrl: converted, format: 'JPEG' };
    }

    const format = mime.includes('png') ? 'PNG' : 'JPEG';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

export async function exportMemoryToPdf(
  memory: SaturdayMemoryRecord,
  options: MemoryPdfExportOptions = {}
): Promise<void> {
  const hideNames = Boolean(options.hideNames || memory.hideParticipantNames);
  const hidePhotos = Boolean(options.hidePhotos || memory.hidePhotos);
  const requireMinorConsent = options.requireMinorGuardianConsent !== false;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 18) {
      doc.addPage();
      y = 18;
    }
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(14);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9); // warm amber/bronze
    doc.text(title.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y, pageW - margin, y);
    y += 5.5;
  };

  const drawWrappedParagraph = (
    text: string,
    fontSize = 10,
    color: [number, number, number] = [30, 41, 59],
    italic = false
  ) => {
    if (!text.trim()) return;
    doc.setFont('helvetica', italic ? 'italic' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text.trim(), contentW) as string[];
    const lineH = fontSize * 0.45;
    for (const line of lines) {
      ensureSpace(lineH + 2);
      doc.text(line, margin, y);
      y += lineH;
    }
    y += 2;
  };

  // Archival Masthead Banner
  doc.setFillColor(15, 23, 42); // deep slate navy
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setFillColor(245, 158, 11); // gold ribbon
  doc.rect(0, 34.5, pageW, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(251, 191, 36);
  doc.text('ARCHIVO HISTÓRICO · NUESTRAS MEMORIAS · SOCIEDAD DE JÓVENES', margin, 12);

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(
    memory.title || memory.theme || 'Memoria del Sábado',
    contentW
  ) as string[];
  doc.text(titleLines[0] || 'Memoria del Sábado', margin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${formatMemoryDateEs(memory.date)}  ·  ${memory.bibleText || 'Palabra de Dios'}`,
    margin,
    29.5
  );

  y = 45;

  // Core Saturday Metadata Block
  const directorDisplay = hideNames
    ? 'Dirección del Programa (Privacidad activa)'
    : memory.directorName || 'Por asignar';

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentW, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Tema: ${memory.theme || 'Sin tema registrado'}`, margin + 4, y + 6.5);
  doc.text(`Texto bíblico: ${memory.bibleText || '—'}`, margin + 4, y + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Director/a: ${directorDisplay}${
      typeof memory.attendanceCount === 'number' && memory.attendanceCount > 0
        ? `   ·   Asistencia: ${memory.attendanceCount} jóvenes`
        : ''
    }`,
    margin + 4,
    y + 18.5
  );
  y += 30;

  if (memory.bibleVerseQuote) {
    drawWrappedParagraph(`“${memory.bibleVerseQuote}”`, 10, [51, 65, 85], true);
  }

  // Daily Reflection
  if (memory.dailyReflection) {
    drawSectionHeading('Reflexión del Día');
    drawWrappedParagraph(memory.dailyReflection, 10, [30, 41, 59]);
  }

  // Activities
  if (memory.activities.length > 0) {
    drawSectionHeading(`Actividades Realizadas (${memory.activities.length})`);
    memory.activities.forEach((act, idx) => {
      const prefix = `${idx + 1}. ${act.title}`;
      const meta = [
        act.categoryLabel,
        act.durationMin ? `${act.durationMin} min` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      drawWrappedParagraph(
        `${prefix}${meta ? ` (${meta})` : ''}${act.notes ? ` — ${act.notes}` : ''}`,
        9.5,
        [30, 41, 59]
      );
    });
  }

  // Games Played
  if (memory.gamesPlayed.length > 0) {
    drawSectionHeading(`Juegos Realizados (${memory.gamesPlayed.length})`);
    memory.gamesPlayed.forEach((g, idx) => {
      const winnerText = g.winnerOrHighlight
        ? hideNames
          ? 'Destacado protegido'
          : g.winnerOrHighlight
        : '';
      drawWrappedParagraph(
        `${idx + 1}. ${g.title}${g.modeLabel ? ` (${g.modeLabel})` : ''}${
          winnerText ? ` — Resultado: ${winnerText}` : ''
        }`,
        9.5,
        [30, 41, 59]
      );
    });
  }

  // Challenges Completed
  if (memory.challengesCompleted.length > 0) {
    drawSectionHeading(
      `Retos Completados (${memory.challengesCompleted.length})`
    );
    memory.challengesCompleted.forEach((ch, idx) => {
      const who = ch.participantOrTeam
        ? hideNames
          ? 'Participante (Privacidad)'
          : ch.participantOrTeam
        : '';
      drawWrappedParagraph(
        `${idx + 1}. ${ch.title}${ch.categoryLabel ? ` [${ch.categoryLabel}]` : ''}${
          who ? ` · ${who}` : ''
        }${ch.outcome ? ` · ${ch.outcome}` : ''}`,
        9.5,
        [30, 41, 59]
      );
    });
  }

  // Teams & Results
  if (
    memory.teams.length > 0 ||
    memory.rankings.length > 0 ||
    memory.resultsSummary
  ) {
    drawSectionHeading('Equipos Participantes y Resultados');
    if (memory.resultsSummary) {
      drawWrappedParagraph(memory.resultsSummary, 10, [15, 23, 42]);
    }
    if (memory.teams.length > 0) {
      const teamLine = memory.teams
        .map(
          (t, i) =>
            `${hideNames ? `Equipo ${i + 1}` : t.name}${
              typeof t.score === 'number' ? ` (${t.score} pts)` : ''
            }`
        )
        .join('  ·  ');
      drawWrappedParagraph(`Equipos: ${teamLine}`, 9.5, [51, 65, 85]);
    }
    if (memory.rankings.length > 0) {
      memory.rankings.forEach((rk, i) => {
        const name = hideNames
          ? anonymizeDisplayName(rk.name, i, 'Participante')
          : rk.name;
        drawWrappedParagraph(
          `#${rk.position} ${name} — ${rk.points} pts${
            rk.note ? ` (${rk.note})` : ''
          }`,
          9.5,
          [30, 41, 59]
        );
      });
    }
  }

  // Recognitions
  if (memory.recognitions.length > 0) {
    drawSectionHeading(`Reconocimientos (${memory.recognitions.length})`);
    memory.recognitions.forEach((rec, i) => {
      const name = hideNames
        ? anonymizeDisplayName(rec.recipientName, i, 'Joven')
        : rec.recipientName;
      drawWrappedParagraph(
        `• ${rec.title} — ${name}${rec.reason ? `: ${rec.reason}` : ''}`,
        9.5,
        [30, 41, 59]
      );
    });
  }

  // Participant Names (if allowed)
  if (!hideNames && memory.participantNames.length > 0) {
    drawSectionHeading(
      `Participantes Registrados (${memory.participantNames.length})`
    );
    drawWrappedParagraph(memory.participantNames.join(', '), 9.5, [51, 65, 85]);
  }

  // Observations
  if (memory.observations) {
    drawSectionHeading('Observaciones del Programa');
    drawWrappedParagraph(memory.observations, 9.5, [51, 65, 85]);
  }

  // Authorized Photographs
  const allowedPhotos = hidePhotos
    ? []
    : memory.photos.filter((p) =>
        isPhotoPubliclyAllowed(p, requireMinorConsent)
      );

  if (allowedPhotos.length > 0) {
    drawSectionHeading(`Fotografías Autorizadas (${allowedPhotos.length})`);
    for (const photo of allowedPhotos.slice(0, 6)) {
      const loaded = await fetchImageAsDataUrl(
        photo.photoUrl,
        options.adminToken,
        options.memberToken
      );
      if (!loaded) continue;
      ensureSpace(68);
      try {
        const imgW = 86;
        const imgH = 56;
        doc.addImage(loaded.dataUrl, loaded.format, margin, y, imgW, imgH);
        y += imgH + 4;
        if (photo.caption) {
          drawWrappedParagraph(
            `${photo.caption}${
              photo.includesMinors ? ' (Autorización de representante verificada)' : ''
            }`,
            8.5,
            [100, 116, 139],
            true
          );
        }
      } catch {
        // skip unsupported/corrupt image
      }
    }
  }

  // Footer across pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Dime Tú Qué Dices · Archivo Nuestras Memorias · Página ${p} de ${totalPages}`,
      margin,
      pageH - 9
    );
  }

  const safeDate = memory.date || 'sabado';
  doc.save(`memoria-sociedad-jovenes-${safeDate}.pdf`);
}
