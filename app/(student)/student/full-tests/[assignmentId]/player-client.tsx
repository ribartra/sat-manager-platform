"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MathContent } from "@/components/math-content";
import { OptionContent } from "@/components/option-content";
import { MathToolPanel } from "@/components/math-tool-panel";
import { QuestionMedia } from "@/components/question-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, cn } from "@/lib/utils";
import type { CalculatorConfig } from "@/lib/calculator-config";
import type { GraphArtifact } from "@/lib/question-graph";
import type { FullTestProgressState, FullTestTimerPhase } from "@/lib/full-test-progress";
import { questionResponseLabel, resolveQuestionType, isAnswerOption } from "@/lib/question-type";
import { LoadingState, OfflineBanner, SaveIndicator, type SaveStatus } from "@/components/sat";
import { exitPlayerOnAuthLoss, isAuthFailureStatus } from "@/lib/player-session-exit";
import { fetchWithTransientRetry } from "@/lib/transient-fetch";
import { readApiError } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { clearBuffer, readBuffer, sendKeepalive, useOnlineStatus, usePageHideFlush, useSaveQueue, writeBuffer } from "@/lib/player-persistence";
import { ChevronLeft, Flag, List } from "lucide-react";
import { Alert } from "@/components/sat/alert";
import { KeyboardShortcutsHint, PlayerShortcuts } from "@/components/sat/keyboard-shortcuts-hint";

interface ModuleQuestion {
  id: string;
  stem: string;
  stimulus: string | null;
  type: string;
  imageUrl?: string | null;
  options: { label: string; text: string; imageUrl?: string | null }[];
  graphArtifacts: GraphArtifact[];
}
interface TestModule {
  id: string;
  name: string;
  section: string;
  timeLimit: number;
  questions: ModuleQuestion[];
}

const RW_M2_INDEX = 1;
/** Debounce for typed input (numeric answers, notes); clicks save immediately. */
const TYPING_SAVE_DELAY_MS = 800;
/** Choice clicks, Mark/eliminate and navigation: short enough to feel instant, long enough to batch. */
const INTERACTION_SAVE_DELAY_MS = 600;

interface FullTestAutosavePayload {
  answers: Record<string, string>;
  currentModule: number;
  currentQuestion: number;
  timeExpiredEvents: number;
  extraTimeUsed: number;
  moduleTimerState: FullTestProgressState;
  timeSpentByQuestion: Record<string, number>;
  markedQuestionIds: string[];
  notes: Record<string, string>;
  eliminatedOptions: Record<string, string[]>;
}

function toLabelSets(value: Record<string, string[]>) {
  return Object.fromEntries(Object.entries(value).map(([id, labels]) => [id, new Set(labels)]));
}

function fromLabelSets(value: Record<string, Set<string>>) {
  return Object.fromEntries(Object.entries(value).map(([id, labels]) => [id, Array.from(labels)]));
}

