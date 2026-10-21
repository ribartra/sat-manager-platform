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
import { MODULE_KEYS } from "@/lib/test-module-keys";
import { questionResponseLabel, resolveQuestionType, isAnswerOption } from "@/lib/question-type";
import { LoadingState, OfflineBanner, SaveIndicator, type SaveStatus } from "@/components/sat";
import { exitPlayerOnAuthLoss, isAuthFailureStatus } from "@/lib/player-session-exit";
import { fetchWithTransientRetry } from "@/lib/transient-fetch";
import { readApiError } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { clearBuffer, readBuffer, sendKeepalive, useOnlineStatus, usePageHideFlush, useSaveQueue, writeBuffer } from "@/lib/player-persistence";
import { Calculator, ChevronLeft, FileText, Flag, Highlighter, LogOut } from "lucide-react";
import { EliminateIcon, ReferenceSheet, StrikeButton, ToolButton, useQuestionHighlights } from "@/components/sat/player-tools";
import { IssueReportButton } from "@/components/sat/issue-reporter";
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
  exitHref = "/student/tests",
  resultQuery,
  completedModules = [],
  startModule = null,
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
  /** Modules already submitted (locked). Students may take the modules in any order. */
  completedModules?: number[];
  /** Module chosen on the Test page (?module=rw1|rw2|m1|m2). */
  startModule?: number | null;
}) {
  const router = useRouter();
  const breakSecondsTotal = Math.max(0, breakMinutes) * 60;
  const completedAtLoad = new Set(completedModules);
  const isOpen = (index: number) => index >= 0 && index < modules.length && !completedAtLoad.has(index);
  const firstOpenModule = modules.findIndex((_, index) => isOpen(index));
  // A chosen module wins; otherwise resume where the student was, unless that module is already submitted.
  const chosenModule = startModule !== null && isOpen(startModule) ? startModule : null;
  const restoringUsableBreak = chosenModule === null && savedProgressState?.phase === "BREAK" && breakSecondsTotal > 0;
  const initialModuleIndex = chosenModule
    ?? (isOpen(savedModule) && !(savedProgressState?.phase === "BREAK" && breakSecondsTotal === 0)
      ? savedModule
      : Math.max(firstOpenModule, 0));
  const initialQuestionIndex = initialModuleIndex === savedModule && savedProgressState?.phase !== "BREAK" ? savedQuestion : 0;
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
  // "Check your work" page shown after the last question (mockup take.js), before submitting.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  // Mockup take.js tools: Eliminate mode, calculator, reference sheet, highlights.
  const [elimMode, setElimMode] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [hlZone, setHlZone] = useState<HTMLDivElement | null>(null);
  const offlineKey = `sat-fpt-autosave:${attemptId}`;
  const currentModule = modules[moduleIndex];
  const question = currentModule?.questions[questionIndex];
  const highlights = useQuestionHighlights(`sat.hl.test.${attemptId}`, question?.id, hlZone);
  const expiredRecorded = useRef(false);
  const breakAdvanceTriggered = useRef(false);
  const timerState = useRef<number[]>(initialTimers);
  const overtimeRef = useRef<number[]>([...initialOvertime]);
  const extraTimeUsedRef = useRef(Math.max(savedExtraTimeUsed, initialOvertime.reduce((sum, value) => sum + value, 0)));
  const completedRef = useRef<Set<number>>(new Set(completedModules));
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
      if (
        phaseRef.current === "MODULE" &&
        bufferedModule >= moduleIndexRef.current &&
        bufferedModule < modules.length &&
        !completedRef.current.has(bufferedModule)
      ) {
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
    router.push(`/student/tests/results/${attemptId}${resultQuery ? `?${resultQuery}` : ""}`);
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

  /** Submits the module on screen. Returns false when it could not be saved (the student stays on it). */
  const submitModule = useCallback(async (index: number) => {
    if (typingSaveTimeout.current) {
      clearTimeout(typingSaveTimeout.current);
      typingSaveTimeout.current = null;
    }
    timerState.current[index] = remainingRef.current;
    recordQuestionTime();
    const payload = buildAutosavePayload(answersRef.current, index, questionIndexRef.current);
    let response: Response;
    try {
      response = await fetchWithTransientRetry(`/api/full-practice-tests/attempts/${attemptId}/modules/${index}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      writeBuffer(offlineKey, payload);
      notify.error("You're offline, so we couldn't submit this module. Your answers are safe — try again when you're back online.");
      return null;
    }
    if (isAuthFailureStatus(response.status)) {
      await exitPlayerOnAuthLoss({ pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause` });
      return null;
    }
    if (!response.ok) {
      writeBuffer(offlineKey, payload);
      notify.error(await readApiError(response, "We couldn't submit this module. Your answers are safe — please try again."));
      return null;
    }
    clearBuffer(offlineKey);
    const data = (await response.json()) as { done?: boolean; completedModules?: number[] };
    completedRef.current = new Set(data.completedModules ?? [...completedRef.current, index]);
    return data;
  }, [attemptId, buildAutosavePayload, offlineKey, recordQuestionTime]);

  const resultsHref = useCallback(
    (submittedIndex?: number) => {
      const params = new URLSearchParams(resultQuery ?? "");
      const key = submittedIndex !== undefined ? MODULE_KEYS[submittedIndex] : undefined;
      if (key) params.set("submitted", key);
      const qs = params.toString();
      return `/student/tests/results/${attemptId}${qs ? `?${qs}` : ""}`;
    },
    [attemptId, resultQuery],
  );

  const advanceAfterModule = useCallback(async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const current = moduleIndexRef.current;
      if (previewMode) {
        // Preview walks the modules in order; nothing is saved.
        timerState.current[current] = 0;
        if (current >= modules.length - 1) {
          await submit();
          return;
        }
        await enterModule(current + 1);
        return;
      }
      const result = await submitModule(current);
      if (!result) return;
      if (result.done) {
        router.push(resultsHref());
        return;
      }
      timerState.current[current] = 0;
      // Optional break only between the R&W section and a Math section not started yet.
      const mathOpen = modules
        .map((testModule, index) => ({ testModule, index }))
        .filter(({ testModule, index }) => testModule.section === "MATH" && !completedRef.current.has(index));
      const mathUntouched = mathOpen.length === modules.filter((m) => m.section === "MATH").length
        && mathOpen.every(({ testModule, index }) => (timerState.current[index] ?? testModule.timeLimit) >= testModule.timeLimit);
      if (current === RW_M2_INDEX && breakSecondsTotal > 0 && mathUntouched) {
        await enterBreak();
        return;
      }
      router.push(resultsHref(current));
    } finally {
      setAdvancing(false);
    }
  }, [advancing, breakSecondsTotal, enterBreak, enterModule, modules, previewMode, resultsHref, router, submit, submitModule]);

  /** After the break: the first Math module the student has not submitted. */
  const moduleAfterBreak = useCallback(() => {
    const next = modules.findIndex((testModule, index) => testModule.section === "MATH" && !completedRef.current.has(index));
    return next >= 0 ? next : RW_M2_INDEX + 1;
  }, [modules]);

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
    void enterModule(moduleAfterBreak());
  }, [advancing, breakRemaining, enterModule, moduleAfterBreak, phase]);

  function next() {
    if (phase === "BREAK" || advancing) return;
    if (questionIndex < currentModule.questions.length - 1) {
      const nextQuestion = questionIndex + 1;
      recordQuestionTime(); // credit time to the question being left before the deferred save
      setQuestionIndex(nextQuestion);
      scheduleSave(INTERACTION_SAVE_DELAY_MS);
      return;
    }
    recordQuestionTime();
    setReviewOpen(true);
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
    setReviewOpen(false);
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
        <h1 className="mt-3 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Optional break</h1>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">Take a short break, or skip it to keep going.</p>
        <p className={`mt-8 text-4xl font-semibold tabular-nums ${breakRemaining <= 60 ? "text-red-600" : "text-gray-900"}`}>
          {formatTime(breakRemaining)}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => {
              void enterModule(moduleAfterBreak());
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
              router.push(exitHref);
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
        enabled={!confirmSubmitModule && !showNav && !reviewOpen}
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
      {/* Top bar (mockup `.take-top`): title · centred timer · tools */}
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-2.5 sm:px-5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--sat-text)]">{testName}</p>
          <p className="truncate text-xs tabular-nums text-[var(--sat-muted)]">
            {currentModule.name} · {questionIndex + 1} of {currentModule.questions.length}
          </p>
        </div>
        <div className="flex flex-col items-center leading-tight">
          {inOvertime ? (
            <span className="flex items-baseline gap-1 text-xl font-extrabold tabular-nums text-[var(--sat-bad)]" aria-label={`Extra time +${formatTime(overtime)}`}>
              <span className="text-xs font-semibold uppercase tracking-wide">Extra time</span>
              +{formatTime(overtime)}
            </span>
          ) : timerHidden && !timerIsRed ? (
            <button type="button" onClick={() => setTimerHidden(false)} className="text-xs font-medium text-gray-500 underline hover:text-gray-800">
              Show timer
            </button>
          ) : (
            <span className="flex items-baseline gap-2">
              <span className={`text-xl font-extrabold tabular-nums ${timerIsRed ? "text-[var(--sat-bad)]" : "text-[var(--sat-text)]"}`}>{formatTime(remaining)}</span>
              {!timerIsRed ? (
                <button type="button" onClick={() => setTimerHidden(true)} className="text-xs text-gray-400 underline hover:text-gray-700">
                  Hide
                </button>
              ) : null}
            </span>
          )}
          {!previewMode && <SaveIndicator compact status={saving} />}
        </div>
        <div className="flex items-center justify-end gap-0.5">
            <ToolButton icon={<Highlighter size={18} />} label="Highlight" onClick={highlights.highlightSelection} title="Highlight the selected text" />
            <ToolButton icon={<EliminateIcon />} label="Eliminate" active={elimMode} onClick={() => setElimMode((v) => !v)} />
            {currentModule.section === "MATH" && showCalculator ? (
              <ToolButton icon={<Calculator size={18} />} label="Calculator" active={calcOpen} onClick={() => setCalcOpen((v) => !v)} />
            ) : null}
            {currentModule.section === "MATH" ? <ToolButton icon={<FileText size={18} />} label="Reference" onClick={() => setRefOpen(true)} /> : null}
            <IssueReportButton variant="tool" />
            <ToolButton
              icon={<LogOut size={18} />}
              label={previewMode ? "Exit preview" : "Save & exit"}
              title={previewMode ? "Exit preview" : "The timer stops. You'll continue where you left off."}
              onClick={async () => {
                await saveProgress();
                if (!previewMode) {
                  await fetch(`/api/full-practice-tests/attempts/${attemptId}/pause`, { method: "POST" });
                }
                router.push(exitHref);
              }}
            />
        </div>
      </div>
      {inOvertime && (
        <Alert tone="warning" layout="banner" className="py-2 text-sm">
          Time&apos;s up for this module. You can keep working — your teacher will see the extra time you use.
        </Alert>
      )}
      <ReferenceSheet open={refOpen} onOpenChange={setRefOpen} />
      {reviewOpen ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-semibold text-gray-900">Check your work</h2>
            <p className="mt-1 text-sm text-gray-600">
              {unansweredInModule > 0
                ? `${unansweredInModule} question${unansweredInModule === 1 ? " is" : "s are"} still unanswered. `
                : "Every question has an answer. "}
              {markedInModule > 0 ? `${markedInModule} marked for review. ` : ""}
              Click a question to go back to it. When you are ready, submit the module.
            </p>
            <div className="mt-5 rounded-lg border border-gray-200 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">{currentModule.name}</p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                {currentModule.questions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(i)}
                    aria-label={`Question ${i + 1}${marked.has(q.id) ? ", marked for review" : ""}${answers[q.id] ? ", answered" : ", unanswered"}`}
                    className={cn(
                      "relative aspect-square rounded-lg border-[1.5px] text-sm font-bold",
                      answers[q.id]
                        ? "border-[var(--sat-primary)] bg-[var(--sat-primary)] text-white"
                        : "border-dashed border-[var(--sat-muted)] text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]",
                      marked.has(q.id) && "after:absolute after:-right-1.5 after:-top-2.5 after:text-[13px] after:text-[var(--sat-bad)] after:content-['⚑']",
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-green-400 bg-green-100" /> Answered</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-dashed border-gray-300 bg-white" /> Unanswered</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-white ring-2 ring-amber-400 ring-offset-1" /> Marked</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        <div
          ref={setHlZone}
          className={cn(
            "min-h-0 space-y-4 overflow-y-auto border-[var(--sat-border)] p-4 max-md:border-b-[3px] md:border-r-[3px] md:px-[30px] md:py-[26px]",
          )}
        >
          {hasPassage ? (
            <MathContent content={question.stimulus!} className="prose prose-base max-w-none font-serif-q text-base leading-[1.7] text-[var(--sat-text)]" />
          ) : null}
          <div className={cn(hasPassage && "border-t border-[var(--sat-border)] pt-4")}>
            <MathContent content={question.stem} className="font-serif-q text-base leading-relaxed text-[var(--sat-text)] md:text-[17px]" />
            <QuestionMedia imageUrl={question.imageUrl} alt={`Figure for question ${questionIndex + 1}`} className="mt-4" />
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 md:px-[30px] md:py-[26px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-extrabold leading-none tabular-nums text-[var(--sat-text)]">{questionIndex + 1}</span>
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
            enabled={calcOpen && showCalculator && currentModule.section === "MATH"}
          />
          {responseType === "MC" ? (
            question.options.filter(isAnswerOption).map((option) => {
              const selected = answers[question.id] === option.label;
              const isEliminated = eliminated[question.id]?.has(option.label) ?? false;
              return (
                <div
                  key={option.label}
                  className={cn(
                    // Mockup `.choice`: Georgia 15px, 1.5px border, radius 10, 28px letter circle.
                    "mb-2.5 flex w-full items-center gap-2 rounded-[10px] border-[1.5px] bg-white px-3.5 py-[11px] font-serif-q text-[15px] transition-colors",
                    selected ? "border-[var(--sat-primary)] bg-[var(--sat-primary-soft)]" : "border-[var(--sat-border-strong)] hover:border-[var(--sat-primary)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => chooseOption(question.id, option.label)}
                    className={cn("flex flex-1 items-center gap-3 text-left", isEliminated && "line-through opacity-45")}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] font-sans text-xs font-bold",
                        selected ? "border-[var(--sat-primary)] bg-[var(--sat-primary)] text-white" : "border-[var(--sat-muted)] text-[var(--sat-text)]",
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <OptionContent text={option.text} imageUrl={option.imageUrl} label={option.label} className="text-[15px] leading-snug text-[var(--sat-text)]" />
                    </span>
                  </button>
                  {elimMode ? (
                    <StrikeButton label={option.label} struck={isEliminated} onClick={() => toggleEliminated(question.id, option.label)} />
                  ) : null}
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
      )}
      {/* Footer (mockup `.take-foot`): saved note · question navigator · Back / Next */}
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-2.5 sm:px-5">
        <span className="text-xs text-[var(--sat-muted)] max-[859px]:hidden">{previewMode ? "Preview: nothing is saved" : "Your answers are saved automatically"}</span>
        <Button
          variant="secondary"
          className="col-start-2 border-0 bg-[var(--sat-text)] text-white hover:bg-[#1e293b]"
          onClick={() => setShowNav((value) => !value)}
        >
          {reviewOpen ? "Questions" : `Question ${questionIndex + 1} of ${currentModule.questions.length}`} ▴
        </Button>
        <div className="col-start-3 flex items-center justify-end gap-2">
          {reviewOpen ? (
            <Button variant="secondary" onClick={() => setReviewOpen(false)} disabled={advancing}>
              <ChevronLeft size={16} className="max-sm:hidden" /> Back
            </Button>
          ) : (
            <Button variant="secondary" onClick={previous} disabled={advancing || questionIndex === 0}>
              <ChevronLeft size={16} className="max-sm:hidden" /> Back
            </Button>
          )}
          {reviewOpen ? (
            <Button onClick={() => setConfirmSubmitModule(true)} disabled={advancing}>
              Submit module
            </Button>
          ) : (
            <Button onClick={next} disabled={advancing}>
              {isLastQuestionOfModule ? "Review" : "Next"}
            </Button>
          )}
        </div>
      </div>
      {showNav && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center pb-[66px]"
          role="dialog"
          aria-modal="true"
          aria-label="Question navigator"
          onClick={() => setShowNav(false)}
        >
          <div className="w-[min(460px,94vw)] rounded-[14px] border border-[var(--sat-border)] bg-white p-4 shadow-[0_16px_40px_rgba(0,0,0,.2)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{currentModule.name}</h3>
              <button type="button" aria-label="Close question navigator" onClick={() => setShowNav(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mb-4 mt-2.5 grid grid-cols-8 gap-2">
              {currentModule.questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(i)}
                  aria-label={`Question ${i + 1}${marked.has(q.id) ? ", marked for review" : ""}${answers[q.id] ? ", answered" : ", unanswered"}`}
                  className={cn(
                    // Mockup `.navgrid`: dashed when blank, blue when answered, outline on the current one.
                    "relative aspect-square rounded-lg border-[1.5px] text-sm font-bold transition-colors",
                    answers[q.id]
                      ? "border-[var(--sat-primary)] bg-[var(--sat-primary)] text-white"
                      : "border-dashed border-[var(--sat-muted)] bg-white text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]",
                    i === questionIndex && "outline outline-2 outline-offset-1 outline-[var(--sat-text)]",
                  )}
                >
                  {i + 1}
                  {marked.has(q.id) ? (
                    <span className="absolute -right-1.5 -top-2.5 text-[13px] text-[var(--sat-bad)]" aria-hidden>⚑</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-[var(--sat-primary)] bg-[var(--sat-primary)]" /> Answered</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-dashed border-[var(--sat-muted)]" /> Unanswered</span>
              <span className="flex items-center gap-1"><span className="text-[var(--sat-bad)]">⚑</span> Marked</span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-500">You can only go back to questions in this module.</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={advancing}
                onClick={() => {
                  recordQuestionTime();
                  setShowNav(false);
                  setReviewOpen(true);
                }}
              >
                Go to review page
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
            <p className="mt-2 text-sm font-medium text-gray-900">Once you submit, you can&apos;t return to this module. You can take the other modules in any order.</p>
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
