// Loaded only behind import.meta.env.DEV. Never included in the public bundle.
import { useEffect, useState } from "react";
import { createLocalRepository, localSession, localLogin, localLogout, localRequestEmailCode, localVerifyEmailCode } from "domain/local";
import type { LocalProfile, Repository } from "domain/core";
import { App } from "./router";
import { createWebBible, licensedEditions } from "./bible-repository";
import type { BibleVersion } from "domain/core";

const sessionEvent = "devotio:session-change";
function clearCache() {
  try { Object.keys(localStorage).filter(key => key.startsWith("devotio:cache:") || key.startsWith("devotio:favorites:")).forEach(key => localStorage.removeItem(key)); }
  catch { /* Storage may be disabled; the repository still drops its memory cache. */ }
}
function notifySession() {
  try { localStorage.setItem(sessionEvent, crypto.randomUUID()); } catch { /* Actual requests also verify the expected profile. */ }
}
export function LocalApp() {
  const [session, setSession] = useState<{ profile: LocalProfile; expiresAt: number } | null>(null);
  const profile = session?.profile;
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [licensed, setLicensed] = useState<{ version: BibleVersion; base: string }[]>([]);
  useEffect(() => { void licensedEditions().then(setLicensed); }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  useEffect(() => {
    let active = true, generation = 0;
    const check = async () => {
      const started = ++generation;
      try {
        const value = await localSession();
        if (!active || started !== generation) return;
        if (!value.profile || !value.expiresAt) clearCache();
        setSession(value.profile && value.expiresAt ? { profile: value.profile, expiresAt: value.expiresAt } : null);
        setProfiles(value.profiles); setError("");
      } catch {
        if (active && started === generation) setError("Não foi possível acessar o banco local. Verifique o servidor e recarregue a página.");
      } finally { if (active && started === generation) setLoading(false); }
    };
    void check();
    const changed = (event: StorageEvent) => {
      if (event.key !== sessionEvent) return;
      setRepository(null); setSession(null); setLoading(true); clearCache();
      void check();
    };
    window.addEventListener("storage", changed);
    return () => { active = false; window.removeEventListener("storage", changed); };
  }, []);
  useEffect(() => {
    if (!session) { setRepository(null); return; }
    const key = "devotio:cache:v1:" + session.profile.id;
    const connection = createLocalRepository({
      read() { try { return JSON.parse(localStorage.getItem(key) ?? "null") as unknown; } catch { return null; } },
      write(cache) { localStorage.setItem(key, JSON.stringify(cache)); },
      clear: clearCache,
    }, () => { setSession(null); setRepository(null); notifySession(); }, session.profile.id, { sessionExpiresAt: session.expiresAt, onStorageWarning: setStorageWarning });
    setRepository({ ...connection.repository, bible: createWebBible(session.profile.id, connection.repository.reading, licensed) });
    const events = typeof EventSource === "undefined" ? null : new EventSource("/__local/events?profile=" + encodeURIComponent(session.profile.id));
    events?.addEventListener("notifications", event => {
      try { void connection.acceptNotificationEvent(JSON.parse((event as MessageEvent<string>).data)); } catch { /* Ignore malformed transport data; explicit refresh remains available. */ }
    });
    const checkClock = () => { void connection.checkDay(); };
    // This timer reads only the device clock. HTTP occurs only when the day changes.
    const timer = setInterval(checkClock, 30_000);
    const foreground = () => { if (document.visibilityState === "visible") checkClock(); };
    document.addEventListener("visibilitychange", foreground);
    checkClock();
    return () => { events?.close(); clearInterval(timer); document.removeEventListener("visibilitychange", foreground); connection.dispose(); };
  }, [session, licensed]);
  return <>
    {storageWarning && <p className="notice" role="status">{storageWarning}</p>}
    <App repository={repository} localProfiles={profiles} localProfile={profile}
      localError={error} configured loading={loading || (!!profile && !repository)} userKey={profile?.id ?? "guest"}
      onLogin={async (_destination, profileId) => {
        if (!profileId) throw new Error("Escolha um perfil para entrar.");
        const value = await localLogin(profileId);
        clearCache(); setStorageWarning(""); setRepository(null); setSession(value); notifySession();
      }}
      emailLogin={{
        request: email => localRequestEmailCode(email),
        verify: async (email, code) => {
          const value = await localVerifyEmailCode(email, code);
          clearCache(); setStorageWarning(""); setRepository(null); setSession(value); notifySession();
        },
      }}
      onLogout={async () => { await localLogout(); clearCache(); setRepository(null); setSession(null); notifySession(); }} />
  </>;
}
