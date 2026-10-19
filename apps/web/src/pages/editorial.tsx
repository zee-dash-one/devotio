import { buttonClassName, Button } from "../ui/button";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useRepository, useWatch } from "domain/react";
import {
  canPublish,
  validationMessage,
  type ReadingRepository,
} from "domain/core";
import { useApp, useWriting } from "../context";
import { Empty, ErrorMessage, Loading } from "../components";
import { ConnectedEditorialPage } from "./connected-editorial";
export function EditorialPage() {
  const app = useApp(),
    repository = useRepository();
  if (app.connectedEditorial && app.pilotAccess?.editorial) return <ConnectedEditorialPage editorial={app.connectedEditorial} />;
  if (!canPublish(app.localProfile?.editorial) || !repository.reading)
    return <Empty title="Acesso exclusivo do Gestor do sistema." />;
  return <Editorial reading={repository.reading} />;
}
function Editorial({ reading }: { reading: ReadingRepository }) {
  const state = useWatch(useMemo(() => reading.watchEditorial(), [reading]));
  const { setEditor, setPicker } = useWriting();
  const [removing, setRemoving] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="page editorial-page">
      <h1>Devocionais</h1>
      <p>
        Crie em datas livres. Para alterar uma publicação, use Editar existente.
      </p>
      <Link
        className={buttonClassName({})}
        to="/editorial/cadastro"
        search={{ date: undefined }}
        onClick={() => {
          setEditor("new", null);
          setPicker(null);
        }}
      >
        Cadastrar devocional
      </Link>
      {message && <p role="status">{message}</p>}
      {state.error ? (
        <ErrorMessage message={state.error} />
      ) : !state.data ? (
        <Loading />
      ) : (
        <div className="editorial-list">
          {state.data.map((entry) => (
            <article key={entry.devotional.date}>
              <div>
                <p>
                  {entry.devotional.date} ·{" "}
                  {entry.withdrawn
                    ? "Retirado"
                    : entry.publishedAt > Date.now()
                      ? "Programado"
                      : "Disponível"}
                </p>
                <p>{entry.devotional.reference}</p>
              </div>
              <div className="editorial-actions">
                <Link
                  className={buttonClassName({
                    variant: "secondary",
                    size: "compact",
                  })}
                  to="/editorial/cadastro"
                  search={{ date: entry.devotional.date }}
                >
                  Editar existente
                </Link>
                <Button
                  variant="ghost"
                  disabled={entry.withdrawn || busy}
                  onClick={() => { setRemoving(entry.devotional.date); setWithdrawReason(""); }}
                >
                  Excluir / retirar
                </Button>
              </div>
              {removing === entry.devotional.date && (
                <div>
                  <p>
                    Retirar o devocional de {removing}? Favoritos salvos e
                    histórico serão preservados; a data continuará reservada.
                  </p>
                  <label>Motivo da retirada<input required maxLength={1000} value={withdrawReason} onChange={event => setWithdrawReason(event.target.value)} /></label>
                  <p className="caption">O motivo fica no histórico administrativo e não aparece no devocional.</p>
                  <Button
                    variant="secondary"
                    size="compact"
                    disabled={busy || !withdrawReason.trim()}
                    onClick={async () => {
                      setBusy(true);
                      setMessage("");
                      try {
                        await reading.withdraw(
                          entry.devotional.date,
                          withdrawReason,
                        );
                        setRemoving(null);
                        setMessage("Devocional retirado.");
                      } catch (error) {
                        setMessage(validationMessage(error));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Confirmar retirada
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setRemoving(null)}
                  >
                    Cancelar retirada
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
