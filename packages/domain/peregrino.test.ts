import { describe, expect, it } from "vitest";
import { peregrinoErrorMessage, peregrinoModel, peregrinoSelection, peregrinoStageMessages, peregrinoStages, runPeregrinoPipeline } from "./peregrino";

const context = { reference: "João 1:1", scripture: "1 - No princípio", focus: "cansaço" };

describe("Peregrino", () => {
  it("keeps the scripture as data and strips the quote label from the selection", () => {
    const draft = peregrinoStageMessages({ stage: "draft", field: "reflection", ...context });
    expect(draft[1].content).toContain("No princípio");
    expect(draft[1].content).toContain("cansaço");
    expect(draft[1].content).toContain("primeira pessoa");
    const human = peregrinoStageMessages({ stage: "humanize", field: "reflection", ...context, text: "Uma pausa." });
    expect(human[1].content).toContain("humanizar-posts-ptbr");
    const critique = peregrinoStageMessages({ stage: "critique", field: "prayer", ...context, text: "Senhor, acolhe. Amém." });
    expect(critique[1].content).toContain("teologia reformada");
    const selection = peregrinoSelection({ book: "ap", chapter: 22, first: 1, last: 5, version: "alm1911", reference: "rótulo", text: "trecho", versionName: "nome" } as never);
    expect(selection).toEqual({ book: "ap", chapter: 22, first: 1, last: 5, version: "alm1911" });
  });
  it("runs draft, review, humanizing, critique and correction for each requested text", async () => {
    const seen: string[] = [];
    const result = await runPeregrinoPipeline(async (messages) => {
      const body = JSON.parse(messages[1].content) as { stage: string; field: string };
      seen.push(`${body.field}:${body.stage}`);
      const text = body.field === "prayer" ? "Senhor, eu te escuto neste trecho. Amém." : "Eu leio este trecho com você e paro diante dele.";
      return JSON.stringify({ text, notes: body.stage === "verify" ? "sem citação extra" : "" });
    }, { ...context, target: "both" });
    expect(seen).toEqual(["reflection", "prayer"].flatMap(field => peregrinoStages.map(stage => `${field}:${stage}`)));
    expect(result.reflection?.length).toBeLessThanOrEqual(500);
    expect(result.prayerSuggestion?.length).toBeLessThanOrEqual(250);
    expect(result.prayerSuggestion).toMatch(/Amém\.?$/);
    expect(result.model).toBe(peregrinoModel);
  });
  it("retries a stage once when the text is over the limit", async () => {
    let calls = 0;
    const result = await runPeregrinoPipeline(async () => {
      calls += 1;
      return JSON.stringify({ text: calls === 1 ? "x".repeat(501) : "Eu permaneço neste trecho com você." });
    }, { reference: "João 1:1", scripture: "1 - No princípio", target: "reflection" });
    expect(calls).toBe(6);
    expect(result.reflection).toBe("Eu permaneço neste trecho com você.");
  });
  it("maps provider statuses to Portuguese", () => {
    expect(peregrinoErrorMessage(401)).toMatch(/chave/);
    expect(peregrinoErrorMessage(429)).toMatch(/muitas/);
    expect(peregrinoErrorMessage(503)).toMatch(/não respondeu/);
  });
});
