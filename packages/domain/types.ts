export type Role = "owner" | "admin" | "member";
export interface User {
  id: string;
  name: string;
}
export interface Devotional {
  id: string;
  date: string;
  reference: string;
  translation: string;
  scripture: string;
  reflection: string;
  prayerSuggestion: string;
  credit: string;
  audioUrl?: string;
  licenseEvidence?: string;
  selection?: import("./sharing").BibleSelection;
}
export interface HomeData {
  user: User;
  devotional: Devotional | null;
  settings: {
    monthlyVerse: string;
    monthlyReference: string;
    weeklyVerse: string;
    weeklyReference: string;
  } | null;
}
export interface Community {
  id: string;
  name: string;
  description: string;
  scripture: string;
  role: Role;
  inviteCode?: string;
  memberId?: string;
  pendingRequests?: number;
}
export interface Member {
  id: string;
  userId: string;
  name: string;
  role: Role;
}
export interface Message {
  id: string;
  content: string;
  name: string;
  sentAt: number;
  quote?: import("./sharing").BibleQuote;
}
export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  count: number;
}
export interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}
export interface CommunityDetail {
  community: Community;
  members: Member[];
  messages: Message[];
  lists: Checklist[];
  hasMore: boolean;
  nextCursor: string | null;
}
export type Unsubscribe = () => void;
export type Watch<T> = (
  onData: (data: T) => void,
  onError: (error: Error) => void,
) => Unsubscribe;
export interface Repository {
  mode: "preview" | "live" | "local";
  watchDevotionalImages?(id: string, revision: string): Watch<import("./devotional-images").DevotionalImageManifest>;
  retryDevotionalImages?(id: string, revision: string): Promise<void>;
  social?: import("./social").SocialRepository;
  reading?: import("./reading").ReadingRepository;
  devotionalReading?: Pick<import("./reading").ReadingRepository, "watchReading" | "setFavorite" | "restoreFavorite">;
  bible?: import("./reading").BibleRepository;
  notifications?: import("./sharing").NotificationsRepository;
  sharing?: import("./sharing").SharingRepository;
  governance?: import("./community-governance").CommunityGovernance;
  communityMessage?(id: string, messageId: string): Promise<Message>;
  refresh?(): Promise<void>;
  watchHome(date: string): Watch<HomeData>;
  watchCommunities(): Watch<Community[]>;
  watchCommunity(
    id: string,
    cursor: string | null,
  ): Watch<CommunityDetail | null>;
  createCommunity(input: {
    name: string;
    description: string;
  }): Promise<string>;
  previewInvite(code: string): Promise<{ id: string; name: string } | null>;
  joinCommunity(code: string): Promise<string>;
  sendMessage(id: string, content: string): Promise<void>;
  updateScripture(id: string, scripture: string): Promise<void>;
  createChecklist(id: string, name: string, items: string[]): Promise<void>;
  setTick(itemId: string, checked: boolean): Promise<void>;
  removeMember(communityId: string, memberId: string): Promise<void>;
}
