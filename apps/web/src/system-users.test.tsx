import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Repository, SystemDirectoryUser, SystemRepository } from "domain/core";
import { AppContext, type AppContextValue } from "./context";
import { SystemUsersPage } from "./pages/system-users";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const people: SystemDirectoryUser[] = [
  { id: "rui", name: "Rui Leitor", email: "rui@example.com", status: "approved", editorial: false, superuser: false, linked: true },
  { id: "eva", name: "Eva Editora", email: "eva@example.com", status: "approved", editorial: true, superuser: false, linked: true },
  { id: "ana", name: "Ana Admin", email: "ana@example.com", status: "approved", editorial: true, superuser: true, linked: true },
  { id: "hil", name: "Hilderney Couto", email: "hil@example.com", status: "approved", editorial: true, superuser: true, linked: true },
  { id: "pia", name: "Pia Pedido", email: "pia@example.com", status: "pending", editorial: false, superuser: false, linked: true },
];

function setup() {
  const setUserRole = vi.fn().mockResolvedValue(undefined);
  const system = { listUsers: vi.fn().mockResolvedValue(people), setUserRole, setUserStatus: vi.fn(), deleteUser: vi.fn() } as unknown as SystemRepository;
  const value = { repository: { system } as unknown as Repository, pilotAccess: { status: "approved", editorial: true, superuser: true }, configured: true, loading: false, userKey: "me", onLogin: vi.fn(), onLogout: vi.fn() } as unknown as AppContextValue;
  render(<AppContext.Provider value={value}><SystemUsersPage /></AppContext.Provider>);
  return { setUserRole };
}
const row = async (name: string) => (await screen.findByText(name)).closest("li")!;

describe("gerenciar usuários", () => {
  it("promove e rebaixa editorial e superusuário pelos botões", async () => {
    const { setUserRole } = setup();
    const rui = await row("Rui Leitor");
    expect(rui.textContent).toContain("Tornar editorial");
    expect(rui.textContent).toContain("Tornar superusuário");
    fireEvent.click(screen.getAllByRole("button", { name: "Tornar editorial" })[0]);
    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith("rui", "editorial", true));
    fireEvent.click(screen.getByRole("button", { name: "Remover editorial" }));
    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith("eva", "editorial", false));
    const removeSuper = screen.getAllByRole("button", { name: "Remover superusuário" });
    expect(removeSuper).toHaveLength(1);
    fireEvent.click(removeSuper[0]);
    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith("ana", "superuser", false));
  });
  it("esconde ações impossíveis: editorial de superusuário, rebaixar o responsável e papéis de pendentes", async () => {
    setup();
    const ana = await row("Ana Admin");
    expect(ana.textContent).not.toContain("editorial");
    const hil = await row("Hilderney Couto");
    expect(hil.textContent).not.toContain("Remover superusuário");
    const pia = await row("Pia Pedido");
    expect(pia.textContent).not.toContain("Tornar");
  });
});
