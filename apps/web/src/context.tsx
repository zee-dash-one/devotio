import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Repository, HomeData, LocalProfile, Devotional, EditorialDraft, CommunityWritingDraft, BiblePickerState } from "domain/core";
import { PreferencesProvider } from "./preferences";
export interface AppContextValue {
  administration?: import("domain/core").Administration;
  connectedEditorial?: import("domain/core").ConnectedEditorial;
  pilotAccess?: import("domain/core").AccessState;
  accessError?: string;
  refreshAccess?: () => void;
  repository: Repository | null;
  preview?: boolean;
  localProfiles?: LocalProfile[];
  localProfile?: LocalProfile;
  localError?: string;
  configured: boolean;
  loading: boolean;
  userKey: string;
  onLogin: (destination: string, profileId?: string) => Promise<void>;
  onLogout: () => Promise<void>;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppContext ausente.");
  return value;
}
export const ReaderContext = createContext<{
  data?: HomeData;
  error?: string;
  date: string;
}>({ date: "" });
export function useReader() {
  return useContext(ReaderContext);
}
export const AudioSelectionContext = createContext<(devotional: Devotional | null) => void>(() => {});
export const ReadingNavigationContext = createContext(0);
interface WritingState { editors: Record<string, EditorialDraft>; communities: Record<string, CommunityWritingDraft>; picker: BiblePickerState | null }
const emptyWriting: WritingState = { editors: {}, communities: {}, picker: null };
const WritingContext = createContext<WritingState & {
  setEditor: (key: string, draft: EditorialDraft | null) => void;
  setCommunity: (id: string, draft: CommunityWritingDraft | null) => void;
  setPicker: (picker: BiblePickerState | null) => void;
}>({ ...emptyWriting, setEditor: () => {}, setCommunity: () => {}, setPicker: () => {} });
export function useWriting() { return useContext(WritingContext); }
export function AppProvider({
  value,
  children,
}: {
  value: AppContextValue;
  children: ReactNode;
}) {
  const [writing, setWriting] = useState<{ owner: string; data: WritingState }>({ owner: value.userKey, data: emptyWriting });
  const updateWriting = useCallback((update: (data: WritingState) => WritingState) => setWriting(current => ({ owner: value.userKey, data: update(current.owner === value.userKey ? current.data : emptyWriting) })), [value.userKey]);
  const setEditor = useCallback((key: string, draft: EditorialDraft | null) => updateWriting(data => { const editors = { ...data.editors }; if (draft) editors[key] = draft; else delete editors[key]; return { ...data, editors }; }), [updateWriting]);
  const setWriterCommunity = useCallback((id: string, draft: CommunityWritingDraft | null) => updateWriting(data => { const communities = { ...data.communities }; if (draft) communities[id] = draft; else delete communities[id]; return { ...data, communities }; }), [updateWriting]);
  const setPicker = useCallback((picker: BiblePickerState | null) => updateWriting(data => ({ ...data, picker })), [updateWriting]);
  useEffect(() => { setWriting({ owner: value.userKey, data: emptyWriting }); }, [value.userKey]);
  return <AppContext.Provider value={value}><PreferencesProvider key={value.userKey} owner={value.userKey}><WritingContext.Provider value={{ ...(writing.owner === value.userKey ? writing.data : emptyWriting), setEditor, setCommunity: setWriterCommunity, setPicker }}>{children}</WritingContext.Provider></PreferencesProvider></AppContext.Provider>;
}
