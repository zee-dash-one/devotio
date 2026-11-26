import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailLogin } from "domain/core";
import { EmailLoginForm } from "./pages/email-login";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setup(devCode?: string, available = true) {
  const login: EmailLogin = { available: vi.fn().mockResolvedValue(available), request: vi.fn().mockResolvedValue(devCode ? { devCode } : {}), verify: vi.fn().mockResolvedValue(undefined) };
  render(<EmailLoginForm login={login} />);
  return login;
}
const ready = () => screen.findByLabelText("E-mail");
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("entrada por e-mail", () => {
  it("pede o código com o e-mail normalizado e confirma com os 6 números", async () => {
    const login = setup();
    await ready();
    type("E-mail", "  Ana@Example.com ");
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByText(/Se este e-mail puder entrar/);
    expect(login.request).toHaveBeenCalledWith("ana@example.com");
    expect(screen.queryByText(/Ambiente local/)).toBeNull();
    const enter = screen.getByRole("button", { name: "Entrar" }) as HTMLButtonElement;
    expect(enter.disabled).toBe(true);
    type("Código de 6 números", "48a2913x");
    expect((screen.getByLabelText("Código de 6 números") as HTMLInputElement).value).toBe("482913");
    fireEvent.click(enter);
    await waitFor(() => expect(login.verify).toHaveBeenCalledWith("ana@example.com", "482913"));
  });
  it("mostra o código de desenvolvimento só no ambiente local e deixa trocar o e-mail", async () => {
    setup("123456");
    await ready();
    type("E-mail", "ana@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByText("Ambiente local: o código é 123456.");
    fireEvent.click(screen.getByRole("button", { name: "Trocar e-mail" }));
    expect(screen.getByLabelText("E-mail")).toBeDefined();
  });
  it("recusa e-mail inválido sem chamar o servidor e mostra o erro do servidor", async () => {
    const login = setup();
    await ready();
    type("E-mail", "sem-arroba");
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByRole("alert");
    expect(login.request).not.toHaveBeenCalled();
    vi.mocked(login.request).mockRejectedValueOnce(new Error("Muitos pedidos de código. Aguarde alguns minutos e tente de novo."));
    type("E-mail", "ana@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByText(/Muitos pedidos de código/);
  });
  it("não mostra o formulário quando o servidor ainda não envia e-mail", async () => {
    const login = setup(undefined, false);
    await waitFor(() => expect(login.available).toHaveBeenCalled());
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar código" })).toBeNull();
  });
});
