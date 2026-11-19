import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AdministrationPage } from "./pages/administration";
import { AccessWaitPage } from "./pages/access-wait";
import { AppContext, type AppContextValue } from "./context";
import type { Administration, AdminPage } from "domain/core";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function context(administration?: Administration): AppContextValue {
  return {
    administration,
    repository: null,
    configured: true,
    loading: false,
    userKey: "guest",
    onLogin: vi.fn(),
    onLogout: vi.fn(async () => {}),
  };
}
function service() {
  const page: AdminPage = {
    users: [
      {
        id: "u1",
        name: "Ana",
        email: "ana@example.com",
        status: "pending",
        editorial: false,
        linked: true,
      },
    ],
    cursor: null,
    approvalRequired: true,
  };
  const api: Administration = {
    login: vi.fn(async () => ({
      token: "test-token",
      expiresAt: Date.now() + 1800000,
    })),
    logout: vi.fn(async () => {}),
    list: vi.fn(async () => page),
    create: vi.fn(async () => "u2"),
    update: vi.fn(async () => {}),
    setApproval: vi.fn(async () => {}),
    communities: vi.fn(async () => ({ communities: [], cursor: null })),
    setCommunity: vi.fn(async () => {}),
  };
  return api;
}
async function enter() {
  fireEvent.change(screen.getByLabelText("Login (e-mail)"), {
    target: { value: "owner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "password-test" },
  });
  fireEvent.change(screen.getByLabelText("Código do autenticador"), {
    target: { value: "012345" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByRole("table");
}
describe("painel de acesso", () => {
  it("exige os fatores, não persiste token e só desativa após confirmação", async () => {
    const api = service();
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(
      <AppContext.Provider value={context(api)}>
        <AdministrationPage />
      </AppContext.Provider>,
    );
    expect(
      document.head
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content"),
    ).toContain("noindex");
    await enter();
    expect(api.login).toHaveBeenCalledWith({
      login: "owner@example.com",
      password: "password-test",
      code: "012345",
    });
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(api.update).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "dados serão preservados",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar desativação" }),
    );
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith("test-token", {
        id: "u1",
        name: "Ana",
        editorial: false,
        status: "disabled",
      }),
    );
    expect(storage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sair do painel" }));
    await screen.findByLabelText("Senha");
    expect(api.logout).toHaveBeenCalledWith("test-token");
    expect(screen.queryByRole("table")).toBeNull();
  });
  it("cria pré-cadastro e mostra falha do servidor sem declarar sucesso", async () => {
    const api = service();
    vi.mocked(api.create).mockRejectedValue(new Error("E-mail já cadastrado."));
    render(
      <AppContext.Provider value={context(api)}>
        <AdministrationPage />
      </AppContext.Provider>,
    );
    await enter();
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Eva" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "eva@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "E-mail já cadastrado",
    );
    expect(screen.queryByText("Cadastro salvo.")).toBeNull();
  });
  it("não oferece entrada fictícia quando Convex não está configurado", () => {
    render(
      <AppContext.Provider value={context()}>
        <AdministrationPage />
      </AppContext.Provider>,
    );
    expect(screen.queryByLabelText("Senha")).toBeNull();
    expect(screen.getByText(/precisa da conexão/)).toBeTruthy();
  });
  it("mostra espera, desativação e saída sem montar conteúdo protegido", async () => {
    const app = {
      ...context(),
      pilotAccess: { status: "pending" as const, editorial: false },
      refreshAccess: vi.fn(),
    };
    const view = render(
      <AppContext.Provider value={app}>
        <AccessWaitPage />
      </AppContext.Provider>,
    );
    expect(screen.getByRole("heading").textContent).toContain(
      "aguardando aprovação",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Consultar novamente" }),
    );
    expect(app.refreshAccess).toHaveBeenCalled();
    view.rerender(
      <AppContext.Provider
        value={{ ...app, pilotAccess: { status: "disabled", editorial: true } }}
      >
        <AccessWaitPage />
      </AppContext.Provider>,
    );
    expect(screen.getByRole("heading").textContent).toContain("desativada");
    fireEvent.click(screen.getByRole("button", { name: "Sair da conta" }));
    await waitFor(() => expect(app.onLogout).toHaveBeenCalled());
  });
});
