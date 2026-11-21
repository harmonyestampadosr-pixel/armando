import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Gamepad2,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  AiCreativeActivity,
  AiCreativeEvent,
  AiCreativeImageRecord,
  AiCreativeMusicPlan,
  AiCreativePresentation,
  AiCreativeProgram,
  AiCreativeRecord,
  AiCreativeScript,
  AiCreativeSermon,
  CREATIVE_TOOL_META,
  CreativePayloadUnion,
  CreativeToolKind,
  rebalanceProgramStepDurations,
} from '../shared/creativeAiTypes';
import { ALL_CATEGORIES, GAME_MODE_INFO, type GameMode } from '../shared/types';
import {
  exportCreativeRecordToPdf,
  exportCreativeRecordToTxt,
  exportPresentationToPdf,
  exportPresentationToPptx,
} from '../utils/creativeAiExports';

export interface ActiveWorkspaceItem {
  recordId?: string;
  kind: CreativeToolKind;
  title: string;
  theme: string;
  eventType: string;
  scheduledDate: string;
  status: 'draft' | 'final';
  payload: CreativePayloadUnion;
  versions: AiCreativeRecord['versions'];
  currentVersion: number;
  sentToSaturdayProgramId?: string;
}

interface IaCreativaEditorPanelProps {
  item: ActiveWorkspaceItem | null;
  images: AiCreativeImageRecord[];
  geminiConfigured: boolean;
  onChangeItem: (updated: ActiveWorkspaceItem) => void;
  onSavedRecord: (record: AiCreativeRecord) => void;
  onSentToSaturday: (saturdayProgramId: string, recordId?: string) => void;
  onOpenSaturdayProgram: (programId?: string) => void;
  onGeneratePresentationFromItem: (sourceItem: ActiveWorkspaceItem) => void;
  onPrefillImageGenerator: (suggestedPrompt: string, linkedRecordId?: string) => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
  onNotify: (type: 'ok' | 'err', msg: string) => void;
}

