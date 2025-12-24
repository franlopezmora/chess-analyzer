"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useEffect } from "react";
import { uploadGameAction } from "./actions";

const initialState = {
  success: false,
  message: "",
  error: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-primary w-full justify-center"
    >
      {pending ? "Subiendo..." : "Subir PGN"}
    </button>
  );
}

export function UploadForm() {
  const [state, formAction] = useActionState(uploadGameAction, initialState);

  useEffect(() => {
    if (state.success) {
      const form = document.getElementById("pgn-form") as HTMLFormElement | null;
      form?.reset();
    }
  }, [state.success]);

  return (
    <form
      id="pgn-form"
      action={formAction}
      className="surface-card app-card space-y-4 rounded-3xl p-6"
    >
      <header>
        <p className="hero-eyebrow text-xs tracking-[0.4em]">Nueva partida</p>
        <h2 className="mt-2 text-lg font-semibold">Cargá un PGN para analizar</h2>
        <p className="text-sm text-muted">
          Podés pegar el texto o arrastrar un archivo. Guardaremos los metadatos
          y movimientos para que el pipeline los procese.
        </p>
      </header>

      <div className="space-y-2">
        <label className="input-label">Título (opcional)</label>
        <input
          type="text"
          name="title"
          placeholder="Match vs Lichess Bot"
          className="input-control text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="input-label">PGN</label>
        <textarea
          name="pgn"
          required
          placeholder='Ej: [Event "Demo"] ...'
          className="input-control h-56 font-mono"
        />
      </div>

      {state.error && (
        <p className="alert alert-error">{state.error}</p>
      )}

      {state.success && state.message && (
        <p className="alert alert-success">{state.message}</p>
      )}

      <SubmitButton />
    </form>
  );
}

