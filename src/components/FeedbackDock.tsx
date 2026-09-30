import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";

export function FeedbackDock() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 3) {
      toast.error("Write a short note");
      return;
    }
    setBusy(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("app_feedback").insert({
          rating,
          body: body.trim(),
        });
        if (error) throw error;
      }
      toast.success("Noted. Thank you.");
      setBody("");
      setOpen(false);
    } catch {
      toast.error("Could not send. Try again when the server is up.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-30 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold shadow-soft"
      >
        Feedback
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(e) => void submit(e)}
            className="w-full max-w-sm rounded-3xl border border-border bg-background p-5"
          >
            <h2 className="font-display text-lg font-black">How is Recess treating you?</h2>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`size-8 rounded-full text-sm font-bold ${
                    rating >= n ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-3 min-h-24 w-full rounded-xl border border-border bg-background p-2 text-sm"
              placeholder="What felt slow, confusing, or good?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="submit" disabled={busy}>
                Send
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
