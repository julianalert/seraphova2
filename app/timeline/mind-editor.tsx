"use client";

import { useActionState, useState } from "react";
import { FOCUS_AREAS, type FocusId } from "@/lib/types";
import { updateMind, type MindState } from "./actions";

const initial: MindState = { status: "idle" };

/** Lets a member change what they told us is on their mind. */
export function MindEditor({ focus, note }: { focus: FocusId; note: string }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<FocusId>(focus);
  const [state, action, pending] = useActionState(async (previous: MindState, formData: FormData) => {
    const result = await updateMind(previous, formData);
    if (result.status === "saved") setOpen(false);
    return result;
  }, initial);

  const current = FOCUS_AREAS.find((area) => area.id === focus) ?? FOCUS_AREAS[0];

  if (!open) {
    return (
      <section id="mind" className="mind-card">
        <div className="mind-row">
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <p className="section-eyebrow" style={{ marginBottom: 10 }}>
              On your mind
            </p>
            <p className="mind-focus">
              <span aria-hidden="true" style={{ marginRight: 10, fontSize: 18 }}>
                {current.emoji}
              </span>
              {current.label}
            </p>
            {note ? (
              <p className="mind-note">&ldquo;{note}&rdquo;</p>
            ) : (
              <p className="ob-sub" style={{ margin: "8px 0 0" }}>
                You have not told us anything specific yet. A few words make your readings sharper.
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setChosen(focus);
              setOpen(true);
            }}
          >
            Update
          </button>
        </div>
        {state.status === "saved" && (
          <p className="status-note" role="status" style={{ marginTop: 14 }}>
            Saved. Your readings from tomorrow on are written with this in mind.
          </p>
        )}
      </section>
    );
  }

  return (
    <section id="mind" className="mind-card editing">
      <form action={action}>
        <p className="section-eyebrow" style={{ marginBottom: 10 }}>
          On your mind
        </p>
        <h2 className="ob-title" style={{ fontSize: 30 }}>
          What has <em>changed?</em>
        </h2>
        <p className="ob-sub" style={{ marginBottom: 22 }}>
          Your readings follow this. Update it whenever life moves.
        </p>

        <input type="hidden" name="focus" value={chosen} />
        <div className="ob-fields">
          <div className="ob-field">
            <span className="label">What&apos;s most on your mind?</span>
            <div className="choice-grid" role="radiogroup" aria-label="What's most on your mind?">
              {FOCUS_AREAS.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen === area.id}
                  className={`choice-card ${chosen === area.id ? "selected" : ""}`}
                  onClick={() => setChosen(area.id)}
                >
                  <span className="choice-icon">{area.emoji}</span>
                  <span className="choice-label">{area.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ob-field">
            <label className="label" htmlFor="mind-note">
              Anything specific going on right now?
            </label>
            <textarea
              id="mind-note"
              name="note"
              className="input"
              style={{ minHeight: 120 }}
              maxLength={600}
              defaultValue={note}
              placeholder="A situation, a decision, a feeling. The more specific, the more your readings will feel written for you."
            />
          </div>
        </div>

        {state.status === "error" && (
          <div className="ob-api-error" role="alert">
            {state.message}
          </div>
        )}

        <div className="mind-actions">
          <button type="button" className="nav-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-gold" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
