import { jsPDF } from 'jspdf';
import type {
  AiCreativeActivity,
  AiCreativeEvent,
  AiCreativeMusicPlan,
  AiCreativePresentation,
  AiCreativeProgram,
  AiCreativeScript,
  AiCreativeSermon,
  CreativePayloadUnion,
  CreativeToolKind,
} from '../shared/creativeAiTypes';

function sanitizeFileSlug(raw: string): string {
  return (
    raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'ia-creativa-juvenil'
  );
}

async function fetchLocalImageDataUrl(
  url: string
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type.toLowerCase();
    const rawUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!rawUrl) return null;

    if (mime.includes('webp')) {
      const converted = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = () => resolve(null);
        img.src = rawUrl;
      });
      return converted ? { dataUrl: converted, format: 'JPEG' } : null;
    }

    return {
      dataUrl: rawUrl,
      format: mime.includes('png') ? 'PNG' : 'JPEG',
    };
  } catch {
    return null;
  }
}

export async function exportPresentationToPptx(
  presentation: AiCreativePresentation
): Promise<void> {
  if (!presentation?.slides?.length) {
    throw new Error('La presentación no tiene diapositivas para exportar.');
  }

  const res = await fetch('/api/ia-creativa/presentations/export-pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'No se pudo generar el archivo PowerPoint (.pptx).');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileSlug(presentation.title)}.pptx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportPresentationToPdf(
  presentation: AiCreativePresentation
): Promise<void> {
  if (!presentation?.slides?.length) {
    throw new Error('La presentación no tiene diapositivas para exportar.');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [254, 142.875], // 16:9 widescreen
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    if (i > 0) doc.addPage();

    doc.setFillColor(8, 14, 30);
    doc.rect(0, 0, pageW, pageH, 'F');

    doc.setFillColor(245, 158, 11);
    doc.rect(0, 0, pageW, 3.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(251, 191, 36);
    doc.text(
      `${presentation.title} · ${presentation.mainBibleText} · Diapositiva ${i + 1}/${presentation.slides.length}`,
      margin,
      12
    );

    let imgData: { dataUrl: string; format: 'PNG' | 'JPEG' } | null = null;
    if (slide.imageUrl) {
      imgData = await fetchLocalImageDataUrl(slide.imageUrl);
    }

    const textW = imgData ? 132 : pageW - margin * 2;
    let y = 25;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(slide.kind === 'portada' ? 24 : 20);
    doc.setTextColor(255, 255, 255);
    const titleLines = doc.splitTextToSize(slide.title || 'Diapositiva', textW) as string[];
    for (const line of titleLines) {
      doc.text(line, margin, y);
      y += 9;
    }

    if (slide.subtitle) {
      y += 1;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(125, 211, 252);
      const subLines = doc.splitTextToSize(slide.subtitle, textW) as string[];
      for (const line of subLines) {
        doc.text(line, margin, y);
        y += 6;
      }
    }

    if (slide.bibleVerse) {
      y += 3;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(253, 230, 138);
      const vLines = doc.splitTextToSize(`"${slide.bibleVerse}"`, textW) as string[];
      for (const line of vLines) {
        doc.text(line, margin, y);
        y += 5.5;
      }
    }

    if (slide.bullets?.length) {
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(226, 232, 240);
      for (const b of slide.bullets) {
        const lines = doc.splitTextToSize(`• ${b}`, textW) as string[];
        for (const line of lines) {
          if (y > pageH - 22) break;
          doc.text(line, margin, y);
          y += 5.8;
        }
        y += 1.5;
      }
    }

    if (imgData) {
      doc.addImage(imgData.dataUrl, imgData.format, 155, 22, 84, 96, undefined, 'FAST');
    }

    if (slide.speakerNotes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const noteText = doc.splitTextToSize(`Nota del presentador: ${slide.speakerNotes}`, pageW - margin * 2) as string[];
      doc.text(noteText.slice(0, 2), margin, pageH - 10);
    }
  }

  doc.save(`${sanitizeFileSlug(presentation.title)}.pdf`);
}

function buildPlainTextForPayload(
  kind: CreativeToolKind,
  title: string,
  payload: CreativePayloadUnion
): string {
  const lines: string[] = [
    `IA CREATIVA JUVENIL — DIME TÚ QUÉ DICES`,
    `========================================`,
    `Recurso: ${title}`,
    `Categoría: ${kind.toUpperCase()}`,
    ``,
  ];

  if (kind === 'program') {
    const p = payload as AiCreativeProgram;
    lines.push(
      `Subtítulo: ${p.subtitle}`,
      `Tema central: ${p.centralTheme}`,
      `Lema: ${p.motto}`,
      `Objetivo espiritual: ${p.spiritualObjective}`,
      `Público: ${p.targetAudience}`,
      `Texto bíblico principal: ${p.mainBibleText}`,
      p.mainBibleVerseQuote ? `"${p.mainBibleVerseQuote}"` : '',
      `Textos complementarios: ${(p.complementaryTexts || []).join(', ')}`,
      `Idea central: ${p.centralIdea}`,
      `Duración total: ${p.durationMinutes} minutos | Fecha: ${p.scheduledDate}`,
      ``,
      `INTRODUCCIÓN:`,
      p.introduction,
      ``,
      `GUION MAESTRO DEL PRESENTADOR:`,
      p.presenterMasterScript,
      ``,
      `CRONOGRAMA PASO A PASO:`
    );
    for (const s of p.steps) {
      lines.push(
        `\n${s.order}. [${s.durationMin} min] ${s.blockLabel.toUpperCase()} — ${s.title}`,
        `   Director: ${s.whatDirectorDoes}`,
        `   Presentador dice: "${s.whatPresenterSays}"`,
        `   Participantes: ${s.whatParticipantsDo}`,
        `   Organización: ${s.howToOrganize}`,
        `   Inicio: ${s.howToStart} | Desarrollo: ${s.howToDevelop} | Cierre: ${s.howToFinish}`,
        `   Materiales: ${(s.materials || []).join(', ') || 'Ninguno especial'}`,
        `   Enseñanza espiritual: ${s.spiritualTeaching}${s.biblicalReference ? ` (${s.biblicalReference})` : ''}`
      );
    }
    if (p.questionsForAudience?.length) {
      lines.push(`\nPREGUNTAS PARA EL PÚBLICO:`, ...p.questionsForAudience.map((q) => `- ${q}`));
    }
    if (p.developedReflection) {
      lines.push(`\nREFLEXIÓN DESARROLLADA:\n${p.developedReflection}`);
    }
    if (p.materialsChecklist?.length) {
      lines.push(`\nLISTA DE MATERIALES:`, ...p.materialsChecklist.map((m) => `- ${m}`));
    }
    if (p.weeklySpiritualChallenge) {
      lines.push(`\nDESAFÍO ESPIRITUAL SEMANAL:\n${p.weeklySpiritualChallenge}`);
    }
    if (p.farewellMessage) {
      lines.push(`\nDESPEDIDA:\n${p.farewellMessage}`);
    }
    if (p.doctrinalReviewPoints?.length) {
      lines.push(`\nPUNTOS PARA REVISIÓN DOCTRINAL DEL DIRECTOR:`, ...p.doctrinalReviewPoints.map((d) => `- ${d}`));
    }
  } else if (kind === 'sermon') {
    const s = payload as AiCreativeSermon;
    lines.push(
      `Tipo: ${s.sermonType} | Duración: ${s.durationMinutes} min | Profundidad: ${s.depth}`,
      `Texto bíblico: ${s.mainBibleText}`,
      `Objetivo: ${s.objective}`,
      `\nCONTEXTO DEL PASAJE:\n${s.passageContext}`,
      `\nINTRODUCCIÓN:\n${s.introduction}`,
      `\nDESARROLLO POR PUNTOS:`
    );
    s.mainPoints.forEach((pt, idx) => {
      lines.push(
        `\n${idx + 1}. ${pt.heading} (${pt.bibleSupport})`,
        `   Explicación: ${pt.explanation}`,
        `   Ejemplo ilustrativo: ${pt.illustrationExample}`,
        `   Aplicación juvenil: ${pt.youthApplication}`
      );
    });
    lines.push(
      `\nREFERENCIAS COMPLEMENTARIAS: ${(s.complementaryReferences || []).join(', ')}`,
      `\nAPLICACIÓN A LA VIDA DIARIA:\n${s.dailyLifeApplication}`,
      `\nCONCLUSIÓN:\n${s.conclusion}`,
      `\nLLAMADO:\n${s.spiritualCall}`,
      `\nORACIÓN SUGERIDA:\n${s.suggestedPrayer}`,
      `\nNOTA BÍBLICA:\n${s.biblicalVerificationNote}`
    );
  } else if (kind === 'activity') {
    const a = payload as AiCreativeActivity;
    lines.push(
      `Categoría: ${a.category} | Participantes: ${a.participantCount} | Duración: ${a.durationMinutes} min`,
      `Objetivo: ${a.objective}`,
      `Materiales: ${(a.materials || []).join(', ')}`,
      `Preparación: ${a.preparation}`,
      `\nREGLAS:`,
      ...(a.rules || []).map((r, i) => `${i + 1}. ${r}`),
      `\nDESARROLLO PASO A PASO:`,
      ...(a.stepByStep || []).map((st, i) => `${i + 1}. ${st}`),
      `\nCÓMO DETERMINAR EL RESULTADO:\n${a.howToDetermineResult}`,
      `\nREFLEXIÓN ESPIRITUAL:\n${a.spiritualReflection}${a.biblicalReference ? ` (${a.biblicalReference})` : ''}`,
      `\nVARIANTES:`,
      ...(a.variants || []).map((v) => `- ${v}`)
    );
  } else if (kind === 'script') {
    const g = payload as AiCreativeScript;
    lines.push(
      `Tipo: ${g.scriptType} | Participantes: ${g.participantCount} | Duración: ${g.durationMinutes} min`,
      `Base bíblica: ${g.biblicalBasis}`,
      `Escenografía: ${g.scenery}`,
      `Materiales: ${(g.materials || []).join(', ')}`,
      `\nPERSONAJES:`,
      ...(g.characters || []).map((c) => `- ${c.name}: ${c.role} (Vestuario: ${c.wardrobeSuggestion})`),
      `\nINDICACIONES DE ACTUACIÓN:\n${g.actingNotes}`,
      `\nESCENAS Y DIÁLOGOS:`
    );
    for (const sc of g.scenes || []) {
      lines.push(`\nEscena ${sc.sceneNumber}: ${sc.sceneTitle} [${sc.stageSetting}]`);
      for (const ln of sc.lines || []) {
        lines.push(`${ln.speaker} (${ln.actingCue}): "${ln.dialogue}"`);
      }
    }
    lines.push(
      `\nMENSAJE ESPIRITUAL:\n${g.spiritualMessage}`,
      `\nDISTINCIÓN BÍBLICA VS ADAPTACIÓN CREATIVA:\n${g.biblicalVsCreativeDistinction}`
    );
  } else if (kind === 'event') {
    const ev = payload as AiCreativeEvent;
    lines.push(
      `Tipo: ${ev.eventType} | Tema general: ${ev.generalTheme} | Texto: ${ev.mainBibleText}`,
      `\nOBJETIVOS:`,
      ...(ev.objectives || []).map((o) => `- ${o}`),
      `\nCRONOGRAMA:`,
      ...(ev.schedule || []).map((b) => `- [${b.timeSlot}] ${b.block}: ${b.activity} (Resp: ${b.responsibleRole})`),
      `\nRESPONSABLES SUGERIDOS:`,
      ...(ev.suggestedResponsibles || []).map((r) => `- ${r}`),
      `\nACTIVIDADES Y RECURSOS:`,
      ...(ev.activities || []).map((a) => `- ${a}`),
      `Materiales: ${(ev.materials || []).join(', ')}`,
      `\nPROMOCIÓN:`,
      ...(ev.promotionPlan || []).map((p) => `- ${p}`),
      `\nEVALUACIÓN FINAL:`,
      ...(ev.finalEvaluationCriteria || []).map((c) => `- ${c}`)
    );
  } else if (kind === 'music') {
    const m = payload as AiCreativeMusicPlan;
    lines.push(
      `Tema: ${m.centralTheme} | Texto: ${m.mainBibleText}`,
      `Nota de derechos: ${m.copyrightComplianceNote}`,
      `Verificación: ${m.verificationNotice}`,
      ``
    );
    for (const mo of m.moments || []) {
      lines.push(
        `\n${mo.momentLabel.toUpperCase()}`,
        `Propósito: ${mo.spiritualPurpose}`,
        `Estilo y tempo: ${mo.suggestedStyleAndTempo}`,
        `Énfasis bíblico: ${mo.biblicalEmphasis}`,
        `Indicaciones al equipo: ${mo.teamInstructions}`,
        ...(mo.songOrHymnGuidance || []).map(
          (sg) => `- ${sg.suggestion} (${sg.verificationRequiredNote})`
        )
      );
    }
  }

  return lines.join('\n');
}

export function exportCreativeRecordToTxt(
  kind: CreativeToolKind,
  title: string,
  payload: CreativePayloadUnion
): void {
  const txt = buildPlainTextForPayload(kind, title, payload);
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileSlug(title)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportCreativeRecordToPdf(
  kind: CreativeToolKind,
  title: string,
  payload: CreativePayloadUnion
): Promise<void> {
  if (kind === 'presentation') {
    await exportPresentationToPdf(payload as AiCreativePresentation);
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 18;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 28.6, pageW, 1.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(251, 191, 36);
  doc.text('IA CREATIVA JUVENIL · DIME TÚ QUÉ DICES', margin, 11);

  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  const headerLines = doc.splitTextToSize(title, contentW) as string[];
  doc.text(headerLines[0] || title, margin, 21);

  y = 40;
  const rawText = buildPlainTextForPayload(kind, title, payload);
  const paragraphs = rawText.split('\n');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  for (const para of paragraphs) {
    if (!para.trim()) {
      y += 3;
      continue;
    }
    const isHeading = para === para.toUpperCase() && para.length < 70;
    doc.setFont('helvetica', isHeading ? 'bold' : 'normal');
    doc.setFontSize(isHeading ? 10.5 : 9.5);
    doc.setTextColor(isHeading ? 180 : 30, isHeading ? 83 : 41, isHeading ? 9 : 59);

    const wrapped = doc.splitTextToSize(para, contentW) as string[];
    for (const ln of wrapped) {
      if (y > pageH - 16) {
        doc.addPage();
        y = 18;
      }
      doc.text(ln, margin, y);
      y += 4.6;
    }
  }

  doc.save(`${sanitizeFileSlug(title)}.pdf`);
}
