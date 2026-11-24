import { bibleQuote, canManageEditorial, canManageSystem, parsePeregrinoStage, peregrinoErrorMessage, peregrinoMissingKey, peregrinoModel, peregrinoRateLimit, peregrinoStageFailure, peregrinoStageMessages, peregrinoTargetSchema, peregrinoThinking, runPeregrinoPipeline, type BibleSelection, type PeregrinoField, type PeregrinoStage, type PeregrinoTarget } from "../../domain/index";
import { LocalDatabase, LocalError } from "./database.local";

const attempts = new Map<string, number[]>();

export async function suggestLocal(database: LocalDatabase, userId: string, input: { selection?: BibleSelection; date?: string; reflection?: string; prayerSuggestion?: string; focus?: string; target: PeregrinoTarget }) {
  const user = database.profile(userId);
  if (!canManageEditorial(user) && !canManageSystem(user)) throw new LocalError("Acesso exclusivo da gestão editorial.", 403);
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter(at => now - at < 600000);
  if (recent.length >= 10) throw new LocalError(peregrinoRateLimit, 429);
  recent.push(now);
  attempts.set(userId, recent);
  const key = database.openRouterKey();
  if (!key) throw new LocalError(peregrinoMissingKey);
  const target = peregrinoTargetSchema.parse(input.target);
  let reference = "";
  let scripture = "";
  if (input.selection) {
    const chapter = database.chapter(input.selection.book, input.selection.chapter, input.selection.version);
    if (!chapter) throw new LocalError("Capítulo bíblico não encontrado.", 404);
    const quote = bibleQuote({ ...chapter, version: input.selection.version }, input.selection);
    reference = quote.reference;
    scripture = quote.text;
  } else if (input.date) {
    const row = database.get<{ data: string }>("SELECT data FROM devotionals WHERE date=?", input.date);
    if (!row) throw new LocalError("Devocional não encontrado.", 404);
    const day = JSON.parse(row.data) as { reference: string; scripture: string };
    reference = day.reference;
    scripture = day.scripture;
  } else throw new LocalError("Escolha o trecho bíblico antes de pedir auxílio.");
  const complete = async (messages: { role: "system" | "user"; content: string }[]) => {
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Devotio" },
        body: JSON.stringify({ model: peregrinoModel, max_tokens: 700, temperature: 0.4, messages }),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new LocalError("O Peregrino não respondeu a tempo. Tente novamente em instantes.");
    }
    if (!response.ok) throw new LocalError(peregrinoErrorMessage(response.status), response.status);
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new LocalError("O Peregrino devolveu uma resposta inesperada. Tente novamente.");
    return content;
  };
  return runPeregrinoPipeline(complete, { reference, scripture, focus: input.focus, target });
}

export async function stepLocal(database: LocalDatabase, userId: string, input: { selection?: BibleSelection; date?: string; focus?: string; field: PeregrinoField; stage: PeregrinoStage; text?: string; notes?: string }) {
  const user = database.profile(userId);
  if (!canManageEditorial(user) && !canManageSystem(user)) throw new LocalError("Acesso exclusivo da gestão editorial.", 403);
  if (input.stage === "draft") {
    const now = Date.now();
    const recent = (attempts.get(userId) ?? []).filter(at => now - at < 600000);
    if (recent.length >= 10) throw new LocalError(peregrinoRateLimit, 429);
    recent.push(now);
    attempts.set(userId, recent);
  }
  const key = database.openRouterKey();
  if (!key) throw new LocalError(peregrinoMissingKey);
  let reference = "";
  let scripture = "";
  if (input.selection) {
    const chapter = database.chapter(input.selection.book, input.selection.chapter, input.selection.version);
    if (!chapter) throw new LocalError("Capítulo bíblico não encontrado.", 404);
    const quote = bibleQuote({ ...chapter, version: input.selection.version }, input.selection);
    reference = quote.reference;
    scripture = quote.text;
  } else if (input.date) {
    const row = database.get<{ data: string }>("SELECT data FROM devotionals WHERE date=?", input.date);
    if (!row) throw new LocalError("Devocional não encontrado.", 404);
    const day = JSON.parse(row.data) as { reference: string; scripture: string };
    reference = day.reference;
    scripture = day.scripture;
  } else throw new LocalError("Escolha o trecho bíblico antes de pedir auxílio.");
  const thinking = peregrinoThinking(input.stage, input.field);
  let raw = "";
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Devotio" },
      body: JSON.stringify({ model: peregrinoModel, max_tokens: 700, temperature: 0.4, messages: peregrinoStageMessages({ stage: input.stage, field: input.field, reference, scripture, focus: input.focus, text: input.text, notes: input.notes }) }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new LocalError(peregrinoErrorMessage(response.status), response.status);
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    raw = body.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new LocalError("O Peregrino devolveu uma resposta inesperada. Tente novamente.");
  } catch (error) {
    const detail = error instanceof LocalError ? error.message : "O Peregrino não respondeu a tempo. Tente novamente em instantes.";
    throw new LocalError(peregrinoStageFailure(input.stage, input.field, "call", detail), error instanceof LocalError ? error.status : 504);
  }
  try {
    const parsed = parsePeregrinoStage(raw, input.field, input.stage);
    return { text: parsed.text, notes: parsed.notes ?? "", thinking };
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    throw new LocalError(peregrinoStageFailure(input.stage, input.field, "answer", detail));
  }
}
