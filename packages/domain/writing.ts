import type { BibleQuote, BibleSelection } from "./sharing";
import type { Devotional } from "./types";
import { dateInZone } from "./reading";
import { localAaLicense, scriptureLicenseForVersion } from "./editorial";

export interface EditorialDraft {
  scripture: string; reference: string; translation: string; selection?: BibleSelection;
  reflection: string; prayerSuggestion: string; date: string; licenseEvidence: string;
  programming: boolean; query: string;
  reason?: string;
  version?: import("./validators/bible").BibleVersion;
}
export function editorialDraft(existing?: Devotional, quote?: BibleQuote): EditorialDraft {
  return {
    scripture: quote?.text ?? existing?.scripture ?? "", reference: quote?.reference ?? existing?.reference ?? "",
    translation: quote?.versionName ?? existing?.translation ?? "", selection: quote ?? existing?.selection,
    reflection: existing?.reflection ?? "", prayerSuggestion: existing?.prayerSuggestion ?? "",
    date: existing?.date ?? dateInZone("America/Sao_Paulo"),
    licenseEvidence: quote ? scriptureLicenseForVersion(quote.version) : existing?.licenseEvidence ?? localAaLicense,
    programming: false, query: "",
    version: quote?.version ?? existing?.selection?.version,
  };
}
export function applyEditorialQuote(draft: EditorialDraft, quote: BibleQuote): EditorialDraft {
  return { ...draft, scripture: quote.text, reference: quote.reference, translation: quote.versionName, selection: quote, version: quote.version, licenseEvidence: scriptureLicenseForVersion(quote.version) };
}
export interface CommunityWritingDraft {
  communityId: string; draftId: string | null; quote: BibleQuote | null; comment: string;
  query: string; open: boolean; requestId: string;
}
export interface BiblePickerState {
  target: { kind: "devotional"; key: string; date?: string } | { kind: "community"; communityId: string; draftId?: string | null };
  book: string; chapter: number; selection: BibleSelection | null; query: string; scrollY?: number;
}
