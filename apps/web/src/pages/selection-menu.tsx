import { IconButton, Button } from "../ui/button";
import { useMemo, useRef, useState } from "react";
import {
  Share2,
  Users,
  PenLine,
  X,
  Send,
  ArrowRight,
  ArrowLeft,
  Eraser,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useRepository, useWatch } from "domain/react";
import {
  canManage,
  canPublish,
  devotionalSelectionSchema,
  editorialDraft,
  quoteText,
  validationMessage,
  type BibleQuote,
} from "domain/core";
import { useApp, useWriting } from "../context";
import { useSelectionDrawerGestures } from "../selection-drawer-gestures";
import { ShareToFriends } from "../social";
import { isMobileViewport } from "../media";

export function SelectionMenu({
  quote,
  onClear,
  onSwipe,
}: {
  quote: BibleQuote;
  onClear: () => void;
  onSwipe: () => void;
}) {
  const repo = useRepository(),
    app = useApp(),
    navigate = useNavigate();
  const { setEditor, setPicker } = useWriting();
  const groups = useWatch(useMemo(() => repo.watchCommunities(), [repo]));
  const managed = groups.data?.filter((group) => canManage(group.role)) ?? [];
  const [choosing, setChoosing] = useState(false),
    [groupIds, setGroupIds] = useState<string[]>([]);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [message, setMessage] = useState(""),
    [manualCopy, setManualCopy] = useState(false),
    [sharing, setSharing] = useState(false);
  const payload = quoteText(quote);
  const [collapsed, setCollapsed] = useState(() => isMobileViewport());
  const [friendsOpen, setFriendsOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useSelectionDrawerGestures(panel, collapsed, setCollapsed, onSwipe);
  return (
    <aside
      ref={panel}
      className={`selection-menu${collapsed ? " selection-menu-collapsed" : ""}`}
      data-state={collapsed ? "collapsed" : "expanded"}
      aria-label="Ações dos versículos selecionados"
      onMouseDown={(event) => {
        if (!(event.target as Element).closest("dialog") && (event.target as Element).closest("button")) event.preventDefault();
      }}
    >
      <div className="selection-menu-controls">
        <IconButton
          variant="ghost"
          aria-label="Fechar seleção"
          title="Fechar seleção"
          onClick={onClear}
        >
          <X size={18} />
        </IconButton>
        <IconButton
          variant="ghost"
          aria-label={
            collapsed ? "Expandir menu de seleção" : "Contrair menu de seleção"
          }
          title={collapsed ? "Expandir menu" : "Contrair menu"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
        </IconButton>
      </div>
      <div className="selection-menu-heading" hidden={collapsed}>
        <p>{quote.reference}</p>
        <p className="caption">{quote.versionName}</p>
      </div>
      <Button
        variant="ghost"
        className="selection-action"
        aria-label="Compartilhar"
        title={collapsed ? "Compartilhar" : undefined}
        disabled={sharing}
        onClick={async () => {
          setMessage("");
          setSharing(true);
          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(payload);
              setMessage("Trecho copiado para compartilhar.");
            } else {
              setCollapsed(false);
              setManualCopy(true);
              setMessage("Copie o texto abaixo para compartilhar.");
            }
          } catch (error) {
            if (!(
              error instanceof DOMException && error.name === "AbortError"
            )) {
              setCollapsed(false);
              setManualCopy(true);
              setMessage("Copie o trecho abaixo para compartilhar.");
            }
          } finally {
            setSharing(false);
          }
        }}
      >
        <Share2 size={20} />
        <span hidden={collapsed}>Compartilhar</span>
      </Button>
      {managed.length > 0 && repo.sharing && (
        <Button
          variant="ghost"
          className="selection-action"
          aria-label="Enviar para comunidade"
          title={collapsed ? "Enviar para comunidade" : undefined}
          onClick={() => {
            setCollapsed(false);
            setChoosing((value) => (collapsed ? true : !value));
            if (!groupIds.length) setGroupIds([managed[0].id]);
          }}
        >
          <Users size={20} />
          <span hidden={collapsed}>Enviar para comunidade</span>
        </Button>
      )}
      {repo.social && <Button variant="ghost" className="selection-action" aria-label="Enviar para amigos" onClick={() => setFriendsOpen(true)}><Send size={20} /><span hidden={collapsed}>Enviar para amigos</span></Button>}
      {friendsOpen && repo.social && <ShareToFriends key={`${quote.version}:${quote.book}:${quote.chapter}:${quote.first}:${quote.last}`} social={repo.social} quote={quote} onClose={() => setFriendsOpen(false)} />}
      {choosing && (
        <div className="selection-destinations" hidden={collapsed}>
          <fieldset>
            <legend>Comunidades administradas</legend>
            {managed.map((group) => (
              <label key={group.id}>
                <input
                  type="checkbox"
                  checked={groupIds.includes(group.id)}
                  onChange={(event) =>
                    setGroupIds((ids) =>
                      event.target.checked
                        ? [...ids, group.id]
                        : ids.filter((id) => id !== group.id),
                    )
                  }
                />
                {group.name}
              </label>
            ))}
          </fieldset>
          <Button
            size="compact"
            disabled={sharing || !groupIds.length}
            onClick={async () => {
              setSharing(true);
              setMessage("");
              try {
                if (request.current?.payload !== payload)
                  request.current = { payload, id: crypto.randomUUID() };
                await repo.sharing!.saveDrafts(
                  groupIds,
                  quote,
                  request.current.id,
                );
                setMessage(
                  `Rascunho salvo em ${groupIds.length} ${groupIds.length === 1 ? "comunidade" : "comunidades"}. Abra Escrever no mural para continuar.`,
                );
                setChoosing(false);
              } catch (error) {
                setMessage(validationMessage(error));
              } finally {
                setSharing(false);
              }
            }}
          >
            <Send size={17} />
            Enviar
          </Button>
        </div>
      )}
      {(canPublish(app.localProfile?.editorial) || app.pilotAccess?.editorial) && (
        <Button
          variant="ghost"
          className="selection-action"
          aria-label="Enviar para devocional"
          title={collapsed ? "Criar devocional" : undefined}
          onClick={() => {
            try {
              devotionalSelectionSchema.parse({
                scripture: quote.text,
                reference: quote.reference,
              });
              setEditor("new", editorialDraft(undefined, quote));
              setPicker({
                target: { kind: "devotional", key: "new" },
                book: quote.book,
                chapter: quote.chapter,
                selection: quote,
                query: "",
              });
              void navigate({
                to: "/editorial/cadastro",
                search: { date: undefined },
              });
            } catch (error) {
              setCollapsed(false);
              setMessage(
                "Reduza a seleção para o limite de Palavra (6.000 caracteres). " +
                  validationMessage(error),
              );
            }
          }}
        >
          <PenLine size={20} />
          <span hidden={collapsed}>Criar devocional</span>
        </Button>
      )}
      <Button
        variant="ghost"
        className="selection-action"
        aria-label="Limpar seleção"
        title={collapsed ? "Limpar seleção" : undefined}
        onClick={onClear}
      >
        <Eraser size={20} />
        <span hidden={collapsed}>Limpar seleção</span>
      </Button>
      {message && (
        <p role="status" className={collapsed ? "sr-only" : undefined}>
          {message}
        </p>
      )}
      {manualCopy && (
        <textarea
          hidden={collapsed}
          className="share-copy"
          aria-label="Texto para compartilhar"
          readOnly
          value={payload}
          onMouseDown={(event) => event.stopPropagation()}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </aside>
  );
}
