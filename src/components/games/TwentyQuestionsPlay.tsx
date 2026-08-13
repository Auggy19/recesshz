import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { TwentyQuestionsArt } from "@/components/GameArt";

// ---------------------------------------------------------------------------
// Twenty Questions play area. The initiator (X) secretly picks a word or
// phrase; the responder (O) asks up to 20 yes/no questions, one at a time,
// and can guess at any point — a correct guess wins, a wrong one loses.
// The secret is server-masked from the asker until the match ends.
// ---------------------------------------------------------------------------

type Marker = "X" | "O";
type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
type YesNo = "yes" | "no";

const MAX_QUESTIONS = 20;

interface TwentyQuestionsEntry {
  text: string;
  answer: YesNo;
}

interface TwentyQuestionsState {
  phase: "setup" | "asking" | "final" | "match_over";
  secret: string | null;
  pendingQuestion: string | null;
  questions: TwentyQuestionsEntry[];
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}

export type TwentyQuestionsMove =
  | { secret: string }
  | { question: string }
  | { answer: YesNo }
  | { guess: string };

interface Props {
  state: TwentyQuestionsState;
  status: GameStatus;
  myMarker: Marker;
  onSubmit: (move: TwentyQuestionsMove) => Promise<boolean>;
}

export default function TwentyQuestionsPlay({
  state,
  status,
  myMarker,
  onSubmit,
}: Props) {
  const [secretInput, setSecretInput] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [mode, setMode] = useState<"ask" | "guess">("ask");
  const [submitting, setSubmitting] = useState(false);

  const isWaiting = status === "waiting";
  const isOver = state.winner !== null;
  const opponentMarker: Marker = myMarker === "X" ? "O" : "X";
  const isAnswerer = myMarker === "X";

  // How many questions are on the table (asked + pending, capped at 20).
  const questionCount = Math.min(
    state.questions.length + (state.pendingQuestion !== null ? 1 : 0),
    MAX_QUESTIONS,
  );
  const canAsk = state.phase === "asking" && state.pendingQuestion === null;
  const canGuess =
    (state.phase === "asking" || state.phase === "final") &&
    state.pendingQuestion === null;

  // Status line text
  let statusText: string;
  if (isWaiting) {
    statusText = "Waiting for your friend to join…";
  } else if (isOver) {
    statusText =
      state.winner === myMarker
        ? "You win!"
        : state.winner === opponentMarker
          ? "Your friend wins"
          : "";
  } else if (state.phase === "setup") {
    statusText = isAnswerer
      ? "Pick your secret — your friend can't see it."
      : "Waiting for your friend to pick a secret…";
  } else if (state.phase === "final") {
    statusText = isAnswerer
      ? "All 20 asked — your friend's final guess is coming…"
      : "All 20 questions asked — make your final guess.";
  } else if (state.pendingQuestion !== null) {
    statusText = isAnswerer
      ? "Your friend asked — answer yes or no."
      : "Waiting on the answer…";
  } else {
    statusText = isAnswerer
      ? "Waiting for your friend's question…"
      : "Your move — ask or guess.";
  }

  const submit = async (move: TwentyQuestionsMove) => {
    if (submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(move);
    if (ok) {
      // Clear the input that was just sent; the server state re-renders us.
      if ("secret" in move) setSecretInput("");
      if ("question" in move) setQuestionInput("");
      if ("guess" in move) setGuessInput("");
    }
    setSubmitting(false);
  };

  const onAskForm = (e: FormEvent) => {
    e.preventDefault();
    const q = questionInput.trim();
    if (!q) return;
    void submit({ question: q });
  };

  const onGuessForm = (e: FormEvent) => {
    e.preventDefault();
    const g = guessInput.trim();
    if (!g) return;
    void submit({ guess: g });
  };

  const onSecretForm = (e: FormEvent) => {
    e.preventDefault();
    const s = secretInput.trim();
    if (!s) return;
    void submit({ secret: s });
  };

  return (
    <>
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "size-2 rounded-full",
            state.pendingQuestion !== null || isWaiting || isOver
              ? "animate-pulse bg-primary"
              : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          {statusText}
        </p>
      </div>

      {/* The game card */}
      <div
        className={cn(
          "mx-auto mt-5 w-full max-w-xs rounded-3xl border-2 bg-card p-5",
          isOver ? "border-primary/60" : "border-border",
          isWaiting && "opacity-60",
        )}
      >
        {isWaiting ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <TwentyQuestionsArt className="w-16" />
            <p className="text-sm font-semibold text-muted-foreground">
              Waiting for your friend to join…
            </p>
          </div>
        ) : state.phase === "setup" && isAnswerer ? (
          // X picks the secret
          <div>
            <p className="text-center text-sm font-bold">
              Think of a word or phrase.
            </p>
            <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
              Your friend gets 20 yes/no questions to guess it. Keep it short —
              a person, a place, a thing, an idea.
            </p>
            <form onSubmit={onSecretForm} className="mt-4 flex flex-col gap-2">
              <input
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                maxLength={80}
                placeholder="e.g. a giraffe"
                aria-label="Your secret"
                className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
              />
              <button
                type="submit"
                disabled={submitting || secretInput.trim().length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Lock it in
              </button>
            </form>
          </div>
        ) : state.phase === "setup" ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <TwentyQuestionsArt className="w-16 animate-pulse" />
            <p className="text-sm font-semibold text-muted-foreground">
              Your friend is picking a secret…
            </p>
          </div>
        ) : state.pendingQuestion !== null && isAnswerer ? (
          // X answers the pending question
          <div>
            <p className="text-center text-xs font-bold text-muted-foreground">
              Question {questionCount} of {MAX_QUESTIONS}
            </p>
            <p className="mt-2 rounded-2xl bg-background px-4 py-3 text-center text-sm font-bold leading-relaxed">
              “{state.pendingQuestion}”
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["yes", "no"] as const).map((answer) => (
                <button
                  key={answer}
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit({ answer })}
                  className={cn(
                    "h-11 rounded-full text-sm font-bold transition-all",
                    answer === "yes"
                      ? "bg-primary text-white shadow-lg shadow-primary/25 hover:opacity-90"
                      : "border border-border bg-background text-foreground hover:bg-accent",
                  )}
                >
                  {answer === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        ) : isAnswerer ? (
          // X waits for O to ask or guess
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="text-3xl font-black text-muted-foreground">…</span>
            <p className="text-sm font-semibold text-muted-foreground">
              {state.phase === "final"
                ? "All 20 questions used — your friend must guess now."
                : "Waiting for your friend's question…"}
            </p>
            {state.questions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {state.questions.length} of {MAX_QUESTIONS} questions so far.
              </p>
            )}
          </div>
        ) : (
          // O asks or guesses
          <div>
            <p className="text-center text-xs font-bold text-muted-foreground">
              {state.phase === "final"
                ? "Final guess"
                : `Question ${questionCount} of ${MAX_QUESTIONS}`}
            </p>

            {/* Ask / guess toggle */}
            <div className="mt-3 flex items-center justify-center gap-1 rounded-full border border-border bg-background p-1">
              {(["ask", "guess"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  disabled={m === "ask" && state.phase === "final"}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
                    mode === m && !(m === "ask" && state.phase === "final")
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "ask" ? "Ask" : "Guess"}
                </button>
              ))}
            </div>

            {mode === "ask" && state.phase !== "final" ? (
              <form onSubmit={onAskForm} className="mt-4 flex flex-col gap-2">
                <textarea
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Yes/no question… e.g. Is it bigger than a breadbox?"
                  aria-label="Your question"
                  className="min-w-0 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={submitting || questionInput.trim().length === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Ask
                </button>
              </form>
            ) : (
              <form onSubmit={onGuessForm} className="mt-4 flex flex-col gap-2">
                <input
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  maxLength={200}
                  placeholder="Your final guess…"
                  aria-label="Your guess"
                  className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={submitting || guessInput.trim().length === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Make the guess
                </button>
              </form>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {state.phase === "final"
                ? "Wrong guess loses — make it count."
                : "Guess right to win. A wrong guess loses."}
            </p>
          </div>
        )}
      </div>

      {/* Past questions — both players see the transcript */}
      {state.questions.length > 0 && !isWaiting && (
        <div className="mx-auto mt-3 w-full max-w-xs rounded-2xl border border-border bg-card/60 p-4">
          <p className="text-xs font-bold text-muted-foreground">
            So far · {state.questions.length} of {MAX_QUESTIONS}
          </p>
          <ul className="mt-2 space-y-1.5">
            {state.questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <span className="mt-0.5 shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 font-black text-primary">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {q.text}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-black",
                    q.answer === "yes" ? "text-primary" : "text-foreground",
                  )}
                >
                  {q.answer === "yes" ? "Yes" : "No"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Match over — the reveal */}
      {isOver && !isWaiting && (
        <div className="mx-auto mt-4 w-full max-w-xs rounded-3xl border-2 border-primary/60 bg-card p-5 text-center shadow-sm">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/15 text-xl">
            🎉
          </div>
          <p className="mt-3 text-base font-black tracking-tight">
            {state.winner === myMarker
              ? isAnswerer
                ? "You stumped them!"
                : "You got it!"
              : isAnswerer
                ? "Your friend got it"
                : "Not quite"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAnswerer
              ? state.winner === myMarker
                ? `They asked ${state.questions.length} question${
                    state.questions.length === 1 ? "" : "s"
                  } and never found it.`
                : `They found it in ${state.questions.length} question${
                    state.questions.length === 1 ? "" : "s"
                  }.`
              : state.winner === myMarker
                ? `Solved in ${state.questions.length} question${
                    state.questions.length === 1 ? "" : "s"
                  }. Silence never felt so good.`
                : `You asked ${state.questions.length} question${
                    state.questions.length === 1 ? "" : "s"
                  } and it slipped away.`}
          </p>
          {state.secret && (
            <p className="mt-4 rounded-2xl bg-background px-4 py-3 text-sm font-bold">
              The secret was:{" "}
              <span className="text-primary">“{state.secret}”</span>
            </p>
          )}
        </div>
      )}
    </>
  );
}
