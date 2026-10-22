import type { z } from "zod";
import type {
  adminListSchema,
  adminLoginSchema,
  managedUserSchema,
  updateManagedUserSchema,
  communityPermissionSchema,
} from "./validators/administration";
export type AccessStatus = "pending" | "approved" | "disabled";
export const accessLabels: Record<AccessStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  disabled: "Desativado",
};
export function effectiveAccess(status?: AccessStatus): AccessStatus {
  return status ?? "approved";
}
export function hasApprovedAccess(status?: AccessStatus) {
  return effectiveAccess(status) === "approved";
}
export function initialAccess(
  approvalRequired: boolean,
  existing: boolean,
): AccessStatus {
  return existing || !approvalRequired ? "approved" : "pending";
}
export function canManageEditorial(user: {
  status?: AccessStatus;
  editorial?: boolean;
}) {
  return hasApprovedAccess(user.status) && user.editorial === true;
}
export interface AccessState {
  status: AccessStatus;
  editorial: boolean;
  canCreateCommunity?: boolean;
  communityLimit?: number;
}
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  status: AccessStatus;
  editorial: boolean;
  linked: boolean;
  communityCreation?: import("./community-governance").CreationPermission;
}
export interface AdminSession {
  token: string;
  expiresAt: number;
}
export interface AdminPage {
  users: ManagedUser[];
  cursor: string | null;
  approvalRequired: boolean;
}
export interface CommunityPermission {
  id: string;
  name: string;
  role: "owner" | "admin" | "member" | "none";
}
export interface Administration {
  setCommunityCreation?(token: string, input: { userId: string; allowed: boolean; limit?: number }): Promise<void>;
  login(input: z.input<typeof adminLoginSchema>): Promise<AdminSession>;
  logout(token: string): Promise<void>;
  list(
    token: string,
    input: z.input<typeof adminListSchema>,
  ): Promise<AdminPage>;
  create(
    token: string,
    input: z.input<typeof managedUserSchema>,
  ): Promise<string>;
  update(
    token: string,
    input: z.input<typeof updateManagedUserSchema>,
  ): Promise<void>;
  setApproval(token: string, required: boolean): Promise<void>;
  communities(
    token: string,
    userId: string,
    cursor: string | null,
  ): Promise<{ communities: CommunityPermission[]; cursor: string | null }>;
  setCommunity(
    token: string,
    input: z.input<typeof communityPermissionSchema>,
  ): Promise<void>;
}
export interface ConnectedPublication {
  id: string;
  date: string;
  reference: string;
  translation: string;
  scripture: string;
  reflection: string;
  prayerSuggestion: string;
  credit: string;
  licenseEvidence: string;
  publishedAt: number;
  withdrawn: boolean;
  audioUrl?: string;
  selection?: import("./sharing").BibleSelection;
}
export interface ConnectedEditorial {
  list(
    cursor: string | null,
  ): Promise<{ entries: ConnectedPublication[]; cursor: string | null }>;
  get(date: string): Promise<ConnectedPublication | null>;
  calendar(month: string, today: string): Promise<{ dates: string[]; credit: string }>;
  save(input: import("./editorial").EditorialSave): Promise<void>;
  withdraw(id: string, reason: string): Promise<void>;
}
