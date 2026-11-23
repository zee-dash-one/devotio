import { describe, expect, it } from "vitest";
import { buildPeregrinoMessages, parsePeregrinoOutput, peregrinoErrorMessage, peregrinoModel } from "./peregrino";

describe("Peregrino", () => {
  it("asks for JSON and keeps the scripture as data", () => {
    const messages = buildPeregrinoMessages({ reference: "João 1:1", scripture: "1 - No princípio", target: "both" });
    expect(messages[0].content).toContain("JSON");
    expect(messages[1].content).toContain("No princípio");
    expect(messages[1].content).not.toContain("ignore");
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