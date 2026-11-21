import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  RefreshCw,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { LearningProgressData } from '../shared/expansionTypes';
import { DIFFICULTY_LABELS, Difficulty } from '../shared/types';
import { getOrCreateProfileKey } from '../utils/profileKey';
import { soundFX } from '../utils/sound';
import { CompetitionSetupForm } from './CompetitionSetupForm';

interface StudyTopic {
  id: string;
  label: string;
  desc: string;
}

interface StudyCardClient {
  id: string;
  topicId: string;
  topicLabel: string;
  bookOrSection: string;
  chapterRef?: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
}

interface AnswerTeachingFeedback {
  isCorrect: boolean;
  correctIndex: number;
  correctOptionText: string;
  reference: string;
  simpleExplanation: string;
  context: string;
  mainTeaching: string;
  complementaryQuestion: {
    prompt: string;
    answer: string;
    reference: string;
  } | null;
  progress: LearningProgressData;
}

export function AprendeBibliaView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: {
  onBack: () => void;
  onCreatedMultiplayerRoom?: (code: string, presenterToken: string) => void;
  onJoinCode?: (code: string) => void;
}) {
  const [playMode, setPlayMode] = useState<'solo' | 'multiplayer'>('solo');
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [cards, setCards] = useState<StudyCardClient[]>([]);
  const [progress, setProgress] = useState<LearningProgressData | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [reviewFailedOnly, setReviewFailedOnly] = useState(false);
  const [cardCursor, setCardCursor] = useState(0);

  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerTeachingFeedback | null>(null);
  const [showComplementaryAnswer, setShowComplementaryAnswer] = useState(false);

  const profileKey = getOrCreateProfileKey();

  useEffect(() => {
    soundFX.setDidacticAmbient('learning');
    return () => soundFX.setDidacticAmbient(null);
  }, []);

  useEffect(() => {
    fetch(`/api/expansion/learning?profileKey=${encodeURIComponent(profileKey)}`)
      .then((r) => r.json())
      .then((data) => {
        setTopics(data.topics || []);
        setCards(data.cards || []);
        setProgress(data.progress || null);
      });
  }, [profileKey]);

  const filteredCards = useMemo(() => {
    let list = cards;
    if (reviewFailedOnly && progress) {
      const failSet = new Set(progress.incorrectQueueIds);
      list = list.filter((c) => failSet.has(c.id));
    } else if (selectedTopic !== 'all') {
      list = list.filter((c) => c.topicId === selectedTopic);
    }
    return list;
  }, [cards, selectedTopic, reviewFailedOnly, progress]);

  const activeCard =
    filteredCards.length > 0
      ? filteredCards[cardCursor % filteredCards.length]
      : null;

  const handleSelectOption = async (idx: number) => {
    if (!activeCard || pickedIndex !== null) return;
    setPickedIndex(idx);
    setShowComplementaryAnswer(false);
    const res = await fetch('/api/expansion/learning/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileKey,
        cardId: activeCard.id,
        selectedIndex: idx,
      }),
    });
    const out = (await res.json()) as AnswerTeachingFeedback;
    setFeedback(out);
    setProgress(out.progress);
    if (out.isCorrect) {
      soundFX.playLessonComplete();
    } else {
      soundFX.playStudyNote();
    }
  };

  const handleNext = () => {
    soundFX.playStudyNote();
    setPickedIndex(null);
    setFeedback(null);
    setShowComplementaryAnswer(false);
    setCardCursor((c) => c + 1);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300">
            <GraduationCap className="w-4 h-4" />
            Modo de Aprendizaje Bíblico (Sin Límite de Tiempo)
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Aprende con la Biblia
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Estudia por libros, capítulos, personajes, parábolas, milagros y profecías con explicación bíblica, contexto y enseñanza práctica.
          </p>
        </div>

        {progress && (
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-4 text-xs shrink-0">
            <div>
              <p className="font-mono-num text-lg font-extrabold text-emerald-300">
                {progress.correctCardIds.length}/{cards.length}
              </p>
              <p className="text-slate-400">Dominadas</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <p className="font-mono-num text-lg font-extrabold text-amber-300">
                {progress.studiedTopicIds.length}/{topics.length}
              </p>
              <p className="text-slate-400">Temas estudiados</p>
            </div>
          </div>
        )}
      </div>

      {onCreatedMultiplayerRoom && (
        <div className="flex flex-wrap gap-2 bg-[#111A2E] border border-slate-800 p-1.5 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setPlayMode('solo')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              playMode === 'solo'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Estudio Individual (Sin Tiempo)
          </button>
          <button
            type="button"
            onClick={() => setPlayMode('multiplayer')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              playMode === 'multiplayer'
                ? 'bg-sky-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Modo Competencia Multijugador
          </button>
        </div>
      )}

      {playMode === 'multiplayer' && onCreatedMultiplayerRoom ? (
        <CompetitionSetupForm
          mode="aprende_biblia"
          defaultTitle="Aprende con la Biblia en Vivo"
          description="Competencia grupal de estudio bíblico con temporizador, equipos opcionales y explicación bíblica configurable tras cada pregunta o al finalizar la ronda."
          showLearningOptions
          countLabel="Cantidad de preguntas de estudio"
          countOptions={[5, 8, 10, 12, 15]}
          defaultCount={8}
          timeOptions={[
            { value: 20, label: '20 segundos' },
            { value: 30, label: '30 segundos' },
            { value: 45, label: '45 segundos' },
            { value: 60, label: '60 segundos' },
          ]}
          defaultTimeSec={30}
          onCreated={onCreatedMultiplayerRoom}
          onJoinCode={onJoinCode}
        />
      ) : (
        <>
      {/* Topic Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setReviewFailedOnly(false);
            setSelectedTopic('all');
            setCardCursor(0);
            setPickedIndex(null);
            setFeedback(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
            !reviewFailedOnly && selectedTopic === 'all'
              ? 'bg-sky-400 text-slate-950 border-sky-300'
              : 'bg-[#111A2E] border-slate-800 text-slate-300'
          }`}
        >
          Todos los temas ({cards.length})
        </button>

        {progress && progress.incorrectQueueIds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setReviewFailedOnly(true);
              setCardCursor(0);
              setPickedIndex(null);
              setFeedback(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
              reviewFailedOnly
                ? 'bg-rose-500 text-white border-rose-400'
                : 'bg-rose-500/15 border-rose-400/50 text-rose-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Repasar falladas ({progress.incorrectQueueIds.length})
          </button>
        )}

        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setReviewFailedOnly(false);
              setSelectedTopic(t.id);
              setCardCursor(0);
              setPickedIndex(null);
              setFeedback(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
              !reviewFailedOnly && selectedTopic === t.id
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-[#111A2E] border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Study Card */}
      {!activeCard ? (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-10 text-center text-slate-400 space-y-2">
          <p className="font-semibold text-white">
            {reviewFailedOnly
              ? '¡Excelente! No tienes preguntas pendientes por repasar.'
              : 'No hay tarjetas disponibles en este filtro.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sky-300">{activeCard.topicLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{activeCard.bookOrSection}</span>
              {activeCard.chapterRef && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 font-semibold">{activeCard.chapterRef}</span>
                </>
              )}
            </div>
            <span>
              {DIFFICULTY_LABELS[activeCard.difficulty]} · Sin cronómetro
            </span>
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
            {activeCard.prompt}
          </h2>

          <div className="grid grid-cols-1 gap-2.5">
            {activeCard.options.map((opt, idx) => {
              const isPicked = pickedIndex === idx;
              const isRight = feedback && feedback.correctIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={pickedIndex !== null}
                  onClick={() => handleSelectOption(idx)}
                  className={`p-4 rounded-xl border text-left text-sm sm:text-base font-medium flex items-center justify-between gap-3 transition-colors ${
                    feedback
                      ? isRight
                        ? 'bg-emerald-600/20 border-emerald-400 text-emerald-100'
                        : isPicked
                          ? 'bg-rose-600/20 border-rose-400 text-rose-100'
                          : 'bg-[#080E1E] border-slate-800 text-slate-500'
                      : 'bg-[#080E1E] hover:bg-slate-800 border-slate-700 text-white cursor-pointer'
                  }`}
                >
                  <span>{opt}</span>
                  {feedback && isRight && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  {feedback && isPicked && !isRight && (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* 6-Element Teaching Feedback Block */}
          {feedback && (
            <div className="bg-[#080E1E] border border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <span
                  className={`font-display font-extrabold text-base ${
                    feedback.isCorrect ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  1. Respuesta correcta: {feedback.correctOptionText}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-lg">
                  <BookOpen className="w-3.5 h-3.5" />
                  2. Cita bíblica: {feedback.reference}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                    3. Explicación sencilla
                  </p>
                  <p className="text-slate-200 leading-relaxed">{feedback.simpleExplanation}</p>
                </div>
                <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    4. Contexto del acontecimiento
                  </p>
                  <p className="text-slate-200 leading-relaxed">{feedback.context}</p>
                </div>
                <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-4 space-y-1">
                  <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider inline-flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    5. Enseñanza principal
                  </p>
                  <p className="text-slate-200 leading-relaxed">{feedback.mainTeaching}</p>
                </div>
              </div>

              {feedback.complementaryQuestion && (
                <div className="bg-[#111A2E] border border-amber-400/30 rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-amber-300 inline-flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      6. Pregunta complementaria opcional
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowComplementaryAnswer((v) => !v)}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      {showComplementaryAnswer ? 'Ocultar respuesta' : 'Ver respuesta bíblica'}
                    </button>
                  </div>
                  <p className="text-sm text-white font-medium">
                    {feedback.complementaryQuestion.prompt}
                  </p>
                  {showComplementaryAnswer && (
                    <p className="text-xs sm:text-sm text-emerald-300 pt-1">
                      {feedback.complementaryQuestion.answer} ({feedback.complementaryQuestion.reference})
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm cursor-pointer"
                >
                  Siguiente enseñanza →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
