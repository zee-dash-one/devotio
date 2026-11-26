const emailLoginMessages: Record<string, string> = {
  INVALID_OTP: "Código inválido ou expirado. Peça um novo.",
  OTP_EXPIRED: "Código inválido ou expirado. Peça um novo.",
  TOO_MANY_ATTEMPTS: "Muitas tentativas. Peça um novo código.",
};
export function emailLoginError(error: { code?: string; status?: number }) {
  if (error.code && emailLoginMessages[error.code]) return emailLoginMessages[error.code];
  if (error.status === 429) return "Muitos pedidos de código. Aguarde alguns minutos e tente de novo.";
  return "Não foi possível usar o e-mail agora. Tente novamente em instantes.";
}
