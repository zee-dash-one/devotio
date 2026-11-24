import { describe, expect, it } from "vitest";
import { buildPeregrinoMessages, parsePeregrinoOutput, peregrinoErrorMessage, peregrinoModel, peregrinoSelection } from "./peregrino";

describe("Peregrino", () => {
  it("asks for JSON and keeps the scripture as data", () => {
    const messages = buildPeregrinoMessages({ reference: "João 1:1", scripture: "1 - No princípio", target: "both" });
    expect(messages[0].content).toContain("JSON");
    expect(messages[1].content).toContain("No princípio");
    expect(messages[1].content).not.toContain("ignore");
    const focused = buildPeregrinoMessages({ reference: "João 1:1", scripture: "1 - No princípio", target: "reflection", focus: "cansaço" });
    expect(focused[1].content).toContain("cansaço");
    const selection = peregrinoSelection({ book: "ap", chapter: 22, first: 1, last: 5, version: "alm1911", reference: "Apocalipse 22:1–5", text: "trecho", versionName: "ARC1911" } as never);
    expect(selection).toEqual({ book: "ap", chapter: 22, first: 1, last: 5, version: "alm1911" });
    expect(JSON.stringify(selection)).not.toContain("reference");
  });
  it("reads one JSON object and drops the field that was not requested", () => {
    const value = parsePeregrinoOutput("nota {\"reflection\":\"Uma pausa.\",\"prayerSuggestion\":\"Senhor, acolhe. Amém.\"}", "reflection");
    expect(value.reflection).toBe("Uma pausa.");
    expect(value.prayerSuggestion).toBeUndefined();
    expect(value.model).toBe(peregrinoModel);
  });
  it("maps provider statuses to Portuguese", () => {
    expect(peregrinoErrorMessage(401)).toMatch(/chave/);
    expect(peregrinoErrorMessage(429)).toMatch(/muitas/);
    expect(peregrinoErrorMessage(503)).toMatch(/não respondeu/);
  });
});