export function IaCreativaEditorPanel({
  item,
  images,
  geminiConfigured,
  onChangeItem,
  onSavedRecord,
  onSentToSaturday,
  onOpenSaturdayProgram,
  onGeneratePresentationFromItem,
  onPrefillImageGenerator,
  onCreatedMultiplayerRoom,
  onNotify,
}: IaCreativaEditorPanelProps) {
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingToSat, setSendingToSat] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [launchingGameMode, setLaunchingGameMode] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [selectedSlideForImage, setSelectedSlideForImage] = useState<string | null>(null);

  if (!item) {
    return (
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center space-y-3">
        <Wand2 className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="font-display font-bold text-xl text-white">
          Editor Inteligente de IA Creativa
        </h3>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Genera un programa, predicación, dinámica, guion, presentación, evento o plan musical desde &ldquo;Crear por Categoría&rdquo;, o abre cualquiera del &ldquo;Historial&rdquo; para editarlo, regenerar secciones, exportar archivos y guardar versiones.
        </p>
      </div>
    );
  }

  const meta = CREATIVE_TOOL_META[item.kind];

  const runAiRefine = async (instruction: string, targetStepId?: string, requestedDuration?: number) => {
    if (!geminiConfigured) {
      onNotify(
        'err',
        'No hay clave GEMINI_API_KEY configurada en Settings > Secrets para refinar con IA.'
      );
      return;
    }
    setRefining(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 52000);
    try {
      const res = await fetch('/api/ia-creativa/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: item.kind,
          payload: item.payload,
          instruction,
          targetStepId,
          requestedDuration,
        }),
        signal: controller.signal,
      });
      const rawText = await res.text();
      let data: { payload?: CreativePayloadUnion; error?: string } = {};
      try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
      } catch {
        onNotify(
          'err',
          res.status === 504
            ? 'Tiempo de espera agotado (504) al refinar con IA. Intenta de nuevo.'
            : `Error de formato del servidor (HTTP ${res.status}) al refinar con IA.`
        );
        return;
      }

      if (!res.ok || !data.payload) {
        const prefix =
          res.status === 401
            ? '[No Autorizado 401] '
            : res.status === 403
              ? '[Permiso Denegado 403] '
              : res.status === 429
                ? '[Cuota Agotada 429] '
                : res.status === 504
                  ? '[Tiempo Agotado 504] '
                  : res.status >= 500
                    ? `[Error Servidor ${res.status}] `
                    : '';
        onNotify('err', `${prefix}${data.error || 'No se pudo aplicar la edición inteligente.'}`);
        return;
      }

      const nextTitle =
        item.kind === 'activity'
          ? (data.payload as AiCreativeActivity).name
          : (data.payload as { title?: string }).title || item.title;
      const nextTheme =
        (data.payload as { centralTheme?: string; theme?: string; generalTheme?: string }).centralTheme ||
        (data.payload as { theme?: string }).theme ||
        (data.payload as { generalTheme?: string }).generalTheme ||
        item.theme;

      onChangeItem({
        ...item,
        title: nextTitle,
        theme: nextTheme,
        payload: data.payload,
      });
      setRefineInstruction('');
      onNotify(
        'ok',
        'Contenido actualizado por IA en el editor sin sobrescribir versiones ya guardadas.'
      );
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      onNotify(
        'err',
        isAbort
          ? '[Tiempo Agotado] La solicitud de refinamiento tardó demasiado. Intenta con un cambio más puntual.'
          : '[Servidor Inaccesible] No se pudo contactar con el servidor de IA al refinar.'
      );
    } finally {
      window.clearTimeout(timer);
      setRefining(false);
    }
  };

  const handleSave = async (targetStatus: 'draft' | 'final', asNewVersion = true) => {
    if (!item.title.trim()) {
      onNotify('err', 'El título no puede quedar vacío antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      const bodyPayload = {
        kind: item.kind,
        title: item.title.trim(),
        theme: item.theme.trim() || item.title.trim(),
        eventType: item.eventType.trim() || 'Sociedad de Jóvenes',
        scheduledDate: item.scheduledDate,
        status: targetStatus,
        payload: item.payload,
        note: versionNote.trim() || undefined,
        saveMode: asNewVersion ? 'new_version' : 'overwrite_draft',
      };

      const url = item.recordId
        ? `/api/ia-creativa/records/${encodeURIComponent(item.recordId)}`
        : '/api/ia-creativa/records';
      const method = item.recordId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = (await res.json()) as { record?: AiCreativeRecord; error?: string };
      if (!res.ok || !data.record) {
        onNotify('err', data.error || 'No se pudo guardar en el historial.');
        return;
      }

      setVersionNote('');
      onSavedRecord(data.record);
      onNotify(
        'ok',
        targetStatus === 'final'
          ? `Versión definitiva v${data.record.currentVersion} guardada sin sobrescribir versiones previas.`
          : `Borrador v${data.record.currentVersion} guardado en el historial.`
      );
    } catch {
      onNotify('err', 'Error de red al guardar el contenido.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!item.recordId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/ia-creativa/records/${encodeURIComponent(item.recordId)}/restore-version`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionNumber }),
        }
      );
      const data = (await res.json()) as { record?: AiCreativeRecord; error?: string };
      if (!res.ok || !data.record) {
        onNotify('err', data.error || 'No se pudo recuperar esa versión.');
        return;
      }
      onSavedRecord(data.record);
      onNotify('ok', `Versión v${versionNumber} recuperada como nuevo borrador editable (v${data.record.currentVersion}).`);
    } catch {
      onNotify('err', 'Error al conectar con el servidor para restaurar versión.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendToSaturdayProgram = async () => {
    if (item.kind !== 'program') return;
    setSendingToSat(true);
    try {
      const res = await fetch('/api/ia-creativa/send-to-saturday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: item.recordId,
          program: item.payload,
        }),
      });
      const data = (await res.json()) as {
        saturdayProgram?: { id: string; title: string };
        error?: string;
      };
      if (!res.ok || !data.saturdayProgram) {
        onNotify('err', data.error || 'No se pudo enviar al módulo Programa del Sábado.');
        return;
      }
      onSentToSaturday(data.saturdayProgram.id, item.recordId);
      onNotify(
        'ok',
        `Programa "${data.saturdayProgram.title}" enviado a Programa del Sábado como borrador para tu revisión y aprobación.`
      );
    } catch {
      onNotify('err', 'Error de red al enviar a Programa del Sábado.');
    } finally {
      setSendingToSat(false);
    }
  };

  const handleLaunchRealGame = async (rawMode: string, customTitle?: string) => {
    const validModes = Object.keys(GAME_MODE_INFO) as GameMode[];
    const mode: GameMode = validModes.includes(rawMode as GameMode)
      ? (rawMode as GameMode)
      : 'clasico';

    setLaunchingGameMode(mode);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: (customTitle || item.title || 'Juego Juvenil en Vivo').slice(0, 80),
          mode,
          categories: [...ALL_CATEGORIES],
          difficulty: 'combinado',
          questionCount: 15,
          timeLimitSec: 20,
          maxParticipants: 100,
          basePoints: 1000,
          speedBonusMax: 500,
          specialEveryN: 5,
        }),
      });
      const data = (await res.json()) as {
        code?: string;
        presenterToken?: string;
        error?: string;
      };
      if (!res.ok || !data.code || !data.presenterToken) {
        onNotify('err', data.error || 'No se pudo iniciar la sala del juego.');
        return;
      }
      onCreatedMultiplayerRoom(data.code, data.presenterToken);
    } catch {
      onNotify('err', 'Error de conexión al crear la partida en vivo.');
    } finally {
      setLaunchingGameMode(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      await exportCreativeRecordToPdf(item.kind, item.title, item.payload);
      onNotify('ok', 'Archivo PDF generado y descargado correctamente.');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'No se pudo exportar a PDF.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPptx = async () => {
    if (item.kind !== 'presentation') return;
    setExporting('pptx');
    try {
      await exportPresentationToPptx(item.payload as AiCreativePresentation);
      onNotify('ok', 'Presentación PowerPoint (.pptx) generada y descargada correctamente.');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'No se pudo exportar a PowerPoint.');
    } finally {
      setExporting(null);
    }
  };

  const renderProgramEditor = (prog: AiCreativeProgram) => {
    const totalMin = prog.steps.reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0);
    const updateProg = (patch: Partial<AiCreativeProgram>) => {
      onChangeItem({
        ...item,
        title: patch.title ?? item.title,
        theme: patch.centralTheme ?? item.theme,
        scheduledDate: patch.scheduledDate ?? item.scheduledDate,
        payload: { ...prog, ...patch },
      });
    };

    return (
      <div className="space-y-6">
        {/* Identidad del programa */}
        <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display font-bold text-lg text-amber-300">
              A. Identidad y Fundamento del Programa
            </h4>
            <div className="flex items-center gap-2">
              {([60, 90, 120] as const).map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() =>
                    updateProg({
                      durationMinutes: dur,
                      steps: rebalanceProgramStepDurations(prog.steps, dur),
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg font-mono-num text-xs font-bold cursor-pointer border ${
                    prog.durationMinutes === dur
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-[#080E1E] text-slate-300 border-slate-700'
                  }`}
                >
                  {dur} min
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Título creativo</label>
              <input
                type="text"
                value={prog.title}
                onChange={(e) => updateProg({ title: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Subtítulo</label>
              <input
                type="text"
                value={prog.subtitle}
                onChange={(e) => updateProg({ subtitle: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Tema central</label>
              <input
                type="text"
                value={prog.centralTheme}
                onChange={(e) => updateProg({ centralTheme: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Lema</label>
              <input
                type="text"
                value={prog.motto}
                onChange={(e) => updateProg({ motto: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-amber-200"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Texto bíblico principal</label>
              <input
                type="text"
                value={prog.mainBibleText}
                onChange={(e) => updateProg({ mainBibleText: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sky-300 font-semibold"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Público y fecha</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prog.targetAudience}
                  onChange={(e) => updateProg({ targetAudience: e.target.value })}
                  className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                />
                <input
                  type="date"
                  value={prog.scheduledDate}
                  onChange={(e) => updateProg({ scheduledDate: e.target.value })}
                  className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400 font-semibold block mb-1">Texto bíblico citado / idea central</label>
              <textarea
                rows={2}
                value={prog.mainBibleVerseQuote}
                onChange={(e) => updateProg({ mainBibleVerseQuote: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400 font-semibold block mb-1">Objetivo espiritual</label>
              <textarea
                rows={2}
                value={prog.spiritualObjective}
                onChange={(e) => updateProg({ spiritualObjective: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={sendingToSat}
              onClick={() => void handleSendToSaturdayProgram()}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-xs inline-flex items-center gap-2 cursor-pointer"
            >
              {sendingToSat ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
              Enviar a Programa del Sábado
            </button>

            {item.sentToSaturdayProgramId && (
              <button
                type="button"
                onClick={() => onOpenSaturdayProgram(item.sentToSaturdayProgramId)}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Abrir en Programa del Sábado
              </button>
            )}

            <button
              type="button"
              onClick={() => onGeneratePresentationFromItem(item)}
              className="px-3.5 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              Crear Presentación de este Programa
            </button>
          </div>
        </div>

        {/* Guion Maestro + Cronograma exacto */}
        {prog.presenterMasterScript && (
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 space-y-2">
            <h4 className="font-display font-bold text-sm text-sky-300 uppercase tracking-wider">
              Guion Maestro del Presentador
            </h4>
            <textarea
              rows={3}
              value={prog.presenterMasterScript}
              onChange={(e) => updateProg({ presenterMasterScript: e.target.value })}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 leading-relaxed"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display font-bold text-lg text-white">
              Desarrollo Paso a Paso y Cronograma ({prog.steps.length} bloques)
            </h4>
            <div className="flex items-center gap-2">
              <span
                className={`font-mono-num text-sm font-extrabold ${
                  totalMin === prog.durationMinutes ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                Suma actual: {totalMin} / {prog.durationMinutes} min
              </span>
              {totalMin !== prog.durationMinutes && (
                <button
                  type="button"
                  onClick={() =>
                    updateProg({
                      steps: rebalanceProgramStepDurations(prog.steps, prog.durationMinutes),
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Ajustar a {prog.durationMinutes}m exactos
                </button>
              )}
            </div>
          </div>

          {prog.steps.map((step, sIdx) => (
            <div
              key={step.id}
              className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono-num font-bold text-amber-300">
                      #{step.order} · {step.blockLabel}
                    </span>
                    <span>·</span>
                    <span>
                      {step.contentDistinction === 'biblico_textual'
                        ? 'Cita bíblica textual'
                        : step.contentDistinction === 'adaptacion_creativa'
                          ? 'Adaptación creativa'
                          : 'Dinámica práctica'}
                    </span>
                    {step.biblicalReference && (
                      <>
                        <span>·</span>
                        <span className="text-sky-300">{step.biblicalReference}</span>
                      </>
                    )}
                  </div>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => {
                      const copy = [...prog.steps];
                      copy[sIdx] = { ...step, title: e.target.value };
                      updateProg({ steps: copy });
                    }}
                    className="w-full bg-transparent border-b border-slate-800 focus:border-amber-400 font-display font-bold text-base text-white py-1 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-[#080E1E] border border-slate-700 rounded-lg px-2 py-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={step.durationMin}
                      onChange={(e) => {
                        const copy = [...prog.steps];
                        copy[sIdx] = {
                          ...step,
                          durationMin: Math.max(1, Math.min(60, Math.round(Number(e.target.value) || 1))),
                        };
                        updateProg({ steps: copy });
                      }}
                      className="w-10 bg-transparent text-white font-mono-num text-xs font-bold text-center focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400">min</span>
                  </div>

                  <button
                    type="button"
                    disabled={refining}
                    onClick={() =>
                      void runAiRefine(
                        `Regenera y mejora completamente solo el bloque "${step.blockLabel}" (${step.title}) con una propuesta más fresca, participativa y alineada al tema "${prog.centralTheme}".`,
                        step.id
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Regenerar bloque
                  </button>

                  {step.compatibleGameMode && (
                    <button
                      type="button"
                      disabled={launchingGameMode !== null}
                      onClick={() =>
                        void handleLaunchRealGame(step.compatibleGameMode!, `${prog.title}: ${step.title}`)
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      Abrir partida ({step.compatibleGameMode})
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#080E1E] border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <p className="font-bold text-amber-300">Qué dice el presentador</p>
                  <p className="text-slate-200 leading-relaxed">{step.whatPresenterSays}</p>
                </div>
                <div className="bg-[#080E1E] border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <p className="font-bold text-sky-300">Qué hace el director y organización</p>
                  <p className="text-slate-200 leading-relaxed">
                    {step.whatDirectorDoes} · {step.howToOrganize}
                  </p>
                </div>
                <div className="bg-[#080E1E] border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <p className="font-bold text-emerald-300">Participantes y ejecución</p>
                  <p className="text-slate-300 leading-relaxed">
                    <strong>Participantes:</strong> {step.whatParticipantsDo} <br />
                    <strong>Inicio:</strong> {step.howToStart} · <strong>Desarrollo:</strong> {step.howToDevelop} · <strong>Cierre:</strong> {step.howToFinish}
                  </p>
                </div>
                <div className="bg-[#080E1E] border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <p className="font-bold text-purple-300">Enseñanza espiritual y materiales</p>
                  <p className="text-slate-200 leading-relaxed">{step.spiritualTeaching}</p>
                  <p className="text-slate-400">
                    Materiales: {step.materials?.length ? step.materials.join(', ') : 'Ninguno especial'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Extra All-Inclusive Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {prog.developedReflection && (
            <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-1.5">
              <p className="font-bold text-amber-300 uppercase tracking-wider">Reflexión desarrollada</p>
              <p className="text-slate-200 leading-relaxed whitespace-pre-line">{prog.developedReflection}</p>
            </div>
          )}
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2">
            <p className="font-bold text-emerald-300 uppercase tracking-wider">Desafío espiritual semanal</p>
            <p className="text-slate-200 leading-relaxed">{prog.weeklySpiritualChallenge}</p>
            {prog.questionsForAudience?.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <p className="font-bold text-sky-300">Preguntas para el público</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {prog.questionsForAudience.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {prog.imagePromptsSuggested?.length > 0 && (
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-xs">
              <p className="font-bold text-sky-300">Ideas de recursos visuales para este programa</p>
              <p className="text-slate-300">{prog.imagePromptsSuggested[0]}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                onPrefillImageGenerator(prog.imagePromptsSuggested[0], item.recordId)
              }
              className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              Ir a Generador de Imágenes
            </button>
          </div>
        )}

        {prog.doctrinalReviewPoints?.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-400/35 rounded-2xl p-4 text-xs text-amber-100 space-y-1">
            <p className="font-bold text-amber-300 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Puntos sugeridos para revisión doctrinal del director
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {prog.doctrinalReviewPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderPresentationEditor = (pres: AiCreativePresentation) => {
    const updatePres = (patch: Partial<AiCreativePresentation>) => {
      onChangeItem({
        ...item,
        title: patch.title ?? item.title,
        theme: patch.theme ?? item.theme,
        payload: { ...pres, ...patch },
      });
    };

    return (
      <div className="space-y-5">
        <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-display font-bold text-lg text-white">
                Diapositivas ({pres.slides.length})
              </h4>
              <p className="text-xs text-slate-400">
                Edita textos, notas del presentador o vincula imágenes generadas por IA antes de exportar a PowerPoint (.pptx) o PDF.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={exporting !== null || pres.slides.length === 0}
                onClick={() => void handleExportPptx()}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {exporting === 'pptx' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                Descargar PowerPoint (.pptx)
              </button>
              <button
                type="button"
                disabled={exporting !== null || pres.slides.length === 0}
                onClick={() => void exportPresentationToPdf(pres)}
                className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Exportar PDF 16:9
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <input
              type="text"
              value={pres.title}
              onChange={(e) => updatePres({ title: e.target.value })}
              placeholder="Título de la presentación"
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
            />
            <input
              type="text"
              value={pres.theme}
              onChange={(e) => updatePres({ theme: e.target.value })}
              placeholder="Tema"
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
            <input
              type="text"
              value={pres.mainBibleText}
              onChange={(e) => updatePres({ mainBibleText: e.target.value })}
              placeholder="Texto bíblico"
              className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sky-300 font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pres.slides.map((sld, idx) => (
            <div
              key={sld.id}
              className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono-num font-bold text-amber-300">
                  Diapositiva {idx + 1} · {sld.kind}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSlideForImage(
                        selectedSlideForImage === sld.id ? null : sld.id
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {sld.imageUrl ? 'Cambiar imagen' : 'Elegir imagen'}
                  </button>
                  <button
                    type="button"
                    disabled={pres.slides.length <= 1}
                    onClick={() => {
                      const next = pres.slides
                        .filter((s) => s.id !== sld.id)
                        .map((s, i) => ({ ...s, order: i + 1 }));
                      updatePres({ slides: next });
                    }}
                    className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer disabled:opacity-30"
                    title="Eliminar diapositiva"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selectedSlideForImage === sld.id && (
                <div className="bg-[#080E1E] border border-slate-700 rounded-xl p-3 space-y-2 text-xs">
                  <p className="font-semibold text-slate-300">
                    Imágenes generadas disponibles ({images.length}):
                  </p>
                  {images.length === 0 ? (
                    <p className="text-slate-400">
                      Aún no hay imágenes guardadas en tu biblioteca. Puedes generar una en la pestaña &ldquo;Imágenes Cristianas&rdquo;.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {images.slice(0, 8).map((im) => (
                        <button
                          key={im.id}
                          type="button"
                          onClick={() => {
                            const copy = [...pres.slides];
                            copy[idx] = { ...sld, imageId: im.id, imageUrl: im.imageUrl };
                            updatePres({ slides: copy });
                            setSelectedSlideForImage(null);
                          }}
                          className="w-16 h-12 rounded-lg overflow-hidden border border-slate-600 hover:border-amber-400 cursor-pointer"
                        >
                          <img
                            src={im.imageUrl}
                            alt={im.prompt}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                      {sld.imageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const copy = [...pres.slides];
                            copy[idx] = { ...sld, imageId: undefined, imageUrl: undefined };
                            updatePres({ slides: copy });
                            setSelectedSlideForImage(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 text-[11px] font-bold cursor-pointer"
                        >
                          Quitar imagen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sld.imageUrl && (
                <img
                  src={sld.imageUrl}
                  alt={sld.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-36 object-cover rounded-xl border border-slate-800"
                />
              )}

              <input
                type="text"
                value={sld.title}
                onChange={(e) => {
                  const copy = [...pres.slides];
                  copy[idx] = { ...sld, title: e.target.value };
                  updatePres({ slides: copy });
                }}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
              />

              <input
                type="text"
                value={sld.bibleVerse || ''}
                onChange={(e) => {
                  const copy = [...pres.slides];
                  copy[idx] = { ...sld, bibleVerse: e.target.value };
                  updatePres({ slides: copy });
                }}
                placeholder="Versículo o subtítulo (opcional)"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-200"
              />

              <textarea
                rows={3}
                value={(sld.bullets || []).join('\n')}
                onChange={(e) => {
                  const copy = [...pres.slides];
                  copy[idx] = {
                    ...sld,
                    bullets: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
                  };
                  updatePres({ slides: copy });
                }}
                placeholder="Un punto por línea"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            updatePres({
              slides: [
                ...pres.slides,
                {
                  id: `SLD-${Date.now()}`,
                  order: pres.slides.length + 1,
                  kind: 'punto_principal',
                  title: 'Nueva Diapositiva',
                  bullets: ['Punto clave para compartir con los jóvenes'],
                  speakerNotes: '',
                },
              ],
            })
          }
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          Agregar diapositiva
        </button>
      </div>
    );
  };

  const renderGenericEditor = () => {
    if (item.kind === 'sermon') {
      const s = item.payload as AiCreativeSermon;
      const updateSermon = (patch: Partial<AiCreativeSermon>) => {
        onChangeItem({
          ...item,
          title: patch.title ?? item.title,
          payload: { ...s, ...patch },
        });
      };
      return (
        <div className="space-y-4 text-sm">
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-sky-300">
                {s.sermonType.replace(/_/g, ' ')} · {s.durationMinutes} min · Profundidad {s.depth}
              </span>
              <button
                type="button"
                onClick={() => onGeneratePresentationFromItem(item)}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                Convertir en Presentación
              </button>
            </div>
            <input
              type="text"
              value={s.title}
              onChange={(e) => updateSermon({ title: e.target.value })}
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-white font-display font-bold text-lg"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Texto bíblico base</label>
                <input
                  type="text"
                  value={s.mainBibleText}
                  onChange={(e) => updateSermon({ mainBibleText: e.target.value })}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-semibold"
                />
              </div>
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Objetivo espiritual</label>
                <input
                  type="text"
                  value={s.objective}
                  onChange={(e) => updateSermon({ objective: e.target.value })}
                  className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
            </div>
            <div className="text-xs space-y-2">
              <p className="font-bold text-slate-300">Contexto del pasaje</p>
              <p className="text-slate-300 bg-[#080E1E] rounded-xl p-3">{s.passageContext}</p>
              <p className="font-bold text-slate-300">Introducción</p>
              <textarea
                rows={3}
                value={s.introduction}
                onChange={(e) => updateSermon({ introduction: e.target.value })}
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
          </div>

          {s.mainPoints.map((pt, i) => (
            <div key={i} className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
              <p className="font-display font-bold text-base text-amber-300">
                Punto {i + 1}: {pt.heading} ({pt.bibleSupport})
              </p>
              <p className="text-slate-200 leading-relaxed">{pt.explanation}</p>
              <p className="text-sky-200 bg-[#080E1E] rounded-xl p-2.5">
                <strong>Ejemplo / Ilustración:</strong> {pt.illustrationExample}
              </p>
              <p className="text-emerald-300">
                <strong>Aplicación juvenil:</strong> {pt.youthApplication}
              </p>
            </div>
          ))}

          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
            <p className="text-slate-200"><strong>Aplicación diaria:</strong> {s.dailyLifeApplication}</p>
            <p className="text-slate-200"><strong>Conclusión:</strong> {s.conclusion}</p>
            <p className="text-amber-200"><strong>Llamado:</strong> {s.spiritualCall}</p>
            <p className="text-sky-200"><strong>Oración sugerida:</strong> {s.suggestedPrayer}</p>
            {s.biblicalVerificationNote && (
              <p className="text-amber-300/90 pt-2 border-t border-slate-800">
                <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                {s.biblicalVerificationNote}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (item.kind === 'activity') {
      const a = item.payload as AiCreativeActivity;
      const updateAct = (patch: Partial<AiCreativeActivity>) => {
        onChangeItem({
          ...item,
          title: patch.name ?? item.title,
          payload: { ...a, ...patch },
        });
      };
      return (
        <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              value={a.name}
              onChange={(e) => updateAct({ name: e.target.value })}
              className="flex-1 min-w-[220px] bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-base font-display font-bold text-white"
            />
            {a.compatibleGameMode && (
              <button
                type="button"
                disabled={launchingGameMode !== null}
                onClick={() => void handleLaunchRealGame(a.compatibleGameMode!, a.name)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                {launchingGameMode ? 'Creando sala...' : `Convertir en partida (${a.compatibleGameMode})`}
              </button>
            )}
          </div>
          <p className="text-slate-300">
            <strong>Objetivo:</strong> {a.objective} · <strong>Participantes:</strong> {a.participantCount} · <strong>Duración:</strong> {a.durationMinutes} min
          </p>
          <p className="text-slate-300"><strong>Materiales:</strong> {(a.materials || []).join(', ') || 'Sin materiales especiales'}</p>
          <p className="text-slate-300"><strong>Preparación:</strong> {a.preparation}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#080E1E] rounded-xl p-3 space-y-1">
              <p className="font-bold text-amber-300">Reglas</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-200">
                {a.rules.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div className="bg-[#080E1E] rounded-xl p-3 space-y-1">
              <p className="font-bold text-sky-300">Desarrollo paso a paso</p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-200">
                {a.stepByStep.map((st, i) => <li key={i}>{st}</li>)}
              </ol>
            </div>
          </div>
          <p className="text-slate-200"><strong>Resultado / Ganador:</strong> {a.howToDetermineResult}</p>
          <p className="text-emerald-200"><strong>Reflexión espiritual:</strong> {a.spiritualReflection} {a.biblicalReference ? `(${a.biblicalReference})` : ''}</p>
          {a.variants?.length > 0 && (
            <p className="text-slate-300"><strong>Variantes:</strong> {a.variants.join(' · ')}</p>
          )}
        </div>
      );
    }

    if (item.kind === 'script') {
      const g = item.payload as AiCreativeScript;
      return (
        <div className="space-y-4 text-xs">
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 space-y-2">
            <h4 className="font-display font-bold text-lg text-white">{g.title}</h4>
            <p className="text-sky-300">
              {g.scriptType.replace(/_/g, ' ')} · {g.participantCount} participantes · {g.durationMinutes} min · Base: {g.biblicalBasis}
            </p>
            <p className="text-slate-300"><strong>Escenografía:</strong> {g.scenery}</p>
            <p className="text-slate-300"><strong>Materiales:</strong> {(g.materials || []).join(', ')}</p>
            <p className="text-slate-300"><strong>Indicaciones de actuación:</strong> {g.actingNotes}</p>
            <div className="bg-amber-500/10 border border-amber-400/35 rounded-xl p-3 text-amber-100">
              <strong>Distinción bíblica vs adaptación creativa:</strong> {g.biblicalVsCreativeDistinction}
            </div>
          </div>
          {g.scenes.map((sc) => (
            <div key={sc.sceneNumber} className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2">
              <p className="font-bold text-amber-300">
                Escena {sc.sceneNumber}: {sc.sceneTitle} ({sc.stageSetting})
              </p>
              <div className="space-y-2">
                {sc.lines.map((ln, idx) => (
                  <div key={idx} className="bg-[#080E1E] rounded-xl p-2.5">
                    <span className="font-bold text-sky-300">{ln.speaker}</span>{' '}
                    <span className="italic text-slate-400">({ln.actingCue})</span>:{' '}
                    <span className="text-slate-100">&ldquo;{ln.dialogue}&rdquo;</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 text-emerald-200">
            <strong>Mensaje espiritual final:</strong> {g.spiritualMessage}
          </div>
        </div>
      );
    }

    if (item.kind === 'event') {
      const ev = item.payload as AiCreativeEvent;
      return (
        <div className="space-y-4 text-xs">
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-5 space-y-2">
            <h4 className="font-display font-bold text-lg text-white">{ev.title}</h4>
            <p className="text-amber-300 font-semibold">Tema general: {ev.generalTheme} · {ev.mainBibleText}</p>
            <p className="font-bold text-sky-300 pt-1">Objetivos</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-200">
              {ev.objectives.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
          <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2">
            <p className="font-bold text-amber-300">Cronograma del evento</p>
            {ev.schedule.map((b, i) => (
              <div key={i} className="bg-[#080E1E] rounded-xl p-2.5 flex flex-wrap justify-between gap-2">
                <span className="font-mono-num text-sky-300 font-bold">{b.timeSlot}</span>
                <span className="text-white font-semibold flex-1">{b.block}: {b.activity}</span>
                <span className="text-slate-400">Resp: {b.responsibleRole}</span>
              </div>
            ))}
          </div>
          {ev.includeBudget && ev.estimatedBudget.length > 0 && (
            <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2">
              <p className="font-bold text-emerald-300">Presupuesto estimado referencial</p>
              {ev.estimatedBudget.map((b, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-slate-800/70 pb-1.5">
                  <span className="text-slate-200">{b.category}: {b.concept}</span>
                  <span className="font-mono-num text-amber-300">{b.estimatedAmountNote}</span>
                </div>
              ))}
              {ev.budgetDisclaimer && <p className="text-slate-400">{ev.budgetDisclaimer}</p>}
            </div>
          )}
        </div>
      );
    }

    // music
    const m = item.payload as AiCreativeMusicPlan;
    return (
      <div className="space-y-4 text-xs">
        <div className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <h4 className="font-display font-bold text-lg text-white">{m.title}</h4>
          <p className="text-sky-300">{m.centralTheme} · {m.mainBibleText}</p>
          <p className="text-amber-200">{m.verificationNotice}</p>
          <p className="text-slate-400">{m.copyrightComplianceNote}</p>
        </div>
        {m.moments.map((mo, i) => (
          <div key={i} className="bg-[#0B1224] border border-slate-800 rounded-2xl p-4 space-y-2">
            <p className="font-display font-bold text-base text-amber-300">{mo.momentLabel}</p>
            <p className="text-slate-200"><strong>Propósito:</strong> {mo.spiritualPurpose}</p>
            <p className="text-slate-300"><strong>Estilo y tempo:</strong> {mo.suggestedStyleAndTempo} · <strong>Énfasis bíblico:</strong> {mo.biblicalEmphasis}</p>
            <p className="text-sky-200"><strong>Indicaciones al equipo:</strong> {mo.teamInstructions}</p>
            {mo.songOrHymnGuidance?.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-slate-300">
                {mo.songOrHymnGuidance.map((sg, j) => (
                  <li key={j}>
                    {sg.suggestion} <span className="text-slate-400">({sg.verificationRequiredNote})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Versioning / Save Bar */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-bold text-amber-300">{meta.shortLabel}</span>
              <span>·</span>
              <span className="font-mono-num">
                {item.recordId ? `v${item.currentVersion}` : 'Nuevo sin guardar'}
              </span>
              <span>·</span>
              <span className={item.status === 'final' ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                {item.status === 'final' ? 'Versión Definitiva' : 'Borrador'}
              </span>
            </div>
            <h3 className="font-display font-extrabold text-xl sm:text-2xl text-white">
              {item.title}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('draft', true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4 text-sky-400" />
              Guardar borrador
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('final', true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Guardar versión definitiva
            </button>

            {item.versions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVersions((v) => !v)}
                className="px-3 py-2.5 rounded-xl bg-[#080E1E] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <History className="w-4 h-4 text-amber-400" />
                Versiones ({item.versions.length})
              </button>
            )}

            <button
              type="button"
              disabled={exporting !== null}
              onClick={() => void handleExportPdf()}
              className="px-3 py-2.5 rounded-xl bg-[#080E1E] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              PDF
            </button>

            {item.kind !== 'presentation' && (
              <button
                type="button"
                onClick={() => exportCreativeRecordToTxt(item.kind, item.title, item.payload)}
                className="px-3 py-2.5 rounded-xl bg-[#080E1E] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-sky-400" />
                TXT
              </button>
            )}
          </div>
        </div>

        {/* Version History Recovery Drawer */}
        {showVersions && item.versions.length > 0 && (
          <div className="bg-[#080E1E] border border-slate-700 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-amber-300">
                Historial de versiones (nunca se sobrescribe una versión definitiva)
              </p>
              <input
                type="text"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="Nota opcional para el próximo guardado..."
                className="bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs w-64"
              />
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...item.versions].reverse().map((v) => (
                <div
                  key={v.versionNumber}
                  className="flex flex-wrap items-center justify-between gap-2 bg-[#111A2E] rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-white">v{v.versionNumber}</span>
                    <span className={v.status === 'final' ? 'text-emerald-300 font-semibold' : 'text-amber-300'}>
                      {v.status === 'final' ? 'Definitiva' : 'Borrador'}
                    </span>
                    <span className="text-slate-400">· {new Date(v.savedAt).toLocaleString()}</span>
                    <span className="text-slate-300">— {v.note}</span>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRestoreVersion(v.versionNumber)}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Recuperar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Smart Refinement Toolbar */}
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-amber-300 inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Edición rápida con IA:
            </span>
            {[
              ['Cambiar título', 'Propón un título y subtítulo mucho más creativo, fresco y atractivo manteniendo el mismo tema bíblico.'],
              ['Cambiar tema', 'Renueva el tema central y lema manteniendo la duración y estructura general.'],
              ['Ampliar explicación', 'Amplía las instrucciones y explicaciones paso a paso para que el director tenga mayor detalle práctico.'],
              ['Cambiar texto bíblico', 'Sustituye el texto bíblico principal por otro pasaje real de la Biblia igualmente apropiado y ajusta las referencias en coherencia.'],
              ...(item.kind === 'program'
                ? [
                    ['Reducir a 60 min', 'Ajusta y condensa las actividades para que el programa completo encaje perfectamente en 60 minutos exactos.', 60],
                    ['Sustituir dinámica', 'Sustituye la dinámica rompehielos y el juego por opciones completamente nuevas y más dinámicas.'],
                  ]
                : []),
            ].map(([label, promptText, dur]) => (
              <button
                key={String(label)}
                type="button"
                disabled={refining}
                onClick={() => void runAiRefine(String(promptText), undefined, Number(dur || 0))}
                className="px-2.5 py-1.5 rounded-lg bg-[#080E1E] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (refineInstruction.trim()) {
                void runAiRefine(refineInstruction.trim());
              }
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              placeholder="Ej: Haz la bienvenida más participativa para jóvenes nuevos, o cambia el tono a más juvenil..."
              className="flex-1 bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={refining || !refineInstruction.trim()}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {refining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refinando con IA...
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Aplicar cambio con IA
                </>
              )}
            </button>
          </form>

          {!geminiConfigured && (
            <p className="text-xs text-amber-300 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              La edición manual funciona siempre; para aplicar cambios automáticos con IA se requiere GEMINI_API_KEY en Settings &gt; Secrets.
            </p>
          )}
        </div>
      </div>

      {/* Resource Body */}
      {item.kind === 'program'
        ? renderProgramEditor(item.payload as AiCreativeProgram)
        : item.kind === 'presentation'
          ? renderPresentationEditor(item.payload as AiCreativePresentation)
          : renderGenericEditor()}
    </div>
  );
}
