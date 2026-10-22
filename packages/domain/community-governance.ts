import type { Role, Watch } from "./types";
export { communityCreationSchema, roleSchema, joinDecisionSchema, joinStateSchema, memberRoleSchema } from "./validators/community";
export interface CreationPermission { allowed: boolean; limit: number; owned: number; canCreate: boolean }
export function canCreateCommunity(input: { allowed: boolean; limit: number; owned: number }) {
  return input.allowed && input.owned < input.limit;
}
export function canDecideJoin(role: Role) { return role === "owner" || role === "admin"; }
export function canChangeRole(actor: Role, target: Role, next: Role) {
  return target !== "owner" && next !== "owner" &&
    (actor === "owner" || (actor === "admin" && target === "member" && next === "admin"));
}
export const roleLabels: Record<Role, string> = { owner: "Responsável", admin: "Administrador", member: "Membro" };
export const joinStateLabels = { pending: "Aguardando aprovação", approved: "Aprovado", rejected: "Recusado", cancelled: "Cancelado" };
export interface JoinRequest {
  id: string; communityId: string; communityName: string; userId: string; name: string;
  state: keyof typeof joinStateLabels; requestedAt: number;
}
export interface JoinRequestPage { items: JoinRequest[]; cursor: string | null }
export interface CommunityGovernance {
  watchCreation(): Watch<CreationPermission>;
  watchMine(cursor: string | null): Watch<JoinRequestPage>;
  watchRequests(id: string, cursor: string | null): Watch<JoinRequestPage>;
  cancel(requestId: string): Promise<void>;
  decide(requestId: string, decision: "approve" | "reject"): Promise<void>;
  setRole(id: string, memberId: string, role: "admin" | "member"): Promise<void>;
  leave(id: string): Promise<void>;
  transfer(id: string, memberId: string): Promise<void>;
}
