import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { Send, Mail, UserPlus, Copy } from "lucide-react";
import { useRepository, useWatch } from "domain/react";
import {
  filterFriends,
  friendCodeSchema,
  shareInputSchema,
  shareFingerprint,
  validationMessage,
  type BibleQuote,
  type Friend,
  type FriendsData,
  type ShareFilter,
  type ShareMarker,
  type ShareChapter,
  type SocialRepository,
  type Watch,
} from "domain/core";
import { ActionForm, ErrorMessage, Loading, Modal } from "./components";
import { Button, IconButton } from "./ui/button";
import { Quote } from "./quote";
import "./styles/social.css";

const unavailable: Watch<FriendsData> = (next) => {
  next({ userId: "", code: null, friends: [] });
  return () => {};
};
export function useFriends(social: SocialRepository | undefined) {
  return useWatch(
    useMemo(() => social?.watchFriends() ?? unavailable, [social]),
  );
}
function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const running = useRef(false);
  async function run(action: () => Promise<unknown>, success = "") {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (cause) {
      setError(validationMessage(cause));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    run,
    feedback: (
      <>
        {error && <ErrorMessage message={error} />}
        {message && <p role="status">{message}</p>}
      </>
    ),
  };
}
export function ProfilePage() {
  const { social } = useRepository();
  return (
    <div className="page narrow social-profile">
      <h1>Meu perfil</h1>
      {social ? (
        <>
          <FriendsPanel social={social} />
          <section aria-label="Meus trechos compartilhados">
            <h2>Trechos compartilhados</h2>
            <ShareHistory social={social} />
          </section>
        </>
      ) : (
        <p>Amizades estão disponíveis ao entrar em uma conta.</p>
      )}
    </div>
  );
}
function FriendsPanel({ social }: { social: SocialRepository }) {
  const state = useFriends(social),
    action = useAction();
  const [search, setSearch] = useState(""),
    [code, setCode] = useState(""),
    [removing, setRemoving] = useState<Friend | null>(null);
  const [requested, setRequested] = useState(false);
  if (state.error) return <ErrorMessage message={state.error} />;
  if (!state.data) return <Loading />;
  const { friends } = state.data;
  const filtered = filterFriends(friends, search);
  return (
    <section aria-label="Amigos">
      <h2>Amigos</h2>
      <div className="social-invite">
        <p>Compartilhe seu código para receber um convite de amizade.</p>
        {state.data.code && (
          <div className="social-code">
            <code>{state.data.code}</code>
            <Button
              variant="ghost"
              onClick={() =>
                void action.run(async () => {
                  if (!navigator.clipboard?.writeText)
                    throw new Error("Selecione e copie o código exibido.");
                  await navigator.clipboard.writeText(state.data!.code!);
                }, "Código copiado.")
              }
            >
              <Copy size={16} />
              Copiar código
            </Button>
          </div>
        )}
        <Button
          variant="secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(
              () => social.rotateCode(),
              "Código atualizado. O anterior deixou de funcionar.",
            )
          }
        >
          {state.data.code ? "Gerar novo código" : "Gerar meu código"}
        </Button>
      </div>
      <ActionForm
        label="Enviar convite"
        onSubmit={async () => {
          await social.request({
            kind: "code",
            code: friendCodeSchema.parse(code),
          });
          setCode("");
          setRequested(true);
        }}
      >
        <SocialField label="Código de um amigo">
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setRequested(false);
            }}
            maxLength={12}
            autoComplete="off"
            required
          />
        </SocialField>
      </ActionForm>
      {requested && (
        <p role="status">Convite registrado. Acompanhe os convites abaixo.</p>
      )}
      {action.feedback}
      <SocialField label="Buscar amigos e convites">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={100}
        />
      </SocialField>
      {(
        [
          ["incoming", "Convites recebidos"],
          ["outgoing", "Convites enviados"],
          ["friend", "Meus amigos"],
        ] as const
      ).map(([kind, title]) => (
        <section key={kind} aria-label={title}>
          <h3>{title}</h3>
          <ul className="social-list">
            {filtered
              .filter((friend) => friend.state === kind)
              .map((friend) => (
                <li key={friend.id}>
                  <span>
                    {friend.name}
                    {!friend.available && <small> · Conta indisponível</small>}
                  </span>
                  <div className="social-actions">
                    {kind === "incoming" && (
                      <Button
                        size="compact"
                        disabled={action.busy || !friend.available}
                        onClick={() =>
                          void action.run(
                            () =>
                              social.change({
                                id: friend.id,
                                action: "accept",
                              }),
                            "Amizade aceita.",
                          )
                        }
                      >
                        Aceitar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="compact"
                      disabled={action.busy}
                      onClick={() => {
                        if (kind === "friend") setRemoving(friend);
                        else
                          void action.run(
                            () =>
                              social.change({
                                id: friend.id,
                                action: "remove",
                              }),
                            kind === "incoming"
                              ? "Convite recusado."
                              : "Convite cancelado.",
                          );
                      }}
                    >
                      {kind === "friend"
                        ? "Remover amizade"
                        : kind === "incoming"
                          ? "Recusar"
                          : "Cancelar convite"}
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
          {!filtered.some((friend) => friend.state === kind) && (
            <p className="caption">
              {search
                ? "Nenhum resultado."
                : kind === "friend"
                  ? "Você ainda não adicionou amigos."
                  : "Nenhum convite."}
            </p>
          )}
        </section>
      ))}
      {removing && (
        <Modal title="Remover amizade" onClose={() => setRemoving(null)}>
          <p>
            Remover a amizade com {removing.name}? Os recados já enviados
            continuam disponíveis.
          </p>
          <ActionForm
            label="Confirmar remoção"
            onSubmit={async () => {
              await social.change({ id: removing.id, action: "remove" });
              setRemoving(null);
            }}
          />
        </Modal>
      )}
    </section>
  );
}
export function CommunityFriendButton({
  social,
  data,
  communityId,
  userId,
  name,
}: {
  social: SocialRepository;
  data: FriendsData;
  communityId: string;
  userId: string;
  name: string;
}) {
  const action = useAction();
  if (data.userId === userId) return null;
  const existing = data.friends.find((friend) => friend.userId === userId);
  return (
    <div className="community-friend">
      <Button
        variant="ghost"
        size="compact"
        disabled={action.busy || !!existing}
        aria-label={existing ? undefined : `Adicionar ${name} como amigo`}
        onClick={() =>
          void action.run(
            () => social.request({ kind: "community", communityId, userId }),
            "Convite enviado. Aguarde o aceite.",
          )
        }
      >
        <UserPlus size={16} />
        {existing?.state === "friend"
          ? "Amigo"
          : existing
            ? "Convite pendente"
            : "Adicionar amigo"}
      </Button>
      {existing?.state === "incoming" && (
        <Link to="/perfil">Revisar convite</Link>
      )}
      {action.feedback}
    </div>
  );
}
export function ShareToFriends({
  social,
  quote,
  onClose,
}: {
  social: SocialRepository;
  quote: BibleQuote;
  onClose: () => void;
}) {
  const state = useFriends(social),
    [search, setSearch] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [sent, setSent] = useState(false);
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  return (
    <Modal
      title={sent ? "Recado enviado" : "Enviar para amigos"}
      onClose={onClose}
    >
      {sent ? (
        <>
          <p role="status">O trecho e seu recado foram enviados.</p>
          <Button onClick={onClose}>Concluir</Button>
        </>
      ) : (
        <>
          <Quote quote={quote} onOpen={onClose} />
          {state.error ? (
            <ErrorMessage message={state.error} />
          ) : !state.data ? (
            <Loading />
          ) : (
            <ActionForm
              label="Enviar recado"
              onSubmit={async () => {
                const input = shareInputSchema.parse({
                  selection: quote,
                  recipientIds: ids,
                  message,
                  requestId: attempt.current?.id ?? crypto.randomUUID(),
                });
                const fingerprint = shareFingerprint(input);
                if (attempt.current?.fingerprint !== fingerprint)
                  attempt.current = { fingerprint, id: crypto.randomUUID() };
                await social.send({ ...input, requestId: attempt.current.id });
                setSent(true);
              }}
            >
              <SocialField label="Buscar destinatários">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxLength={100}
                />
              </SocialField>
              <fieldset className="friend-options">
                <legend>Amigos destinatários</legend>
                {filterFriends(state.data.friends, search)
                  .filter(
                    (friend) => friend.state === "friend" && friend.available,
                  )
                  .map((friend) => (
                    <label key={friend.id}>
                      <input
                        type="checkbox"
                        checked={ids.includes(friend.userId)}
                        onChange={(event) =>
                          setIds((current) =>
                            event.target.checked
                              ? [...current, friend.userId]
                              : current.filter((id) => id !== friend.userId),
                          )
                        }
                      />
                      {friend.name}
                    </label>
                  ))}
                {!state.data.friends.some(
                  (friend) => friend.state === "friend" && friend.available,
                ) && (
                  <p>
                    Adicione amigos no{" "}
                    <Link to="/perfil" onClick={onClose}>
                      Perfil
                    </Link>{" "}
                    para compartilhar.
                  </p>
                )}
              </fieldset>
              <p className="caption">
                {ids.length} selecionado(s) · até 20 amigos
              </p>
              <SocialField label="Seu recado">
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </SocialField>
            </ActionForm>
          )}
        </>
      )}
    </Modal>
  );
}
export function ShareHistory({
  social,
  filter = {},
  onOpen,
}: {
  social: SocialRepository;
  filter?: Omit<ShareFilter, "cursor">;
  onOpen?: () => void;
}) {
  const [cursor, setCursor] = useState<string | null>(null),
    [direction, setDirection] = useState<"sent" | "received">(
      filter.direction ?? "received",
    );
  const { chapter, first } = filter;
  const state = useWatch(
    useMemo(
      () => social.watchShares({ cursor, direction, chapter, first }),
      [
        social,
        cursor,
        direction,
        chapter?.version,
        chapter?.book,
        chapter?.chapter,
        first,
      ],
    ),
  );
  return (
    <div className="share-history">
      {!filter.direction && (
        <div className="social-actions">
          <Button
            variant={direction === "received" ? "primary" : "ghost"}
            onClick={() => {
              setDirection("received");
              setCursor(null);
            }}
          >
            Recebidos
          </Button>
          <Button
            variant={direction === "sent" ? "primary" : "ghost"}
            onClick={() => {
              setDirection("sent");
              setCursor(null);
            }}
          >
            Enviados
          </Button>
        </div>
      )}
      {state.error ? (
        <ErrorMessage message={state.error} />
      ) : !state.data ? (
        <Loading />
      ) : (
        <>
          {!state.data.items.length && (
            <p>
              Nenhum recado {direction === "sent" ? "enviado" : "recebido"}.
            </p>
          )}
          {state.data.items.map((item) => (
            <article key={item.id} className="share-card">
              <p>
                <strong>
                  {item.direction === "sent"
                    ? "Você enviou"
                    : `De ${item.senderName}`}
                </strong>
              </p>
              <p className="share-note">{item.message}</p>
              <Quote quote={item.quote} onOpen={onOpen} />
              {item.direction === "sent" && (
                <p>
                  Para:{" "}
                  {item.recipients?.map((person) => person.name).join(", ")}
                </p>
              )}
              <Link
                to="/biblia"
                search={{
                  book: item.quote.book,
                  chapter: item.quote.chapter,
                  verse: item.quote.first,
                  version: item.quote.version,
                }}
                onClick={onOpen}
              >
                Abrir {item.quote.reference}
              </Link>
            </article>
          ))}
          <div className="social-actions">
            {cursor && (
              <Button variant="ghost" onClick={() => setCursor(null)}>
                Mais recentes
              </Button>
            )}
            {state.data.nextCursor && (
              <Button
                variant="secondary"
                onClick={() => setCursor(state.data!.nextCursor)}
              >
                Mais antigos
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
const MarksContext = createContext<{
  markers: ShareMarker[];
  open: (marker: ShareMarker) => void;
} | null>(null);
export function ChapterMarks({
  social,
  chapter,
  children,
}: {
  social?: SocialRepository;
  chapter: ShareChapter;
  children: ReactNode;
}) {
  return social ? (
    <ActiveChapterMarks
      key={`${chapter.version}:${chapter.book}:${chapter.chapter}`}
      social={social}
      chapter={chapter}
    >
      {children}
    </ActiveChapterMarks>
  ) : (
    <>{children}</>
  );
}
function ActiveChapterMarks({
  social,
  chapter,
  children,
}: {
  social: SocialRepository;
  chapter: ShareChapter;
  children: ReactNode;
}) {
  const state = useWatch(
    useMemo(
      () => social.watchMarkers(chapter),
      [social, chapter.version, chapter.book, chapter.chapter],
    ),
  );
  const [opened, setOpened] = useState<ShareMarker | null>(null);
  return (
    <MarksContext.Provider
      value={{ markers: state.data ?? [], open: setOpened }}
    >
      {children}
      {state.error && (
        <ErrorMessage message="Não foi possível carregar as marcações deste capítulo. Reabra a leitura para tentar novamente." />
      )}
      {opened && (
        <Modal
          title={
            opened.direction === "sent"
              ? "Recados enviados"
              : "Recados recebidos"
          }
          onClose={() => setOpened(null)}
        >
          <ShareHistory
            social={social}
            filter={{
              chapter,
              first: opened.first,
              direction: opened.direction,
            }}
            onOpen={() => setOpened(null)}
          />
        </Modal>
      )}
    </MarksContext.Provider>
  );
}
export function VerseMarks({ number }: { number: number }) {
  const context = useContext(MarksContext),
    markers =
      context?.markers.filter((marker) => marker.first === number) ?? [];
  if (!markers.length) return null;
  return (
    <span className="verse-marks">
      {markers.map((marker) => (
        <IconButton
          key={marker.direction}
          variant="ghost"
          className={`verse-mark verse-mark-${marker.direction}`}
          aria-label={`${marker.direction === "sent" ? "Recados enviados" : "Recados recebidos"} a partir do versículo ${number}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            context?.open(marker);
          }}
        >
          {marker.direction === "sent" ? (
            <Send size={16} />
          ) : (
            <Mail size={16} />
          )}
        </IconButton>
      ))}
    </span>
  );
}

function SocialField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