export function FullTestPlayer({
  attemptId,
  testName,
  modules,
  breakMinutes,
  savedAnswers,
  savedTimeSpent,
  savedMarked = [],
  savedNotes = {},
  savedEliminated = {},
  savedModule,
  savedQuestion,
  savedExpiredEvents,
  savedExtraTimeUsed,
  savedProgressState,
  calculatorConfig,
  showCalculator = false,
  previewMode = false,
  exitHref = "/student/content-map?area=mocks",
  resultQuery,
}: {
  attemptId: string;
  assignmentId: string;
  testName: string;
  modules: TestModule[];
  breakMinutes: number;
  savedAnswers: Record<string, string>;
  savedTimeSpent: Record<string, number>;
  savedMarked?: string[];
  savedNotes?: Record<string, string>;
  savedEliminated?: Record<string, string[]>;
  savedModule: number;
  savedQuestion: number;
  savedExpiredEvents: number;
  savedExtraTimeUsed: number;
  savedProgressState: FullTestProgressState | null;
  calculatorConfig: CalculatorConfig;
  /** Admin CALCULATOR_FULL_TESTS ∩ Math — passed from server. */
  showCalculator?: boolean;
  previewMode?: boolean;
  exitHref?: string;
  resultQuery?: string;
}) {
  const router = useRouter();
  const breakSecondsTotal = Math.max(0, breakMinutes) * 60;
  const restoringUsableBreak = savedProgressState?.phase === "BREAK" && breakSecondsTotal > 0;
  const initialModuleIndex = savedProgressState?.phase === "BREAK" && breakSecondsTotal === 0
    ? RW_M2_INDEX + 1
    : savedModule;
  const initialQuestionIndex = savedProgressState?.phase === "BREAK" && breakSecondsTotal === 0 ? 0 : savedQuestion;
  const initialTimers =
    savedProgressState?.timers?.length === modules.length
      ? savedProgressState.timers
      : modules.map((module) => module.timeLimit);
  const initialOvertime =
    savedProgressState?.overtime?.length === modules.length
      ? savedProgressState.overtime
      : modules.map(() => 0);
  const [phase, setPhase] = useState<FullTestTimerPhase>(restoringUsableBreak ? "BREAK" : "MODULE");
  const [breakRemaining, setBreakRemaining] = useState(
    restoringUsableBreak ? savedProgressState.breakRemaining : breakSecondsTotal,
  );
  const [moduleIndex, setModuleIndex] = useState(initialModuleIndex);
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex);
  const [remaining, setRemaining] = useState(initialTimers[initialModuleIndex] ?? modules[0]?.timeLimit ?? 0);
  const [expiredEvents, setExpiredEvents] = useState(savedExpiredEvents);
  // Overtime: when a module's time runs out the student keeps working and the extra seconds are recorded.
  const [overtime, setOvertime] = useState(initialOvertime[initialModuleIndex] ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [marked, setMarked] = useState<Set<string>>(() => new Set(savedMarked));
  const [notes, setNotes] = useState<Record<string, string>>(savedNotes);
  const [eliminated, setEliminated] = useState<Record<string, Set<string>>>(() => toLabelSets(savedEliminated));
  const [saving, setSaving] = useState<SaveStatus>("idle");
  const [advancing, setAdvancing] = useState(false);
  const [confirmSubmitModule, setConfirmSubmitModule] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const offlineKey = `sat-fpt-autosave:${attemptId}`;
  const currentModule = modules[moduleIndex];
  const question = currentModule?.questions[questionIndex];
  const expiredRecorded = useRef(false);
  const breakAdvanceTriggered = useRef(false);
  const timerState = useRef<number[]>(initialTimers);
  const overtimeRef = useRef<number[]>([...initialOvertime]);
  const extraTimeUsedRef = useRef(Math.max(savedExtraTimeUsed, initialOvertime.reduce((sum, value) => sum + value, 0)));
  const questionStartTime = useRef<number | null>(null);
  const timeSpentByQuestion = useRef<Record<string, number>>({ ...savedTimeSpent });
  const phaseRef = useRef(phase);
  const breakRemainingRef = useRef(breakRemaining);
  const remainingRef = useRef(remaining);
  const moduleIndexRef = useRef(moduleIndex);
  const questionIndexRef = useRef(questionIndex);
  const answersRef = useRef(answers);
  const markedRef = useRef(marked);
  const notesRef = useRef(notes);
  const eliminatedRef = useRef(eliminated);
  const expiredEventsRef = useRef(expiredEvents);
  const typingSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enqueueSave = useSaveQueue();
  const online = useOnlineStatus();

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    breakRemainingRef.current = breakRemaining;
  }, [breakRemaining]);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);
  useEffect(() => {
    moduleIndexRef.current = moduleIndex;
  }, [moduleIndex]);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    markedRef.current = marked;
  }, [marked]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    eliminatedRef.current = eliminated;
  }, [eliminated]);
  useEffect(() => {
    expiredEventsRef.current = expiredEvents;
  }, [expiredEvents]);

  useEffect(() => {
    questionStartTime.current = Date.now();
    if (previewMode) return;
    void (async () => {
      const response = await fetchWithTransientRetry(`/api/full-practice-tests/attempts/${attemptId}/resume`, { method: "POST" });
      if (isAuthFailureStatus(response.status)) {
        await exitPlayerOnAuthLoss({
          pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause`,
        });
      }
    })();
  }, [attemptId, previewMode]);

  const recordQuestionTime = useCallback(() => {
    const currentQuestion = modules[moduleIndexRef.current]?.questions[questionIndexRef.current];
    if (!currentQuestion || questionStartTime.current === null) return { ...timeSpentByQuestion.current };
    const now = Date.now();
    const delta = Math.max(0, Math.round((now - questionStartTime.current) / 1000));
    timeSpentByQuestion.current[currentQuestion.id] =
      (timeSpentByQuestion.current[currentQuestion.id] ?? 0) + delta;
    questionStartTime.current = now;
    return { ...timeSpentByQuestion.current };
  }, [modules]);

  const buildProgressPayload = useCallback(
    (overrides?: Partial<FullTestProgressState>): FullTestProgressState => ({
      timers: [...timerState.current],
      phase: overrides?.phase ?? phaseRef.current,
      breakRemaining: overrides?.breakRemaining ?? breakRemainingRef.current,
      overtime: [...overtimeRef.current],
    }),
    [],
  );

  const buildAutosavePayload = useCallback(
    (
      nextAnswers: Record<string, string>,
      nextModule: number,
      nextQuestion: number,
      progressOverrides?: Partial<FullTestProgressState>,
    ): FullTestAutosavePayload => ({
      answers: nextAnswers,
      currentModule: nextModule,
      currentQuestion: nextQuestion,
      timeExpiredEvents: expiredEventsRef.current,
      extraTimeUsed: extraTimeUsedRef.current,
      moduleTimerState: buildProgressPayload(progressOverrides),
      timeSpentByQuestion: { ...timeSpentByQuestion.current },
      markedQuestionIds: Array.from(markedRef.current),
      notes: notesRef.current,
      eliminatedOptions: fromLabelSets(eliminatedRef.current),
    }),
    [buildProgressPayload],
  );

  // Sends one payload through the save queue; on failure it stays in the local buffer.
  const postPayload = useCallback(
    (payload: FullTestAutosavePayload) =>
      enqueueSave(async () => {
        setSaving("saving");
        try {
          const response = await fetchWithTransientRetry(`/api/full-practice-tests/attempts/${attemptId}/autosave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (isAuthFailureStatus(response.status)) {
            await exitPlayerOnAuthLoss({
              pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause`,
            });
            return;
          }
          if (!response.ok) throw new Error("Autosave failed");
          clearBuffer(offlineKey);
          setSaving("saved");
          setTimeout(() => setSaving("idle"), 1500);
        } catch {
          writeBuffer(offlineKey, payload);
          setSaving("offline");
        }
      }),
    [attemptId, enqueueSave, offlineKey],
  );

  const saveProgress = useCallback(
    async (
      nextAnswers = answersRef.current,
      nextModule = moduleIndexRef.current,
      nextQuestion = questionIndexRef.current,
      progressOverrides?: Partial<FullTestProgressState>,
    ) => {
      if (typingSaveTimeout.current) {
        clearTimeout(typingSaveTimeout.current);
        typingSaveTimeout.current = null;
      }
      if (phaseRef.current === "MODULE") {
        timerState.current[moduleIndexRef.current] = remainingRef.current;
      }
      recordQuestionTime();
      const payload = buildAutosavePayload(nextAnswers, nextModule, nextQuestion, progressOverrides);
      if (previewMode) {
        setSaving("idle");
        return;
      }
      await postPayload(payload);
    },
    [buildAutosavePayload, postPayload, previewMode, recordQuestionTime],
  );

  /**
   * Debounced save: typing, choice clicks, Mark/eliminate and in-module navigation coalesce into
   * one autosave (RNF-20); the refs are read when the timer fires. Module changes, break, submit,
   * tab hide and reconnect call saveProgress directly, which flushes any pending save.
   */
  const scheduleSave = useCallback((delayMs: number = TYPING_SAVE_DELAY_MS) => {
    if (typingSaveTimeout.current) clearTimeout(typingSaveTimeout.current);
    typingSaveTimeout.current = setTimeout(() => {
      typingSaveTimeout.current = null;
      void saveProgress();
    }, delayMs);
  }, [saveProgress]);
  const scheduleTypingSave = useCallback(() => scheduleSave(TYPING_SAVE_DELAY_MS), [scheduleSave]);

  // On mount, a local buffer means the last save never reached the server: apply it to the
  // player state first (so the next autosave does not overwrite it), then send it.
  useEffect(() => {
    if (previewMode) return;
    void (async () => {
      await Promise.resolve();
      const buffered = readBuffer<FullTestAutosavePayload>(offlineKey);
      if (!buffered) return;
      const { savedAt: _savedAt, ...payload } = buffered;
      void _savedAt;
      const nextAnswers = { ...answersRef.current, ...(payload.answers ?? {}) };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      const nextMarked = new Set(payload.markedQuestionIds ?? []);
      markedRef.current = nextMarked;
      setMarked(nextMarked);
      const nextNotes = payload.notes ?? {};
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      const nextEliminated = toLabelSets(payload.eliminatedOptions ?? {});
      eliminatedRef.current = nextEliminated;
      setEliminated(nextEliminated);
      for (const [id, seconds] of Object.entries(payload.timeSpentByQuestion ?? {})) {
        timeSpentByQuestion.current[id] = Math.max(timeSpentByQuestion.current[id] ?? 0, seconds);
      }
      // Timers only ever count down, so the smaller value is the more recent one.
      const bufferedTimers = payload.moduleTimerState?.timers ?? [];
      timerState.current = timerState.current.map((value, index) =>
        typeof bufferedTimers[index] === "number" ? Math.min(value, bufferedTimers[index]) : value,
      );
      // Overtime only ever grows, so the larger value is the more recent one.
      const bufferedOvertime = payload.moduleTimerState?.overtime ?? [];
      overtimeRef.current = overtimeRef.current.map((value, index) =>
        typeof bufferedOvertime[index] === "number" ? Math.max(value, bufferedOvertime[index]) : value,
      );
      if ((payload.extraTimeUsed ?? 0) > extraTimeUsedRef.current) {
        extraTimeUsedRef.current = payload.extraTimeUsed;
      }
      const bufferedModule = payload.currentModule ?? moduleIndexRef.current;
      if (phaseRef.current === "MODULE" && bufferedModule >= moduleIndexRef.current && bufferedModule < modules.length) {
        const nextQuestion = Math.min(
          Math.max(payload.currentQuestion ?? 0, 0),
          Math.max(modules[bufferedModule].questions.length - 1, 0),
        );
        moduleIndexRef.current = bufferedModule;
        questionIndexRef.current = nextQuestion;
        setModuleIndex(bufferedModule);
        setQuestionIndex(nextQuestion);
        const nextRemaining = timerState.current[bufferedModule] ?? modules[bufferedModule].timeLimit;
        remainingRef.current = nextRemaining;
        setRemaining(nextRemaining);
        setOvertime(overtimeRef.current[bufferedModule] ?? 0);
      }
      if ((payload.timeExpiredEvents ?? 0) > expiredEventsRef.current) {
        expiredEventsRef.current = payload.timeExpiredEvents;
        setExpiredEvents(payload.timeExpiredEvents);
      }
      await postPayload(buildAutosavePayload(nextAnswers, moduleIndexRef.current, questionIndexRef.current));
    })();
  }, [buildAutosavePayload, modules, offlineKey, postPayload, previewMode]);

  // Back online: push the current state (it includes anything buffered while offline).
  useEffect(() => {
    if (previewMode) return;
    const onOnline = () => {
      void saveProgress();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [previewMode, saveProgress]);

  // Tab hidden or closed: cancel the pending debounce and save now.
  usePageHideFlush(() => {
    if (typingSaveTimeout.current) {
      clearTimeout(typingSaveTimeout.current);
      typingSaveTimeout.current = null;
    }
    if (phaseRef.current === "MODULE") {
      timerState.current[moduleIndexRef.current] = remainingRef.current;
    }
    recordQuestionTime();
    const payload = buildAutosavePayload(answersRef.current, moduleIndexRef.current, questionIndexRef.current);
    writeBuffer(offlineKey, payload);
    sendKeepalive(`/api/full-practice-tests/attempts/${attemptId}/autosave`, payload);
  }, !previewMode);

  const submit = useCallback(async () => {
    if (previewMode) {
      notify.info("Preview", "Nothing is scored or saved.");
      router.push(exitHref);
      return;
    }
    // Submit carries the full state; a deferred autosave firing afterwards would hit a closed attempt.
    if (typingSaveTimeout.current) {
      clearTimeout(typingSaveTimeout.current);
      typingSaveTimeout.current = null;
    }
    if (phaseRef.current === "MODULE") {
      timerState.current[moduleIndexRef.current] = remainingRef.current;
    }
    const timeSpentSnapshot = recordQuestionTime();
    let response: Response;
    try {
      response = await fetchWithTransientRetry(`/api/full-practice-tests/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: answersRef.current,
        timeSpentByQuestion: timeSpentSnapshot,
        timeExpiredEvents: expiredEventsRef.current,
        extraTimeUsed: extraTimeUsedRef.current,
        moduleTimerState: buildProgressPayload(),
        markedQuestionIds: Array.from(markedRef.current),
        notes: notesRef.current,
        eliminatedOptions: fromLabelSets(eliminatedRef.current),
      }),
      });
    } catch {
      writeBuffer(offlineKey, buildAutosavePayload(answersRef.current, moduleIndexRef.current, questionIndexRef.current));
      notify.error("You're offline, so we couldn't submit. Your answers are safe — try again when you're back online.");
      return;
    }
    if (isAuthFailureStatus(response.status)) {
      await exitPlayerOnAuthLoss({
        pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause`,
      });
      return;
    }
    if (!response.ok) {
      writeBuffer(offlineKey, buildAutosavePayload(answersRef.current, moduleIndexRef.current, questionIndexRef.current));
      notify.error(await readApiError(response, "We couldn't submit. Your answers are safe — please try again."));
      return;
    }
    clearBuffer(offlineKey);
    router.push(`/student/full-tests/results/${attemptId}${resultQuery ? `?${resultQuery}` : ""}`);
  }, [attemptId, buildAutosavePayload, buildProgressPayload, exitHref, offlineKey, previewMode, recordQuestionTime, resultQuery, router]);

  const enterModule = useCallback(
    async (nextModule: number) => {
      // Credit the question being left, then move the refs right away: saveProgress copies
      // remainingRef into timerState[moduleIndexRef], so stale refs would write the new module's
      // clock into the previous module's slot.
      recordQuestionTime();
      phaseRef.current = "MODULE";
      breakRemainingRef.current = 0;
      moduleIndexRef.current = nextModule;
      questionIndexRef.current = 0;
      setPhase("MODULE");
      setBreakRemaining(0);
      setModuleIndex(nextModule);
      setQuestionIndex(0);
      expiredRecorded.current = false;
      breakAdvanceTriggered.current = false;
      const nextRemaining = timerState.current[nextModule] ?? modules[nextModule].timeLimit;
      setRemaining(nextRemaining);
      remainingRef.current = nextRemaining;
      setOvertime(overtimeRef.current[nextModule] ?? 0);
      await saveProgress(answersRef.current, nextModule, 0, {
        phase: "MODULE",
        breakRemaining: 0,
      });
    },
    [modules, recordQuestionTime, saveProgress],
  );

  const enterBreak = useCallback(async () => {
    timerState.current[moduleIndexRef.current] = 0;
    phaseRef.current = "BREAK";
    setPhase("BREAK");
    setBreakRemaining(breakSecondsTotal);
    breakRemainingRef.current = breakSecondsTotal;
    breakAdvanceTriggered.current = false;
    await saveProgress(answersRef.current, moduleIndexRef.current, questionIndexRef.current, {
      phase: "BREAK",
      breakRemaining: breakSecondsTotal,
    });
  }, [breakSecondsTotal, saveProgress]);

  const advanceAfterModule = useCallback(async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const current = moduleIndexRef.current;
      timerState.current[current] = 0;
      if (current >= modules.length - 1) {
        await submit();
        return;
      }
      if (current === RW_M2_INDEX && breakSecondsTotal > 0) {
        await enterBreak();
        return;
      }
      await enterModule(current + 1);
    } finally {
      setAdvancing(false);
    }
  }, [advancing, breakSecondsTotal, enterBreak, enterModule, modules.length, submit]);

  // Module countdown. At 0 there is no auto-advance (overtime: keep playing and record extra time);
  // the student submits the module themselves and the extra seconds are stored per module.
  useEffect(() => {
    if (phase !== "MODULE") return;
    const interval = setInterval(() => {
      // Refs, not the effect's closure: a tick landing between enterModule and the re-render must
      // count against the module now on screen.
      if (phaseRef.current !== "MODULE") return;
      const moduleIndex = moduleIndexRef.current;
      const time = remainingRef.current;
      if (time > 1) {
        timerState.current[moduleIndex] = time - 1;
        remainingRef.current = time - 1;
        setRemaining(time - 1);
        return;
      }
      if (time === 1) {
        if (!expiredRecorded.current) {
          expiredRecorded.current = true;
          setExpiredEvents((count) => count + 1);
        }
        timerState.current[moduleIndex] = 0;
        remainingRef.current = 0;
        setRemaining(0);
        return;
      }
      const moduleOvertime = (overtimeRef.current[moduleIndex] ?? 0) + 1;
      overtimeRef.current[moduleIndex] = moduleOvertime;
      setOvertime(moduleOvertime);
      extraTimeUsedRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, [moduleIndex, phase]); // restart the 1 s cadence on module/phase change

  // Break countdown — then enter Math M1.
  useEffect(() => {
    if (phase !== "BREAK") return;
    const interval = setInterval(() => {
      setBreakRemaining((time) => {
        if (time <= 1) return 0;
        return time - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "BREAK" || breakRemaining > 0 || breakAdvanceTriggered.current || advancing) return;
    breakAdvanceTriggered.current = true;
    void enterModule(RW_M2_INDEX + 1);
  }, [advancing, breakRemaining, enterModule, phase]);

  function next() {
    if (phase === "BREAK" || advancing) return;
    if (questionIndex < currentModule.questions.length - 1) {
      const nextQuestion = questionIndex + 1;
      recordQuestionTime(); // credit time to the question being left before the deferred save
      setQuestionIndex(nextQuestion);
      scheduleSave(INTERACTION_SAVE_DELAY_MS);
      return;
    }
    setConfirmSubmitModule(true);
  }

  // Back within the CURRENT module only (Digital SAT rule: no returning to a submitted module).
  function previous() {
    if (phase === "BREAK" || advancing || questionIndex === 0) return;
    const prevQuestion = questionIndex - 1;
    recordQuestionTime();
    setQuestionIndex(prevQuestion);
    scheduleSave(INTERACTION_SAVE_DELAY_MS);
  }

  function goToQuestion(target: number) {
    if (phase === "BREAK" || advancing) return;
    if (target < 0 || target > currentModule.questions.length - 1) return;
    recordQuestionTime();
    setQuestionIndex(target);
    scheduleSave(INTERACTION_SAVE_DELAY_MS);
    setShowNav(false);
  }

  function toggleMarked(questionId: string) {
    const next = new Set(markedRef.current);
    if (next.has(questionId)) next.delete(questionId);
    else next.add(questionId);
    markedRef.current = next;
    setMarked(next);
    scheduleSave(INTERACTION_SAVE_DELAY_MS);
  }

  function toggleEliminated(questionId: string, label: string) {
    const labels = new Set(eliminatedRef.current[questionId] ?? []);
    if (labels.has(label)) labels.delete(label);
    else labels.add(label);
    const next = { ...eliminatedRef.current, [questionId]: labels };
    eliminatedRef.current = next;
    setEliminated(next);
    scheduleSave(INTERACTION_SAVE_DELAY_MS);
  }

  function handleNote(questionId: string, value: string) {
    const next = { ...notesRef.current, [questionId]: value };
    notesRef.current = next;
    setNotes(next);
    scheduleTypingSave();
  }

  async function confirmFinishModule() {
    setConfirmSubmitModule(false);
    await advanceAfterModule();
  }

  const timerIsRed = phase === "MODULE" && remaining <= 60;
  const inOvertime = phase === "MODULE" && remaining <= 0;
  const unansweredInModule = currentModule
    ? currentModule.questions.filter((q) => !answers[q.id]).length
    : 0;
  const markedInModule = currentModule
    ? currentModule.questions.filter((q) => marked.has(q.id)).length
    : 0;
  const isLastQuestionOfModule = Boolean(currentModule) && questionIndex === currentModule.questions.length - 1;

  if (phase === "BREAK") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6">
        <p className="text-sm font-semibold text-gray-900">{testName}</p>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Optional break</h1>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">Take a short break, or skip it to keep going.</p>
        <p className={`mt-8 text-4xl font-semibold tabular-nums ${breakRemaining <= 60 ? "text-red-600" : "text-gray-900"}`}>
          {formatTime(breakRemaining)}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => {
              void enterModule(RW_M2_INDEX + 1);
            }}
          >
            Skip break
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await saveProgress(answers, moduleIndex, questionIndex, {
                phase: "BREAK",
                breakRemaining,
              });
              if (!previewMode) {
                await fetch(`/api/full-practice-tests/attempts/${attemptId}/pause`, { method: "POST" });
              }
              router.push(previewMode ? exitHref : "/student/content-map?area=mocks");
            }}
            title="The timer stops. You'll continue where you left off."
          >
            Save & exit
          </Button>
        </div>
      </div>
    );
  }

  if (!question) {
    return <LoadingState className="min-h-dvh" label="Loading…" />;
  }

  const hasPassage = Boolean(question.stimulus?.trim());
  const responseType = resolveQuestionType(question.type, question.options);

  function chooseOption(questionId: string, label: string) {
    const nextAnswers = { ...answersRef.current, [questionId]: label };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    scheduleSave(INTERACTION_SAVE_DELAY_MS);
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-white">
      <PlayerShortcuts
        enabled={!confirmSubmitModule && !showNav}
        onPrevious={previous}
        onNext={() => {
          if (!isLastQuestionOfModule) next();
        }}
        onMark={() => toggleMarked(question.id)}
        onChoose={(label) => chooseOption(question.id, label)}
        choiceLabels={responseType === "MC" ? question.options.map((option) => option.label) : []}
      />
      <OfflineBanner online={online} />
      {previewMode && (
        <Alert
          tone="warning"
          layout="banner"
          hideIcon
          className="py-2 text-sm"
          action={
            <button type="button" className="underline" onClick={() => router.push(exitHref)}>
              Exit preview
            </button>
          }
        >
          <span className="font-medium">Preview: nothing is scored or saved.</span>
        </Alert>
      )}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{testName}</p>
          <p className="text-xs tabular-nums text-gray-500">
            {currentModule.name} · {questionIndex + 1} of {currentModule.questions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!previewMode && <SaveIndicator status={saving} />}
          {inOvertime ? (
            <span className="flex items-baseline gap-1 tabular-nums text-red-600" aria-label={`Extra time +${formatTime(overtime)}`}>
              <span className="text-xs font-semibold uppercase tracking-wide">Extra time</span>
              +{formatTime(overtime)}
            </span>
          ) : (
            <span className={`tabular-nums ${timerIsRed ? "text-red-600" : "text-gray-900"}`}>
              {formatTime(remaining)}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            title={previewMode ? undefined : "The timer stops. You'll continue where you left off."}
            onClick={async () => {
              await saveProgress();
              if (!previewMode) {
                await fetch(`/api/full-practice-tests/attempts/${attemptId}/pause`, { method: "POST" });
              }
              router.push(previewMode ? exitHref : "/student/content-map?area=mocks");
            }}
          >
            {previewMode ? "Exit preview" : "Save & exit"}
          </Button>
        </div>
      </div>
      {inOvertime && (
        <Alert tone="warning" layout="banner" className="py-2 text-sm">
          Time&apos;s up for this module. You can keep working — your teacher will see the extra time you use.
        </Alert>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        <div
          className={cn(
            "space-y-4 overflow-y-auto border-r border-gray-200 p-6",
            hasPassage && "bg-gray-50",
          )}
        >
          {hasPassage ? (
            <MathContent content={question.stimulus!} className="prose prose-base max-w-none text-gray-800" />
          ) : null}
          <div className={cn(hasPassage && "border-t border-gray-200 pt-4")}>
            <MathContent content={question.stem} className="text-base font-medium text-gray-900 md:text-lg" />
            <QuestionMedia imageUrl={question.imageUrl} alt={`Figure for question ${questionIndex + 1}`} className="mt-4" />
          </div>
        </div>
        <div className="overflow-y-auto p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold leading-none tabular-nums text-gray-900">{questionIndex + 1}</span>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{questionResponseLabel(responseType)}</p>
            </div>
            <div className="flex items-center gap-1">
              <KeyboardShortcutsHint choices={responseType === "MC"} />
              <button
                type="button"
                onClick={() => toggleMarked(question.id)}
                aria-pressed={marked.has(question.id)}
                className={cn(
                  "flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors",
                  marked.has(question.id)
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-gray-400 text-gray-700 hover:border-gray-500 hover:text-gray-900",
                )}
              >
                <Flag size={12} aria-hidden="true" />
                {marked.has(question.id) ? "Marked" : "Mark for review"}
              </button>
            </div>
          </div>
          <MathToolPanel
            config={calculatorConfig}
            context="full-test"
            graphArtifacts={question.graphArtifacts}
            enabled={showCalculator && currentModule.section === "MATH"}
          />
          {responseType === "MC" ? (
            question.options.filter(isAnswerOption).map((option) => {
              const selected = answers[question.id] === option.label;
              const isEliminated = eliminated[question.id]?.has(option.label) ?? false;
              return (
                <div
                  key={option.label}
                  className={cn(
                    "mb-2 flex min-h-[3.75rem] w-full items-center gap-2 rounded-lg border px-3 py-3 text-base transition-colors",
                    selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300",
                    isEliminated && "opacity-55",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => chooseOption(question.id, option.label)}
                    className={cn("flex flex-1 items-center gap-3 text-left", isEliminated && "line-through")}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                        selected ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-600",
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <OptionContent text={option.text} imageUrl={option.imageUrl} label={option.label} className="leading-snug text-gray-800" />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEliminated(question.id, option.label)}
                    aria-pressed={isEliminated}
                    aria-label={isEliminated ? `Undo eliminate choice ${option.label}` : `Eliminate choice ${option.label}`}
                    className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    {isEliminated ? "Undo" : "Eliminate"}
                  </button>
                </div>
              );
            })
          ) : (
            <Input
              value={answers[question.id] ?? ""}
              onChange={(e) => {
                const nextAnswers = { ...answersRef.current, [question.id]: e.target.value };
                answersRef.current = nextAnswers;
                setAnswers(nextAnswers);
                scheduleTypingSave();
              }}
              placeholder="Type your answer"
              aria-label="Type your answer"
            />
          )}
          <details className="mt-3 rounded-md border border-gray-200 bg-gray-50 open:bg-white">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-500">
              Personal note
            </summary>
            <div className="border-t border-gray-200 px-3 pb-3 pt-2">
              <Textarea
                value={notes[question.id] ?? ""}
                onChange={(e) => handleNote(question.id, e.target.value)}
                placeholder="A note just for you"
                rows={2}
              />
            </div>
          </details>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
        <Button variant="ghost" size="sm" onClick={previous} disabled={advancing || questionIndex === 0}>
          <ChevronLeft size={16} className="mr-1" /> Back
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowNav((value) => !value)}>
          <List size={14} className="mr-1" /> Questions
        </Button>
        <Button onClick={next} disabled={advancing}>
          {isLastQuestionOfModule ? "Finish" : "Next"}
        </Button>
      </div>
      {showNav && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/20"
          role="dialog"
          aria-modal="true"
          aria-label="Question navigator"
          onClick={() => setShowNav(false)}
        >
          <div className="w-full max-w-md rounded-t-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{currentModule.name}</h3>
              <button type="button" aria-label="Close question navigator" onClick={() => setShowNav(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mb-4 grid grid-cols-8 gap-2">
              {currentModule.questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(i)}
                  aria-label={`Question ${i + 1}${marked.has(q.id) ? ", marked for review" : ""}${answers[q.id] ? ", answered" : ", unanswered"}`}
                  className={cn(
                    "relative h-9 w-9 rounded border text-xs font-medium transition-colors",
                    i === questionIndex
                      ? "border-blue-500 bg-blue-500 text-white"
                      : answers[q.id]
                        ? "border-green-400 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50",
                    marked.has(q.id) && "ring-2 ring-amber-400 ring-offset-1",
                  )}
                >
                  {i + 1}
                  {marked.has(q.id) ? (
                    <Flag size={9} className="absolute -right-1 -top-1 fill-amber-400 text-amber-500" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-green-400 bg-green-100" /> Answered</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-white" /> Unanswered</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-white ring-2 ring-amber-400 ring-offset-1" /> Marked</span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-500">You can only go back to questions in this module.</p>
              <Button
                type="button"
                size="sm"
                disabled={advancing}
                onClick={() => {
                  setShowNav(false);
                  setConfirmSubmitModule(true);
                }}
              >
                Submit module
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmSubmitModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Submit module?</h2>
            <p className="mt-2 text-sm text-gray-600">
              {inOvertime ? (
                <>You used {formatTime(overtime)} of extra time on <strong>{currentModule.name}</strong>.</>
              ) : (
                <>You still have {formatTime(remaining)} left on <strong>{currentModule.name}</strong>.</>
              )}
            </p>
            {unansweredInModule > 0 && (
              <p className="mt-2 text-sm text-amber-700">
                You left {unansweredInModule} question{unansweredInModule === 1 ? "" : "s"} blank. Blank questions count as wrong.
              </p>
            )}
            {markedInModule > 0 && (
              <p className="mt-2 text-sm text-amber-700">
                {markedInModule} question{markedInModule === 1 ? "" : "s"} still marked for review.
              </p>
            )}
            <p className="mt-2 text-sm font-medium text-gray-900">Once you submit, you can&apos;t return to this module.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmSubmitModule(false)}>
                Go back
              </Button>
              <Button type="button" onClick={() => void confirmFinishModule()} disabled={advancing}>
                Submit module
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
