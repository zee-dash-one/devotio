import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Feather } from "lucide-react";
import { peregrinoModel, peregrinoSelection, validationMessage, type BibleSelection, type PeregrinoTarget } from "domain/core";
import { useApp } from "../context";
import { ErrorMessage } from "../components";
import { Button, IconButton } from "../ui/button";

const questions: { target: PeregrinoTarget; label: string }[] = [
  { target: "reflection", label: "Prepara a meditação" },
  { target: "prayer", label: "Prepara a oração" },
  { target: "both", label: "Prepara os dois" },
];

export function PeregrinoPanel({ selection, date, reflection, prayerSuggestion, onApply }: {
  selection?: BibleSelection;
  date?: string;
  reflection: string;
  prayerSuggestion: string;
  onApply(patch: { reflection?: string; prayerSuggestion?: string }): void;
}) {
  const app = useApp();
  const system = app.repository?.system;
  const titleId = useId();
  const dockRef = useRef<HTMLDivElement>(null);
  const balloonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [focus, setFocus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ reflection?: string; prayerSuggestion?: string } | null>(null);
  const ready = Boolean(selection || date);
  useEffect(() => {
    if (!system) return;
    let active = true;
    system.peregrinoStatus().then(value => { if (active) setConfigured(value.configured); }).catch(() => { if (active) setConfigured(null); });
    return () => { active = false; };
  }, [system]);
  useEffect(() => {
    if (!open) return;
    balloonRef.current?.querySelector<HTMLElement>("button, textarea, a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      dockRef.current?.querySelector<HTMLButtonElement>(".peregrino-launcher")?.focus();
    };
  }, [open]);
  if (!system) return null;
  async function suggest(target: PeregrinoTarget) {
    setBusy(true); setError(""); setDraft(null);
    try {
      setDraft(await system!.peregrinoSuggest({
        selection: selection ? peregrinoSelection(selection) : undefined, date, reflection, prayerSuggestion, target,
        ...(focus.trim() ? { focus: focus.trim() } : {}),
      }));
    } catch (cause) { setError(validationMessage(cause)); }
    finally { setBusy(false); }
  }
  return (
    <div className="peregrino-dock" ref={dockRef}>
      {open && (
        <div className="peregrino-balloon" role="dialog" aria-labelledby={titleId} ref={balloonRef}>
          <p id={titleId} className="peregrino-greeting">Peregrino</p>
          {configured === false && (
            <p role="status">Ainda não há chave. {app.localProfile?.superuser || app.pilotAccess?.superuser ? <Link to="/sistema/peregrino">Informar a chave</Link> : "Peça a um superusuário para informar a chave do OpenRouter."}</p>
          )}
          {configured !== false && !ready && (
            <p role="status">Escolha o trecho na Bíblia. Eu preparo a meditação e a oração a partir dele.</p>
          )}
          {configured && ready && !draft && !busy && (
            <>
              <p>O que você quer que eu prepare? A meditação fica em até 500 caracteres e a oração em até 250. O texto passa por escrita, conferência, humanização e revisão antes de chegar aqui.</p>
              <div className="peregrino-questions">
                {questions.map(question => (
                  <Button key={question.target} type="button" variant="secondary" onClick={() => void suggest(question.target)}>{question.label}</Button>
                ))}
              </div>
              <label className="field">
                <span>Enfoque, se quiser</span>
                <textarea rows={2} maxLength={160} value={focus} placeholder="Por exemplo: acolher quem está cansado" onChange={event => setFocus(event.target.value)} />
              </label>
            </>
          )}
          {busy && <p role="status">Estou lendo o trecho e preparando o rascunho.</p>}
          {error && <ErrorMessage message={error} />}
          {draft && (
            <>
              {draft.reflection && <p>{draft.reflection}</p>}
              {draft.prayerSuggestion && <p>{draft.prayerSuggestion}</p>}
              <div className="peregrino-questions">
                <Button type="button" onClick={() => { onApply(draft); setDraft(null); setOpen(false); }}>Usar sugestão</Button>
                <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Pedir de outro jeito</Button>
              </div>
            </>
          )}
        </div>
      )}
      <IconButton type="button" className="peregrino-launcher" aria-label="Peregrino" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Feather size={22} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
