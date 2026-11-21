import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Library,
  MonitorPlay,
  Music,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ADVENTURE_AMBIENT_LABELS,
  BUILTIN_ADVENTURE_STORIES,
  type AdventureAmbientStyle,
  type AdventurePlayMode,
  type AdventureProgressRecord,
  type AdventureScene,
  type AdventureStory,
} from '../shared/adventureStoriesData';
import { COMPETITION_TEAM_PRESETS } from '../shared/types';
import { soundFX, type DidacticAmbientMode } from '../utils/sound';

interface AventurasBiblicasViewProps {
  onBack: () => void;
  onCreatedMultiplayerRoom: (code: string, presenterToken: string) => void;
  onJoinCode: (code: string) => void;
}

type ViewTab = 'explorar' | 'individual' | 'crear';
type TestamentFilter = 'Todos' | 'Antiguo Testamento' | 'Nuevo Testamento';

interface SoloChoiceOutcome {
  optionId: string;
  label: string;
  isBiblicallyFaithful: boolean;
  consequenceText: string;
  biblicalExplanation: string;
}

const LOCAL_SOLO_PROGRESS_KEY = 'dtqd_adventure_solo_progress_v1';

function toDidacticMode(style: AdventureAmbientStyle): DidacticAmbientMode {
  return `adventure_${style}` as DidacticAmbientMode;
}

