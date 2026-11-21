import { useCallback, useEffect, useRef, useState } from 'react';
import { GameRoomClientState, GameStatus } from '../shared/types';
import { soundFX } from '../utils/sound';

export type SocketConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'unavailable';

interface UseGameSocketOptions {
  code: string;
  role: 'presenter' | 'projector' | 'participant';
  token?: string;
  presenterToken?: string;
  enabled?: boolean;
}

export function useGameSocket({
  code,
  role,
  token,
  presenterToken,
  enabled = true,
}: UseGameSocketOptions) {
  const [state, setState] = useState<GameRoomClientState | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<SocketConnectionStatus>(() =>
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'offline'
        : 'connecting'
    );
  const [error, setError] = useState<string | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  const prevStatusRef = useRef<GameStatus | null>(null);
  const playedStartIdsRef = useRef<Set<string>>(new Set());
  const playedTimeUpIdsRef = useRef<Set<string>>(new Set());
  const lastSpinNonceRef = useRef<number | null>(null);
  const lastSatRouletteNonceRef = useRef<number | null>(null);
  const satStopTimerRef = useRef<number | null>(null);
  const lastMysteryKeyRef = useRef<string | null>(null);
  const lastTalentKeyRef = useRef<string | null>(null);
  const lastAdventureKeyRef = useRef<string | null>(null);
  const kickedRef = useRef(false);
  const hasSubscribedOnceRef = useRef(false);
  const unavailableRef = useRef(false);
  const failedAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (
      !enabled ||
      !code ||
      unmountedRef.current ||
      kickedRef.current ||
      unavailableRef.current
    ) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setConnected(false);
      setConnectionStatus('offline');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    setConnected(false);
    setConnectionStatus(
      hasSubscribedOnceRef.current ? 'reconnecting' : 'connecting'
    );

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      failedAttemptsRef.current = 0;
      setError(null);
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          code: code.toUpperCase(),
          role,
          token: token || '',
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') {
          const payload = msg.payload as GameRoomClientState;
          hasSubscribedOnceRef.current = true;
          unavailableRef.current = false;
          failedAttemptsRef.current = 0;
          if (ws.readyState === WebSocket.OPEN) {
            setConnected(true);
            setConnectionStatus('connected');
          }
          setError(null);

          const prevStatus = prevStatusRef.current;
          const roundId =
            payload.roundEventId ||
            (payload.currentQuestionIndex >= 0
              ? `${payload.gameId}:q${payload.currentQuestionIndex}`
              : '');

          if (roundId) {
            if (
              payload.status === 'question_active' &&
              !playedStartIdsRef.current.has(roundId)
            ) {
              const isFreshTransition =
                prevStatus !== null &&
                prevStatus !== 'question_active' &&
                prevStatus !== 'paused';
              const isJustStartedOnJoin =
                prevStatus === null &&
                typeof payload.questionStartedAt === 'number' &&
                payload.serverNow - payload.questionStartedAt <= 3500;

              playedStartIdsRef.current.add(roundId);
              if (isFreshTransition || isJustStartedOnJoin) {
                soundFX.playQuestionStart();
              }
            }

            if (
              payload.status === 'question_locked' &&
              payload.questionLockReason === 'timeout' &&
              !playedTimeUpIdsRef.current.has(roundId)
            ) {
              const transitionedFromActive = prevStatus === 'question_active';
              const justTimedOutOnJoin =
                prevStatus === null &&
                typeof payload.questionEndsAt === 'number' &&
                payload.serverNow - payload.questionEndsAt <= 3500;

              playedTimeUpIdsRef.current.add(roundId);
              if (transitionedFromActive || justTimedOutOnJoin) {
                soundFX.playTimeUp();
              }
            }
          }

          if (payload.rouletteState) {
            const nonce = payload.rouletteState.spinNonce;
            if (lastSpinNonceRef.current !== null && nonce > lastSpinNonceRef.current) {
              soundFX.playWheelSpin(2600);
            }
            lastSpinNonceRef.current = nonce;
          }

          if (payload.saturdayRouletteState) {
            const nonce = payload.saturdayRouletteState.spinNonce;
            if (
              lastSatRouletteNonceRef.current !== null &&
              nonce > lastSatRouletteNonceRef.current
            ) {
              soundFX.playWheelSpin(3400);
              if (satStopTimerRef.current) {
                window.clearTimeout(satStopTimerRef.current);
              }
              satStopTimerRef.current = window.setTimeout(() => {
                soundFX.playWheelStop();
                soundFX.playCategorySelect();
              }, 3450);
            }
            lastSatRouletteNonceRef.current = nonce;
          }

          if (payload.mysteryState) {
            const mKey = `${payload.mysteryState.currentItemIndex}:${payload.mysteryState.revealedClueCount}`;
            if (lastMysteryKeyRef.current !== null) {
              const [prevItemStr, prevClueStr] = lastMysteryKeyRef.current.split(':');
              if (
                Number(prevItemStr) === payload.mysteryState.currentItemIndex &&
                payload.mysteryState.revealedClueCount > Number(prevClueStr)
              ) {
                soundFX.playClueReveal();
              }
            }
            lastMysteryKeyRef.current = mKey;
          }

          if (payload.talentRoomState) {
            const tr = payload.talentRoomState;
            const tKey = `${tr.openingNonce}:${tr.currentScreen}:${tr.activeEntryId || ''}`;
            if (lastTalentKeyRef.current !== null && lastTalentKeyRef.current !== tKey) {
              const [prevNonceStr, prevScreen] = lastTalentKeyRef.current.split(':');
              if (Number(prevNonceStr) !== tr.openingNonce) {
                if (tr.currentScreen === 'recognition') {
                  soundFX.playTalentCertificateAward();
                  soundFX.playTalentApplauseChime();
                } else {
                  soundFX.playTalentCurtainOpen();
                }
              } else if (prevScreen !== tr.currentScreen) {
                if (tr.currentScreen === 'recognition') {
                  soundFX.playTalentCertificateAward();
                  soundFX.playTalentApplauseChime();
                } else {
                  soundFX.playTalentSpotlightTransition();
                }
              }
            }
            lastTalentKeyRef.current = tKey;
          }

          if (payload.adventureState) {
            const adv = payload.adventureState;
            const aKey = `${adv.sceneTransitionNonce}:${adv.phase}:${adv.currentSceneIndex}`;
            if (lastAdventureKeyRef.current !== null && lastAdventureKeyRef.current !== aKey) {
              const [, prevPhase, prevIdx] = lastAdventureKeyRef.current.split(':');
              if (Number(prevIdx) !== adv.currentSceneIndex && adv.phase === 'narration') {
                soundFX.playAdventureSceneTransition();
              } else if (prevPhase !== adv.phase) {
                if (adv.phase === 'decision_open') {
                  soundFX.playAdventureDecisionPrompt();
                } else if (adv.phase === 'consequence_reveal') {
                  soundFX.playAdventureFaithfulOutcome();
                } else if (adv.phase === 'reflection') {
                  soundFX.playAdventureReflectionEnd();
                } else if (adv.phase === 'narration') {
                  soundFX.playAdventureSceneTransition();
                }
              }
            }
            lastAdventureKeyRef.current = aKey;
          }

          prevStatusRef.current = payload.status;
          setState(payload);
          if (payload.serverNow) {
            setClockOffsetMs(payload.serverNow - Date.now());
          }
        } else if (msg.type === 'error') {
          const errMessage = String(msg.message || 'Error de conexión.');
          const isUnavailable =
            msg.code === 'ROOM_NOT_FOUND' ||
            msg.code === 'INVALID_PRESENTER_TOKEN' ||
            (!hasSubscribedOnceRef.current &&
              /no se encontró|no existe|no válida/i.test(errMessage));

          setError(errMessage);
          if (isUnavailable) {
            unavailableRef.current = true;
            setConnected(false);
            setConnectionStatus('unavailable');
          }
        } else if (msg.type === 'kicked') {
          kickedRef.current = true;
          setConnected(false);
          setConnectionStatus('unavailable');
          setKickedMessage(
            msg.message || 'Has sido retirado de esta partida.'
          );
          ws.close();
        }
      } catch {
        // Ignore malformed packets
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (
        unmountedRef.current ||
        kickedRef.current ||
        unavailableRef.current
      ) {
        return;
      }
      failedAttemptsRef.current += 1;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setConnectionStatus('offline');
      } else if (hasSubscribedOnceRef.current) {
        setConnectionStatus('reconnecting');
      } else if (failedAttemptsRef.current >= 2) {
        setConnectionStatus('offline');
      } else {
        setConnectionStatus('connecting');
      }

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 1800);
    };

    ws.onerror = () => {
      setConnected(false);
    };
  }, [code, role, token, enabled]);

  const reconnectNow = useCallback(() => {
    unavailableRef.current = false;
    failedAttemptsRef.current = 0;
    setError(null);
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    connect();
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;
    kickedRef.current = false;
    unavailableRef.current = false;
    hasSubscribedOnceRef.current = false;
    failedAttemptsRef.current = 0;
    prevStatusRef.current = null;
    lastSpinNonceRef.current = null;
    lastSatRouletteNonceRef.current = null;
    lastMysteryKeyRef.current = null;
    lastTalentKeyRef.current = null;
    lastAdventureKeyRef.current = null;
    setState(null);
    setConnected(false);
    setKickedMessage(null);
    setError(null);

    if (!enabled || !code) {
      setConnectionStatus(code ? 'connecting' : 'unavailable');
      return;
    }

    connect();

    const handleOnline = () => {
      if (!unmountedRef.current && !kickedRef.current && !unavailableRef.current) {
        setConnectionStatus(
          hasSubscribedOnceRef.current ? 'reconnecting' : 'connecting'
        );
        connect();
      }
    };
    const handleOffline = () => {
      setConnected(false);
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unmountedRef.current = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (satStopTimerRef.current) {
        window.clearTimeout(satStopTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, code, enabled]);

  const sendPresenterAction = useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'presenter_action',
            code: code.toUpperCase(),
            token: presenterToken || token || '',
            action,
            ...(extra || {}),
          })
        );
      }
    },
    [code, token, presenterToken]
  );

  const sendParticipantAction = useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'participant_action',
            code: code.toUpperCase(),
            token: token || '',
            action,
            ...(extra || {}),
          })
        );
      }
    },
    [code, token]
  );

  const submitAnswer = useCallback(
    (questionIndex: number, selectedIndex: number) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_answer',
            code: code.toUpperCase(),
            token: token || '',
            questionIndex,
            selectedIndex,
          })
        );
      }
    },
    [code, token]
  );

  const submitMysteryGuess = useCallback(
    (payload: { selectedIndex?: number; typedAnswer?: string }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_mystery_guess',
            code: code.toUpperCase(),
            token: token || '',
            ...payload,
          })
        );
      }
    },
    [code, token]
  );

  const submitRetoAttempt = useCallback(
    (payload: Record<string, unknown>) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_reto_attempt',
            code: code.toUpperCase(),
            token: token || '',
            ...payload,
          })
        );
      }
    },
    [code, token]
  );

  const submitSaturdayChallenge = useCallback(
    (payload: {
      selectedIndex?: number;
      submittedText?: string;
      completedSignal?: boolean;
    }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_saturday_challenge',
            code: code.toUpperCase(),
            token: token || '',
            ...payload,
          })
        );
      }
    },
    [code, token]
  );

  const submitSaturdayRoulette = useCallback(
    (payload: {
      selectedIndex?: number;
      submittedText?: string;
      completedSignal?: boolean;
    }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_saturday_roulette',
            code: code.toUpperCase(),
            token: token || '',
            ...payload,
          })
        );
      }
    },
    [code, token]
  );

  const submitTalentVote = useCallback(
    (payload: {
      entryId: string;
      reactionId: string;
      curatedMessage?: string;
    }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_talent_vote',
            code: code.toUpperCase(),
            token: token || '',
            ...payload,
          })
        );
      }
    },
    [code, token]
  );

  const submitAdventureChoice = useCallback(
    (payload: { sceneId: string; optionId: string }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_adventure_choice',
            code: code.toUpperCase(),
            token: token || '',
            ...payload,
          })
        );
      }
    },
    [code, token]
  );

  return {
    state,
    connected,
    connectionStatus,
    reconnectNow,
    error,
    kickedMessage,
    clockOffsetMs,
    sendPresenterAction,
    sendParticipantAction,
    submitAnswer,
    submitMysteryGuess,
    submitRetoAttempt,
    submitSaturdayChallenge,
    submitSaturdayRoulette,
    submitTalentVote,
    submitAdventureChoice,
  };
}
