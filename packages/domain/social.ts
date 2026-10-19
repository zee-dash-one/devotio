import type { z } from "zod";
import type { BibleQuote } from "./sharing";
import type { Watch } from "./types";
import {
  MAX_FRIENDS,
  type friendRequestSchema,
  type friendChangeSchema,
  type shareInputSchema,
  type shareFilterSchema,
} from "./validators/social";
export * from "./validators/social";
export type FriendRequest = z.infer<typeof friendRequestSchema>;
export type FriendChange = z.infer<typeof friendChangeSchema>;
export type ShareInput = z.infer<typeof shareInputSchema>;
export type ShareFilter = z.infer<typeof shareFilterSchema>;
export interface FriendLink {
  id: string;
  low: string;
  high: string;
  requesterId: string;
  state: "pending" | "accepted";
}
export interface Friend {
  id: string;
  userId: string;
  name: string;
  state: "friend" | "incoming" | "outgoing";
  available: boolean;
}
export interface FriendsData {
  userId: string;
  code: string | null;
  friends: Friend[];
}
export interface ShareRecord {
  id: string;
  senderId: string;
  senderName: string;
  recipients: { id: string; name: string }[];
  quote: BibleQuote;
  message: string;
  sentAt: number;
}
export interface PrivateShare {
  id: string;
  direction: "sent" | "received";
  senderName: string;
  quote: BibleQuote;
  message: string;
  sentAt: number;
  recipients?: { id: string; name: string }[];
}
export interface SharePage {
  items: PrivateShare[];
  nextCursor: string | null;
}
export interface ShareMarker {
  first: number;
  direction: "sent" | "received";
}
export type ShareChapter = NonNullable<ShareFilter["chapter"]>;
export interface SocialRepository {
  watchMarkers(chapter: ShareChapter): Watch<ShareMarker[]>;
  watchFriends(): Watch<FriendsData>;
  rotateCode(): Promise<string>;
  request(input: FriendRequest): Promise<void>;
  change(input: FriendChange): Promise<void>;
  send(input: ShareInput): Promise<string>;
  watchShares(input: ShareFilter): Watch<SharePage>;
}
export function friendPair(a: string, b: string) {
  if (a === b) throw new Error("Você não pode adicionar a si mesmo.");
  return a < b ? { low: a, high: b } : { low: b, high: a };
}
export function assertFriendCapacity(count: number) {
  if (count >= MAX_FRIENDS)
    throw new Error(
      "Limite de 200 amizades e convites atingido. Remova ou cancele um vínculo antes de continuar.",
    );
}
export function assertFriendChange(
  link: FriendLink,
  actor: string,
  action: FriendChange["action"],
) {
  if (link.low !== actor && link.high !== actor)
    throw new Error("Este vínculo não está disponível para sua conta.");
  if (
    action === "accept" &&
    (link.state !== "pending" || link.requesterId === actor)
  )
    throw new Error("Somente quem recebeu pode aceitar um convite pendente.");
}
export function assertFriendRecipient(
  link: FriendLink | null | undefined,
  actor: string,
  recipient: string,
  approved: boolean,
) {
  const pair = friendPair(actor, recipient);
  if (
    !approved ||
    !link ||
    link.state !== "accepted" ||
    link.low !== pair.low ||
    link.high !== pair.high
  )
    throw new Error(
      "Escolha apenas amigos com acesso ativo. Atualize sua lista e tente novamente.",
    );
}
export function friendView(
  link: FriendLink,
  actor: string,
  name: string,
  available: boolean,
): Friend {
  assertFriendChange(link, actor, "remove");
  return {
    id: link.id,
    userId: link.low === actor ? link.high : link.low,
    name,
    available,
    state:
      link.state === "accepted"
        ? "friend"
        : link.requesterId === actor
          ? "outgoing"
          : "incoming",
  };
}
export function privateShare(record: ShareRecord, actor: string): PrivateShare {
  const sent = record.senderId === actor;
  if (!sent && !record.recipients.some((recipient) => recipient.id === actor))
    throw new Error("Este recado não está disponível para sua conta.");
  return {
    id: record.id,
    direction: sent ? "sent" : "received",
    senderName: record.senderName,
    quote: record.quote,
    message: record.message,
    sentAt: record.sentAt,
    ...(sent ? { recipients: record.recipients } : {}),
  };
}
export function filterFriends(friends: Friend[], text: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  return friends.filter((friend) =>
    normalize(friend.name).includes(normalize(text.trim())),
  );
}
export function shareFingerprint(input: ShareInput) {
  const { selection: s } = input;
  return JSON.stringify([
    s.version,
    s.book,
    s.chapter,
    s.first,
    s.last,
    [...input.recipientIds].sort(),
    input.message,
  ]);
}