export function AventurasBiblicasView({
  onBack,
  onCreatedMultiplayerRoom,
  onJoinCode,
}: AventurasBiblicasViewProps) {
  const [tab, setTab] = useState<ViewTab>('explorar');
  const [stories, setStories] = useState<AdventureStory[]>(
    BUILTIN_ADVENTURE_STORIES
  );
  const [progressList, setProgressList] = useState<AdventureProgressRecord[]>(
    []
  );
  const [testamentFilter, setTestamentFilter] =
    useState<TestamentFilter>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Selected story detail & launcher modal/drawer state
  const [selectedStory, setSelectedStory] = useState<AdventureStory>(
    BUILTIN_ADVENTURE_STORIES[0]
  );

  // Multiplayer launcher config
  const [launchMode, setLaunchMode] = useState<
    'competitive_players' | 'competitive_teams' | 'conductor_led'
  >('conductor_led');
  const [teamCount, setTeamCount] = useState(2);
  const [teamCapacity, setTeamCapacity] = useState(12);
  const [teamNames, setTeamNames] = useState<string[]>(() =>
    COMPETITION_TEAM_PRESETS.slice(0, 6).map((t) => t.name)
  );
  const [teamColors, setTeamColors] = useState<string[]>(() =>
    COMPETITION_TEAM_PRESETS.slice(0, 6).map((t) => t.color)
  );
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Audio controls synced with soundFX
  const [audioSnap, setAudioSnap] = useState(() => soundFX.getSnapshot());
  const [previewAmbient, setPreviewAmbient] = useState<boolean>(false);

  // Solo Mode interactive state
  const [soloStory, setSoloStory] = useState<AdventureStory>(
    BUILTIN_ADVENTURE_STORIES[0]
  );
  const [soloStep, setSoloStep] = useState<'intro' | 'scene' | 'reflection'>(
    'intro'
  );
  const [soloSceneIdx, setSoloSceneIdx] = useState(0);
  const [soloChoices, setSoloChoices] = useState<
    Record<string, SoloChoiceOutcome>
  >({});

  // Custom story deletion confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Custom story creation form state
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newTestament, setNewTestament] = useState<
    'Antiguo Testamento' | 'Nuevo Testamento'
  >('Antiguo Testamento');
  const [newReference, setNewReference] = useState('');
  const [newAmbientStyle, setNewAmbientStyle] =
    useState<AdventureAmbientStyle>('pastoral');
  const [newIntro, setNewIntro] = useState('');
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterRole, setNewCharacterRole] = useState('');
  const [newReflection, setNewReflection] = useState('');
  const [newScenes, setNewScenes] = useState<
    Array<{
      title: string;
      settingLabel: string;
      narrativeAdaptation: string;
      sceneReference: string;
      interactionType: 'decision' | 'question';
      prompt: string;
      optALabel: string;
      optAConsequence: string;
      optAExplanation: string;
      optBLabel: string;
      optBConsequence: string;
      optBExplanation: string;
      faithfulOption: 'A' | 'B';
    }>
  >([
    {
      title: 'Escena 1: El llamado y la decisión',
      settingLabel: 'Inicio del relato',
      narrativeAdaptation: '',
      sceneReference: '',
      interactionType: 'decision',
      prompt: '',
      optALabel: '',
      optAConsequence: '',
      optAExplanation: '',
      optBLabel: '',
      optBConsequence: '',
      optBExplanation: '',
      faithfulOption: 'A',
    },
  ]);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customMessage, setCustomMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    const unsub = soundFX.subscribe((s) => setAudioSnap(s));
    return unsub;
  }, []);

  // Load stories and saved progress from server + local cache
  useEffect(() => {
    let active = true;
    fetch('/api/adventures/stories')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.stories) && data.stories.length > 0) {
          setStories(data.stories);
        }
        if (Array.isArray(data.progress)) {
          setProgressList(data.progress);
        }
      })
      .catch(() => {
        // Fallback already has BUILTIN_ADVENTURE_STORIES
      });
    return () => {
      active = false;
    };
  }, []);

  // Ambient music activation for Solo Mode or manual preview
  useEffect(() => {
    if (tab === 'individual') {
      soundFX.setWelcomeMusicActive(false);
      soundFX.setDidacticAmbient(toDidacticMode(soloStory.ambientStyle));
    } else if (previewAmbient) {
      soundFX.setWelcomeMusicActive(false);
      soundFX.setDidacticAmbient(toDidacticMode(selectedStory.ambientStyle));
    } else {
      soundFX.setDidacticAmbient(null);
      soundFX.setWelcomeMusicActive(true);
    }
    return () => {
      soundFX.setDidacticAmbient(null);
    };
  }, [tab, soloStory.ambientStyle, previewAmbient, selectedStory.ambientStyle]);

  const filteredStories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stories.filter((s) => {
      if (testamentFilter !== 'Todos' && s.testament !== testamentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q) ||
        s.mainReference.toLowerCase().includes(q) ||
        s.characters.some((c) => c.name.toLowerCase().includes(q))
      );
    });
  }, [stories, testamentFilter, searchQuery]);

  const progressByStory = useMemo(() => {
    const map: Record<string, AdventureProgressRecord> = {};
    for (const p of progressList) {
      if (!map[p.storyId] || p.updatedAt > map[p.storyId].updatedAt) {
        map[p.storyId] = p;
      }
    }
    return map;
  }, [progressList]);

  const persistSoloProgress = (
    story: AdventureStory,
    sceneIndex: number,
    completed: boolean,
    choicesMap: Record<string, SoloChoiceOutcome>
  ) => {
    const entries = Object.values(choicesMap);
    const faithfulCount = entries.filter((e) => e.isBiblicallyFaithful).length;
    const score = entries.reduce(
      (sum, e) => sum + (e.isBiblicallyFaithful ? 500 : 150),
      0
    );

    const payload = {
      storyId: story.id,
      mode: 'individual' as AdventurePlayMode,
      currentSceneIndex: sceneIndex,
      completed,
      faithfulChoicesCount: faithfulCount,
      totalAnsweredCount: entries.length,
      score,
    };

    try {
      const existing = JSON.parse(
        localStorage.getItem(LOCAL_SOLO_PROGRESS_KEY) || '{}'
      ) as Record<string, unknown>;
      existing[story.id] = {
        ...payload,
        choicesMap,
        updatedAt: Date.now(),
      };
      localStorage.setItem(LOCAL_SOLO_PROGRESS_KEY, JSON.stringify(existing));
    } catch {
      // ignore storage quota
    }

    fetch('/api/adventures/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.list)) {
          setProgressList(data.list);
        }
      })
      .catch(() => {});
  };

  const startIndividualStory = (story: AdventureStory, resume = false) => {
    setSoloStory(story);
    setSelectedStory(story);

    if (resume) {
      try {
        const raw = localStorage.getItem(LOCAL_SOLO_PROGRESS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<
            string,
            {
              currentSceneIndex?: number;
              completed?: boolean;
              choicesMap?: Record<string, SoloChoiceOutcome>;
            }
          >;
          const saved = parsed[story.id];
          if (saved && typeof saved.currentSceneIndex === 'number') {
            setSoloChoices(saved.choicesMap || {});
            setSoloSceneIdx(
              Math.max(
                0,
                Math.min(story.scenes.length - 1, saved.currentSceneIndex)
              )
            );
            setSoloStep(saved.completed ? 'reflection' : 'scene');
            setTab('individual');
            soundFX.playAdventureSceneTransition();
            return;
          }
        }
      } catch {
        // start fresh
      }
      const serverProg = progressByStory[story.id];
      if (serverProg && serverProg.mode === 'individual') {
        setSoloChoices({});
        setSoloSceneIdx(
          Math.max(
            0,
            Math.min(story.scenes.length - 1, serverProg.currentSceneIndex)
          )
        );
        setSoloStep(serverProg.completed ? 'reflection' : 'scene');
        setTab('individual');
        soundFX.playAdventureSceneTransition();
        return;
      }
    }

    setSoloChoices({});
    setSoloSceneIdx(0);
    setSoloStep('intro');
    setTab('individual');
    soundFX.playAdventureSceneTransition();
  };

  const handleSoloSelectOption = (
    scene: AdventureScene,
    opt: AdventureScene['options'][number]
  ) => {
    if (soloChoices[scene.id]) return;
    const outcome: SoloChoiceOutcome = {
      optionId: opt.id,
      label: opt.label,
      isBiblicallyFaithful: opt.isBiblicallyFaithful,
      consequenceText: opt.consequenceText,
      biblicalExplanation: opt.biblicalExplanation,
    };
    const nextChoices = { ...soloChoices, [scene.id]: outcome };
    setSoloChoices(nextChoices);

    if (opt.isBiblicallyFaithful) {
      soundFX.playAdventureFaithfulOutcome();
    } else {
      soundFX.playStudyNote();
    }

    persistSoloProgress(soloStory, soloSceneIdx, false, nextChoices);
  };

  const handleSoloNext = () => {
    if (soloSceneIdx + 1 < soloStory.scenes.length) {
      const nextIdx = soloSceneIdx + 1;
      setSoloSceneIdx(nextIdx);
      soundFX.playAdventureSceneTransition();
      persistSoloProgress(soloStory, nextIdx, false, soloChoices);
    } else {
      setSoloStep('reflection');
      soundFX.playAdventureReflectionEnd();
      persistSoloProgress(
        soloStory,
        soloStory.scenes.length - 1,
        true,
        soloChoices
      );
    }
  };

  const handleCreateMultiplayerRoom = async () => {
    setRoomError(null);
    setCreatingRoom(true);
    try {
      const isTeams = launchMode === 'competitive_teams';
      const body: Record<string, unknown> = {
        mode: 'aventuras_biblicas',
        title: `Aventura: ${selectedStory.title}`,
        maxParticipants: isTeams ? teamCount * teamCapacity : 120,
        timeLimitSec: 45,
        adventureConfig: {
          storyId: selectedStory.id,
          playMode: launchMode,
        },
        ...(isTeams
          ? {
              teamMode: true,
              teamCount,
              teamCapacity,
              teamNames: teamNames.slice(0, teamCount),
              teamColors: teamColors.slice(0, teamCount),
            }
          : {}),
      };

      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoomError(data.error || 'No se pudo crear la sala de aventura.');
        setCreatingRoom(false);
        return;
      }
      onCreatedMultiplayerRoom(data.code, data.presenterToken);
    } catch {
      setRoomError('Error de conexión al crear la sala.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleDeleteCustomStory = async (id: string) => {
    try {
      const res = await fetch(`/api/adventures/stories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setStories((prev) => prev.filter((s) => s.id !== id));
        if (selectedStory.id === id) {
          setSelectedStory(BUILTIN_ADVENTURE_STORIES[0]);
        }
        setConfirmDeleteId(null);
      }
    } catch {
      // ignore
    }
  };

  const handleSaveCustomStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomMessage(null);
    setSavingCustom(true);

    try {
      const payload = {
        title: newTitle.trim(),
        subtitle: newSubtitle.trim() || 'Historia bíblica interactiva',
        testament: newTestament,
        mainReference: newReference.trim(),
        ambientStyle: newAmbientStyle,
        introductionNarrative: newIntro.trim(),
        finalReflection: newReflection.trim(),
        scripturalAnchor: newReference.trim(),
        characters: newCharacterName.trim()
          ? [
              {
                name: newCharacterName.trim(),
                role: newCharacterRole.trim() || 'Personaje principal',
              },
            ]
          : [],
        scenes: newScenes.map((s) => ({
          title: s.title.trim(),
          settingLabel: s.settingLabel.trim(),
          narrativeAdaptation: s.narrativeAdaptation.trim(),
          sceneReference: s.sceneReference.trim() || newReference.trim(),
          interactionType: s.interactionType,
          prompt: s.prompt.trim(),
          options: [
            {
              label: s.optALabel.trim(),
              isBiblicallyFaithful: s.faithfulOption === 'A',
              consequenceText: s.optAConsequence.trim(),
              biblicalExplanation: s.optAExplanation.trim(),
            },
            {
              label: s.optBLabel.trim(),
              isBiblicallyFaithful: s.faithfulOption === 'B',
              consequenceText: s.optBConsequence.trim(),
              biblicalExplanation: s.optBExplanation.trim(),
            },
          ],
        })),
      };

      const res = await fetch('/api/adventures/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setCustomMessage({
          type: 'err',
          text: data.error || 'No se pudo guardar la historia.',
        });
        setSavingCustom(false);
        return;
      }

      if (data.story) {
        setStories((prev) => [...prev, data.story]);
        setSelectedStory(data.story);
        setCustomMessage({
          type: 'ok',
          text: `Historia "${data.story.title}" agregada al catálogo.`,
        });
        setNewTitle('');
        setNewSubtitle('');
        setNewReference('');
        setNewIntro('');
        setNewReflection('');
        setNewCharacterName('');
        setNewCharacterRole('');
      }
    } catch {
      setCustomMessage({
        type: 'err',
        text: 'Error de red al guardar la historia personalizada.',
      });
    } finally {
      setSavingCustom(false);
    }
  };

  const currentSoloScene = soloStory.scenes[soloSceneIdx];
  const currentSoloOutcome = currentSoloScene
    ? soloChoices[currentSoloScene.id]
    : undefined;
  const soloFaithfulTotal = Object.values(soloChoices).filter(
    (c) => c.isBiblicallyFaithful
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header & Return Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white text-balance">
            AVENTURAS BÍBLICAS
          </h1>
          <p className="text-sm text-slate-400">
            Historias interactivas por escenas con decisiones, consecuencias
            narrativas, referencia bíblica explícita y música ambiental.
          </p>
        </div>

        {/* Navigation Tabs & Quick Room Join */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('explorar')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              tab === 'explorar'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#111A2E] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Library className="w-4 h-4" />
            Catálogo ({stories.length})
          </button>

          <button
            type="button"
            onClick={() => setTab('individual')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              tab === 'individual'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-[#111A2E] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            Modo Individual
          </button>

          <button
            type="button"
            onClick={() => setTab('crear')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              tab === 'crear'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#111A2E] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            Agregar Historia
          </button>
        </div>
      </div>

      {/* Inline Ambient Soundscape & Volume Control Strip */}
      <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              const nextEnabled = !audioSnap.prefs.didacticAmbientEnabled;
              soundFX.updatePrefs({ didacticAmbientEnabled: nextEnabled });
              if (tab !== 'individual') {
                setPreviewAmbient(nextEnabled);
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
              audioSnap.prefs.didacticAmbientEnabled &&
              (tab === 'individual' || previewAmbient)
                ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {audioSnap.prefs.didacticAmbientEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-400" />
            )}
            {tab === 'individual'
              ? `Ambiente activo: ${ADVENTURE_AMBIENT_LABELS[soloStory.ambientStyle].name}`
              : previewAmbient
                ? `Escuchando: ${ADVENTURE_AMBIENT_LABELS[selectedStory.ambientStyle].name}`
                : `Probar música: ${ADVENTURE_AMBIENT_LABELS[selectedStory.ambientStyle].name}`}
          </button>
          <span className="text-xs text-slate-400 hidden sm:inline truncate">
            Música instrumental adaptada a cada relato bíblico
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2.5 text-xs text-slate-300">
            <Music className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="whitespace-nowrap">
              Volumen ambiente:{' '}
              <strong className="font-mono-num text-white">
                {Math.round(audioSnap.prefs.didacticVolume * 100)}%
              </strong>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioSnap.prefs.didacticVolume * 100)}
              onChange={(e) =>
                soundFX.updatePrefs({
                  didacticAmbientEnabled: true,
                  didacticVolume: Number(e.target.value) / 100,
                })
              }
              className="w-24 accent-amber-400 cursor-pointer"
            />
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-300">
            <span className="whitespace-nowrap">
              Volumen general:{' '}
              <strong className="font-mono-num text-white">
                {Math.round(audioSnap.prefs.masterVolume * 100)}%
              </strong>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioSnap.prefs.masterVolume * 100)}
              onChange={(e) =>
                soundFX.updatePrefs({
                  masterVolume: Number(e.target.value) / 100,
                })
              }
              className="w-24 accent-sky-400 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* TAB 1: STORY CATALOG & MULTIPLAYER LAUNCHER */}
      {tab === 'explorar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Search, Filter & Story List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar historia, personaje o cita bíblica..."
                  className="w-full bg-[#111A2E] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-[#111A2E] border border-slate-800 rounded-xl p-1">
                {(
                  [
                    'Todos',
                    'Antiguo Testamento',
                    'Nuevo Testamento',
                  ] as TestamentFilter[]
                ).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTestamentFilter(tf)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      testamentFilter === tf
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {tf === 'Antiguo Testamento'
                      ? 'Antiguo Test.'
                      : tf === 'Nuevo Testamento'
                        ? 'Nuevo Test.'
                        : 'Todas'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredStories.map((story) => {
                const isSelected = selectedStory.id === story.id;
                const prog = progressByStory[story.id];
                return (
                  <div
                    key={story.id}
                    className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                      isSelected
                        ? 'bg-[#15223D] border-amber-400/70'
                        : 'bg-[#111A2E] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStory(story)}
                      className="w-full text-left space-y-2 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span className="text-amber-300 font-semibold">
                          {story.testament}
                        </span>
                        <span className="font-mono-num">
                          {story.scenes.length} escenas ·{' '}
                          {story.ambientLabel ||
                            ADVENTURE_AMBIENT_LABELS[story.ambientStyle].name}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-lg text-white leading-snug">
                        {story.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {story.subtitle}
                      </p>
                      <p className="text-xs font-medium text-sky-300">
                        Referencia: {story.mainReference}
                      </p>
                    </button>

                    {prog && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-300">
                        <span>
                          {prog.completed
                            ? 'Completada'
                            : `Progreso: escena ${prog.currentSceneIndex + 1}/${prog.totalScenes}`}
                        </span>
                        {prog.score > 0 && (
                          <span className="font-mono-num">
                            {prog.score} pts
                          </span>
                        )}
                      </div>
                    )}

                    {story.isCustom && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        {confirmDeleteId === story.id ? (
                          <div className="flex items-center gap-2 w-full justify-between">
                            <span className="text-[11px] text-rose-300">
                              ¿Eliminar esta historia?
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteCustomStory(story.id)
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-semibold cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(story.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar historia personalizada
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Join Existing Adventure by Code */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinCodeInput.trim()) {
                  onJoinCode(joinCodeInput.trim().toUpperCase());
                }
              }}
              className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">
                  ¿Te invitaron a una Aventura Bíblica en vivo?
                </p>
                <p className="text-xs text-slate-400">
                  Ingresa el código de sala o escanea el código QR del
                  conductor.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) =>
                    setJoinCodeInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    )
                  }
                  placeholder="Código"
                  className="w-32 bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono-num font-bold placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>

          {/* Right: Selected Story Briefing & 4-Mode Launcher */}
          <div className="lg:col-span-5 bg-[#111A2E] border border-slate-800 rounded-3xl p-6 space-y-5 lg:sticky lg:top-20">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="text-amber-300 font-semibold">
                  {selectedStory.testament}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedStory.mainReference}</span>
              </div>
              <h2 className="font-display text-2xl font-extrabold text-white text-balance">
                {selectedStory.title}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {selectedStory.introductionNarrative}
              </p>
            </div>

            {/* Characters List */}
            <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                Personajes principales
              </p>
              <div className="space-y-1.5">
                {selectedStory.characters.map((ch) => (
                  <p key={ch.name} className="text-xs text-slate-300">
                    <strong className="text-white">{ch.name}:</strong> {ch.role}
                  </p>
                ))}
              </div>
            </div>

            {/* Mode 1: Individual */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startIndividualStory(selectedStory, false)}
                className="w-full py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Play className="w-4 h-4 fill-current" />
                Jugar en Modo Individual ({selectedStory.scenes.length} escenas)
              </button>

              {progressByStory[selectedStory.id]?.mode === 'individual' &&
                !progressByStory[selectedStory.id]?.completed && (
                  <button
                    type="button"
                    onClick={() => startIndividualStory(selectedStory, true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-200 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Continuar desde escena{' '}
                    {progressByStory[selectedStory.id].currentSceneIndex + 1}
                  </button>
                )}
            </div>

            {/* Modes 2, 3, 4: Multiplayer Live Room Launcher */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Sala en Vivo con QR y Sincronización
                </p>
                <p className="text-xs text-slate-400">
                  Todos los dispositivos conectados verán cada escena,
                  participarán en las decisiones y escucharán los resultados en
                  tiempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    {
                      id: 'conductor_led',
                      title: 'Presentación dirigida por el conductor',
                      desc: 'Ideal para Sociedad de Jóvenes y proyección en pantalla grande.',
                      icon: MonitorPlay,
                    },
                    {
                      id: 'competitive_players',
                      title: 'Competencia entre jugadores',
                      desc: 'Cada participante compite por precisión bíblica y rapidez.',
                      icon: Users,
                    },
                    {
                      id: 'competitive_teams',
                      title: 'Competencia por equipos',
                      desc: 'Divide la sala en equipos configurables con marcador grupal.',
                      icon: Shield,
                    },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const active = launchMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLaunchMode(m.id)}
                      className={`text-left rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                        active
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-[#080E1E] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          active ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{m.title}</p>
                        <p className="text-[11px] text-slate-400">{m.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {launchMode === 'competitive_teams' && (
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="text-xs text-slate-300 space-y-1">
                      <span>Cantidad de equipos</span>
                      <select
                        value={teamCount}
                        onChange={(e) => setTeamCount(Number(e.target.value))}
                        className="w-full bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        {[2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n} equipos
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-slate-300 space-y-1">
                      <span>Cupo por equipo</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={teamCapacity}
                        onChange={(e) =>
                          setTeamCapacity(
                            Math.max(1, Math.min(50, Number(e.target.value) || 1))
                          )
                        }
                        className="w-full bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-num"
                      />
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    {Array.from({ length: teamCount }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={teamColors[idx] || '#F59E0B'}
                          onChange={(e) => {
                            const next = [...teamColors];
                            next[idx] = e.target.value;
                            setTeamColors(next);
                          }}
                          className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={teamNames[idx] || ''}
                          onChange={(e) => {
                            const next = [...teamNames];
                            next[idx] = e.target.value;
                            setTeamNames(next);
                          }}
                          placeholder={`Equipo ${idx + 1}`}
                          className="flex-1 bg-[#111A2E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {roomError && (
                <p className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/40 rounded-xl p-3">
                  {roomError}
                </p>
              )}

              <button
                type="button"
                disabled={creatingRoom}
                onClick={handleCreateMultiplayerRoom}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Users className="w-4 h-4" />
                {creatingRoom
                  ? 'Creando sala interactiva...'
                  : 'Crear Sala en Vivo con QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL INTERACTIVE STORY MODE */}
      {tab === 'individual' && (
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Story Selector Strip */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Compass className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-400">
                  Aventura Individual · {soloStory.mainReference}
                </p>
                <h2 className="font-display font-bold text-lg text-white truncate">
                  {soloStory.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={soloStory.id}
                onChange={(e) => {
                  const found = stories.find((s) => s.id === e.target.value);
                  if (found) startIndividualStory(found, false);
                }}
                className="bg-[#080E1E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => startIndividualStory(soloStory, false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reiniciar
              </button>
            </div>
          </div>

          {soloStep === 'intro' && (
            <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Introducción · {soloStory.testament}
                </p>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  {soloStory.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  {soloStory.introductionNarrative}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Personajes del relato
                  </p>
                  {soloStory.characters.map((ch) => (
                    <p key={ch.name} className="text-xs sm:text-sm text-slate-300">
                      <strong className="text-white">{ch.name}:</strong>{' '}
                      {ch.role}
                    </p>
                  ))}
                </div>

                <div className="bg-amber-500/10 border border-amber-400/35 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    Texto bíblico de referencia
                  </p>
                  <p className="font-display font-bold text-lg text-white">
                    {soloStory.mainReference}
                  </p>
                  <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                    {soloStory.scripturalAnchor}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSoloStep('scene');
                  setSoloSceneIdx(0);
                  soundFX.playAdventureDecisionPrompt();
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Comenzar Escena 1 de {soloStory.scenes.length}
              </button>
            </div>
          )}

          {soloStep === 'scene' && currentSoloScene && (
            <div className="space-y-5">
              {/* Progress Bar */}
              <div className="flex items-center gap-2">
                {soloStory.scenes.map((sc, i) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSoloSceneIdx(i)}
                    className={`h-2 flex-1 rounded-full cursor-pointer transition-colors ${
                      i === soloSceneIdx
                        ? 'bg-amber-400'
                        : soloChoices[sc.id]
                          ? 'bg-emerald-400'
                          : 'bg-slate-800'
                    }`}
                    title={sc.title}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-bold text-sky-300 uppercase tracking-wider">
                      Adaptación narrativa · Escena {soloSceneIdx + 1} de{' '}
                      {soloStory.scenes.length}
                    </span>
                    <span>{currentSoloScene.location}</span>
                  </div>
                  <h3 className="font-display text-2xl font-extrabold text-white">
                    {currentSoloScene.title}
                  </h3>
                  <p className="text-base text-slate-200 leading-relaxed">
                    {currentSoloScene.narrativeAdaptation}
                  </p>
                </div>

                <div className="md:col-span-4 bg-amber-500/10 border border-amber-400/35 rounded-2xl p-5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    Texto bíblico de referencia
                  </p>
                  <p className="font-display font-bold text-lg text-white">
                    {currentSoloScene.sceneReference}
                  </p>
                  <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                    {currentSoloScene.scriptureNote}
                  </p>
                </div>
              </div>

              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-6 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {currentSoloScene.interactionType === 'question'
                    ? 'Pregunta de la escena'
                    : 'Toma una decisión'}
                </p>
                <h4 className="font-display text-xl font-bold text-white">
                  {currentSoloScene.prompt}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentSoloScene.options.map((opt, idx) => {
                    const isPicked =
                      currentSoloOutcome?.optionId === opt.id;
                    const locked = Boolean(currentSoloOutcome);
                    let cls =
                      'bg-[#080E1E] border-slate-700 hover:border-amber-400 text-white cursor-pointer';
                    if (locked) {
                      if (opt.isBiblicallyFaithful) {
                        cls =
                          'bg-emerald-500/15 border-emerald-400/70 text-white';
                      } else if (isPicked) {
                        cls = 'bg-amber-500/15 border-amber-400/70 text-white';
                      } else {
                        cls =
                          'bg-[#080E1E]/70 border-slate-800 text-slate-400';
                      }
                    }

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          handleSoloSelectOption(currentSoloScene, opt)
                        }
                        className={`text-left rounded-2xl border p-4 space-y-2 transition-colors ${cls}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-300 font-mono-num text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="font-semibold text-sm sm:text-base">
                            {opt.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {currentSoloOutcome && (
                  <div
                    className={`rounded-2xl border p-5 space-y-3 ${
                      currentSoloOutcome.isBiblicallyFaithful
                        ? 'bg-emerald-500/10 border-emerald-400/60'
                        : 'bg-amber-500/10 border-amber-400/60'
                    }`}
                  >
                    <p className="text-sm font-bold text-white inline-flex items-center gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          currentSoloOutcome.isBiblicallyFaithful
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      />
                      {currentSoloOutcome.isBiblicallyFaithful
                        ? 'Elección fiel al relato bíblico'
                        : 'Consecuencia alternativa y contraste bíblico'}
                    </p>
                    <p className="text-sm text-slate-100 leading-relaxed">
                      <strong className="text-amber-300">
                        Consecuencia narrativa:
                      </strong>{' '}
                      {currentSoloOutcome.consequenceText}
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      <strong className="text-sky-300">
                        Explicación bíblica ({currentSoloScene.sceneReference}):
                      </strong>{' '}
                      {currentSoloOutcome.biblicalExplanation}
                    </p>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSoloNext}
                        className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer"
                      >
                        {soloSceneIdx + 1 < soloStory.scenes.length
                          ? 'Continuar a la siguiente escena'
                          : 'Ver Reflexión Final'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {soloStep === 'reflection' && (
            <div className="bg-[#111A2E] border border-amber-400/40 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    Aventura Completada
                  </p>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                    {soloStory.title}
                  </h3>
                </div>
                <div className="bg-[#080E1E] border border-slate-800 rounded-xl px-4 py-2 text-right">
                  <p className="text-[11px] text-slate-400">
                    Decisiones fieles
                  </p>
                  <p className="font-mono-num text-xl font-extrabold text-emerald-300">
                    {soloFaithfulTotal} / {soloStory.scenes.length}
                  </p>
                </div>
              </div>

              <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-5 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-300 inline-flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Reflexión final
                </p>
                <p className="text-base text-slate-100 leading-relaxed">
                  {soloStory.finalReflection}
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-400/40 rounded-2xl p-5 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300 inline-flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Texto bíblico de referencia: {soloStory.mainReference}
                </p>
                <p className="text-sm text-amber-100/90 leading-relaxed">
                  {soloStory.scripturalAnchor}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startIndividualStory(soloStory, false)}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Volver a recorrer esta historia
                </button>
                <button
                  type="button"
                  onClick={() => setTab('explorar')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm cursor-pointer"
                >
                  Explorar más historias
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXPANDABLE CUSTOM STORY CREATOR */}
      {tab === 'crear' && (
        <form
          onSubmit={handleSaveCustomStory}
          className="max-w-4xl mx-auto bg-[#111A2E] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6"
        >
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-extrabold text-white">
              Agregar Nueva Historia al Catálogo
            </h2>
            <p className="text-sm text-slate-400">
              Crea relatos bíblicos interactivos personalizados para tu Sociedad
              de Jóvenes. Separa claramente la adaptación narrativa de las citas
              bíblicas de referencia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs text-slate-300">
              <span>Título de la historia *</span>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Gedeón y los trescientos valientes"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </label>

            <label className="space-y-1.5 text-xs text-slate-300">
              <span>Texto bíblico de referencia *</span>
              <input
                type="text"
                required
                value={newReference}
                onChange={(e) => setNewReference(e.target.value)}
                placeholder="Ej. Jueces 7:1-22"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </label>

            <label className="space-y-1.5 text-xs text-slate-300">
              <span>Testamento</span>
              <select
                value={newTestament}
                onChange={(e) =>
                  setNewTestament(
                    e.target.value as 'Antiguo Testamento' | 'Nuevo Testamento'
                  )
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              >
                <option value="Antiguo Testamento">Antiguo Testamento</option>
                <option value="Nuevo Testamento">Nuevo Testamento</option>
              </select>
            </label>

            <label className="space-y-1.5 text-xs text-slate-300">
              <span>Paisaje musical ambiental</span>
              <select
                value={newAmbientStyle}
                onChange={(e) =>
                  setNewAmbientStyle(e.target.value as AdventureAmbientStyle)
                }
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              >
                {(
                  Object.keys(
                    ADVENTURE_AMBIENT_LABELS
                  ) as AdventureAmbientStyle[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {ADVENTURE_AMBIENT_LABELS[k].name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs text-slate-300 sm:col-span-2">
              <span>Subtítulo breve</span>
              <input
                type="text"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="Ej. Cuando Dios reduce fuerzas humanas para mostrar Su poder"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </label>

            <label className="space-y-1.5 text-xs text-slate-300 sm:col-span-2">
              <span>Introducción narrativa *</span>
              <textarea
                required
                rows={2}
                value={newIntro}
                onChange={(e) => setNewIntro(e.target.value)}
                placeholder="Contexto inicial de la historia..."
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </label>

            <label className="space-y-1.5 text-xs text-slate-300">
              <span>Personaje principal</span>
              <input
                type="text"
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                placeholder="Ej. Gedeón"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </label>

            <label className="space-y-1.5 text-xs text-slate-300">
              <span>Descripción del personaje</span>
              <input
                type="text"
                value={newCharacterRole}
                onChange={(e) => setNewCharacterRole(e.target.value)}
                placeholder="Ej. Juez llamado mientras trillaba trigo"
                className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </label>
          </div>

          {/* Scenes Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">
                Escenas Interactivas ({newScenes.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setNewScenes((prev) => [
                    ...prev,
                    {
                      title: `Escena ${prev.length + 1}`,
                      settingLabel: 'Desarrollo',
                      narrativeAdaptation: '',
                      sceneReference: newReference,
                      interactionType: 'decision',
                      prompt: '',
                      optALabel: '',
                      optAConsequence: '',
                      optAExplanation: '',
                      optBLabel: '',
                      optBConsequence: '',
                      optBExplanation: '',
                      faithfulOption: 'A',
                    },
                  ])
                }
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir escena
              </button>
            </div>

            {newScenes.map((sc, idx) => (
              <div
                key={idx}
                className="bg-[#080E1E] border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                    Escena {idx + 1}
                  </p>
                  {newScenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setNewScenes((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Quitar escena
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={sc.title}
                    onChange={(e) => {
                      const copy = [...newScenes];
                      copy[idx].title = e.target.value;
                      setNewScenes(copy);
                    }}
                    placeholder="Título de la escena"
                    className="bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    required
                    value={sc.sceneReference}
                    onChange={(e) => {
                      const copy = [...newScenes];
                      copy[idx].sceneReference = e.target.value;
                      setNewScenes(copy);
                    }}
                    placeholder="Cita bíblica de la escena (ej. Jueces 7:2-7)"
                    className="bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <textarea
                    required
                    rows={2}
                    value={sc.narrativeAdaptation}
                    onChange={(e) => {
                      const copy = [...newScenes];
                      copy[idx].narrativeAdaptation = e.target.value;
                      setNewScenes(copy);
                    }}
                    placeholder="Adaptación narrativa de la escena..."
                    className="sm:col-span-2 bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    required
                    value={sc.prompt}
                    onChange={(e) => {
                      const copy = [...newScenes];
                      copy[idx].prompt = e.target.value;
                      setNewScenes(copy);
                    }}
                    placeholder="Pregunta o decisión para los participantes *"
                    className="sm:col-span-2 bg-[#111A2E] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />

                  <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-300">Opción A</span>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={sc.faithfulOption === 'A'}
                          onChange={() => {
                            const copy = [...newScenes];
                            copy[idx].faithfulOption = 'A';
                            setNewScenes(copy);
                          }}
                        />
                        <span>Fiel al relato</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      required
                      value={sc.optALabel}
                      onChange={(e) => {
                        const copy = [...newScenes];
                        copy[idx].optALabel = e.target.value;
                        setNewScenes(copy);
                      }}
                      placeholder="Texto de la opción A"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={sc.optAConsequence}
                      onChange={(e) => {
                        const copy = [...newScenes];
                        copy[idx].optAConsequence = e.target.value;
                        setNewScenes(copy);
                      }}
                      placeholder="Consecuencia narrativa"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={sc.optAExplanation}
                      onChange={(e) => {
                        const copy = [...newScenes];
                        copy[idx].optAExplanation = e.target.value;
                        setNewScenes(copy);
                      }}
                      placeholder="Explicación bíblica"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div className="bg-[#111A2E] border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-sky-300">Opción B</span>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={sc.faithfulOption === 'B'}
                          onChange={() => {
                            const copy = [...newScenes];
                            copy[idx].faithfulOption = 'B';
                            setNewScenes(copy);
                          }}
                        />
                        <span>Fiel al relato</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      required
                      value={sc.optBLabel}
                      onChange={(e) => {
                        const copy = [...newScenes];
                        copy[idx].optBLabel = e.target.value;
                        setNewScenes(copy);
                      }}
                      placeholder="Texto de la opción B"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={sc.optBConsequence}
                      onChange={(e) => {
                        const copy = [...newScenes];
                        copy[idx].optBConsequence = e.target.value;
                        setNewScenes(copy);
                      }}
                      placeholder="Consecuencia narrativa"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={sc.optBExplanation}
                      onChange={(e) => {
                        const copy = [...newScenes];
                        copy[idx].optBExplanation = e.target.value;
                        setNewScenes(copy);
                      }}
                      placeholder="Explicación bíblica"
                      className="w-full bg-[#080E1E] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <label className="block space-y-1.5 text-xs text-slate-300">
            <span>Reflexión final espiritual</span>
            <textarea
              rows={2}
              value={newReflection}
              onChange={(e) => setNewReflection(e.target.value)}
              placeholder="Aplicación práctica para la vida cristiana hoy..."
              className="w-full bg-[#080E1E] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
            />
          </label>

          {customMessage && (
            <div
              className={`rounded-xl border p-3.5 text-sm ${
                customMessage.type === 'ok'
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                  : 'bg-rose-500/15 border-rose-400/50 text-rose-200'
              }`}
            >
              {customMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={savingCustom}
            className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {savingCustom
              ? 'Guardando historia...'
              : 'Guardar Historia en el Catálogo'}
          </button>
        </form>
      )}
    </div>
  );
}
