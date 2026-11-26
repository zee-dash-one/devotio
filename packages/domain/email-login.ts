import { z } from "zod";

export const emailCodeLength = 6;
export const emailCodeLifetimeSeconds = 300;
export const emailCodeAttempts = 3;
export const emailLoginLimit = { requests: 5, perMinutes: 10 } as const;

export const emailLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(160, "Use até 160 caracteres."),
});
export const emailCodeSchema = z.string().trim().regex(/^\d{6}$/, "Digite os 6 números do código.");
export const emailLoginDestinationMessage = "Se este e-mail puder entrar, enviamos um código de 6 números. Ele vale por 5 minutos. Confira também o spam.";

/** Generic text: the answer is identical whether or not the account exists. */
export function emailCodeMessage(code: string) {
  const minutes = emailCodeLifetimeSeconds / 60;
  return {
    subject: `Seu código de acesso Devotio: ${code}`,
    text: `Seu código de acesso ao Devotio é ${code}.\n\nEle vale por ${minutes} minutos e só pode ser usado uma vez. Se você não pediu este código, ignore esta mensagem.`,
    html: `<p>Seu código de acesso ao Devotio é:</p><p style="font-size:28px;letter-spacing:6px"><strong>${code}</strong></p><p>Ele vale por ${minutes} minutos e só pode ser usado uma vez. Se você não pediu este código, ignore esta mensagem.</p>`,
  };
}

export interface EmailLogin {
  /** False when the server cannot send mail yet, so the page does not promise a code. */
  available(): Promise<boolean>;
  /** Sends a code. Local development returns it so the page can show it. */
  request(email: string): Promise<{ devCode?: string }>;
  verify(email: string, code: string): Promise<void>;
}
