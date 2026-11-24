import { z } from "zod";
import type { AccessStatus } from "./administration";
import { hasApprovedAccess } from "./administration";

export const themesInputSchema = z.object({
  monthlyVerse: z.string().trim().min(1, "Informe o versículo do mês.").max(500, "Use até 500 caracteres."),
  monthlyReference: z.string().trim().min(1, "Informe a referência do mês.").max(160, "Use até 160 caracteres."),
  weeklyVerse: z.string().trim().min(1, "Informe o versículo da semana.").max(500, "Use até 500 caracteres."),
  weeklyReference: z.string().trim().min(1, "Informe a referência da semana.").max(160, "Use até 160 caracteres."),
});
export type ThemesInput = z.infer<typeof themesInputSchema>;
export const defaultThemes: ThemesInput = {
  monthlyVerse: "Um coração atento ao que permanece.",
  monthlyReference: "Tema ilustrativo do mês",
  weeklyVerse: "Caminhar com presença e cuidado.",
  weeklyReference: "Tema ilustrativo da semana",
};

export function canManageSystem(user: { status?: AccessStatus; superuser?: boolean }) {
  return hasApprovedAccess(user.status) && user.superuser === true;
}

/** Unique approved Google name used to grant the first superuser. Not an email. */
export function isNamedOwner(name: string) {
  const normalized = name.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return normalized === "hilderney" || normalized.startsWith("hilderney ");
}

export interface DeletionFacts {
  self: boolean;
  superuser: boolean;
  editorial: boolean;
  ownsCommunity: boolean;
  communityManager: boolean;
  hasCommunityMessages: boolean;
  hasScriptureShares: boolean;
  seedProfile: boolean;
  emailMatches: boolean;
}

export function userDeletionBlockers(facts: DeletionFacts): string | null {
  if (facts.self) return "Você não pode excluir a própria conta.";
  if (facts.superuser) return "Superusuários não podem ser excluídos por esta tela.";
  if (facts.editorial) return "Remova a gestão editorial no painel do responsável antes de excluir.";
  if (facts.ownsCommunity) return "Transfira a posse das comunidades antes de excluir.";
  if (facts.communityManager) return "Remova a administração nas comunidades antes de excluir.";
  if (facts.hasCommunityMessages) return "Esta pessoa tem recados em comunidades. Desative a conta em vez de excluir.";
  if (facts.hasScriptureShares) return "Esta pessoa tem trechos enviados a amigos. Desative a conta em vez de excluir.";
  if (facts.seedProfile) return "Perfis de demonstração não podem ser excluídos.";
  if (!facts.emailMatches) return "O e-mail digitado não confere.";
  return null;
}

export interface SystemDirectoryUser {
  id: string;
  name: string;
  email: string;
  status: AccessStatus;
  editorial: boolean;
  superuser: boolean;
  linked: boolean;
}

export interface SystemRepository {
  listUsers(): Promise<SystemDirectoryUser[]>;
  setUserStatus(id: string, status: "approved" | "disabled"): Promise<void>;
  deleteUser(id: string, confirmEmail: string): Promise<void>;
  getThemes(): Promise<ThemesInput>;
  setThemes(input: ThemesInput): Promise<void>;
  peregrinoKeyStatus(): Promise<{ configured: boolean }>;
  setOpenRouterKey(key: string): Promise<void>;
  clearOpenRouterKey(): Promise<void>;
  peregrinoStatus(): Promise<{ configured: boolean; model: string }>;
  peregrinoSuggest(input: { selection?: import("./sharing").BibleSelection; date?: string; reflection?: string; prayerSuggestion?: string; focus?: string; target: import("./peregrino").PeregrinoTarget }): Promise<{ reflection?: string; prayerSuggestion?: string; model: string }>;
  peregrinoStep(input: { selection?: import("./sharing").BibleSelection; date?: string; focus?: string; field: import("./peregrino").PeregrinoField; stage: import("./peregrino").PeregrinoStage; text?: string; notes?: string }): Promise<{ text: string; notes: string; thinking: string }>;
}
