import { useState } from "react";
import { useApp } from "../context";
import { Brand, ErrorMessage } from "../components";
import { Button } from "../ui/button";
export function AccessWaitPage() {
  const app = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="page narrow">
      <Brand />
      <h1>
        {app.pilotAccess?.status === "disabled"
          ? "Sua conta está desativada."
          : app.accessError
            ? "Não foi possível verificar seu acesso."
            : "Seu cadastro está aguardando aprovação."}
      </h1>
      <p>
        {app.pilotAccess?.status === "disabled"
          ? "Se precisar voltar a participar, procure o responsável pelo piloto. Seus dados foram preservados."
          : "Estamos liberando a entrada aos poucos durante os testes. Você poderá continuar quando o responsável aprovar seu cadastro."}
      </p>
      {(app.accessError || error) && (
        <ErrorMessage message={error || app.accessError!} />
      )}
      <div className="admin-actions">
        <Button onClick={app.refreshAccess}>Consultar novamente</Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await app.onLogout();
            } catch {
              setError("Não foi possível sair. Tente novamente.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Sair da conta
        </Button>
      </div>
    </main>
  );
}
