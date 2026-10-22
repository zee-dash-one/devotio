import type { Role } from "./types";
export function canManage(role: Role | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
export function canRemoveMember(role: Role, adminCount: number, actor: Role = "owner"): boolean {
  return role !== "owner" && canManage(actor) &&
    (role === "member" || (actor === "owner" && adminCount > 1));
}
export function isPublished(
  publishedAt: number,
  withdrawn: boolean,
  now: number,
): boolean {
  return !withdrawn && publishedAt <= now;
}
export function localDate(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date + "T12:00:00"));
}
export function formatMessageDate(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
export function tickChange(
  exists: boolean,
  desired: boolean,
): "insert" | "delete" | "none" {
  return exists === desired ? "none" : desired ? "insert" : "delete";
}
export const copy = {
  emptyDevotional:
    "O devocional de hoje ainda não foi publicado. Volte em breve.",
  network:
    "Não foi possível carregar. Verifique sua conexão e tente novamente.",
  audioError: "Não foi possível carregar o áudio.",
  revoked: "Esta comunidade não está disponível para sua conta.",
  lastAdmin: "Não é possível remover o único administrador da comunidade.",
};
