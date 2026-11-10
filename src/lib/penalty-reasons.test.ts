import { describe, expect, it } from "vitest";
import { filterPenaltyReasons, resolvePenaltyReason } from "./penalty-reasons";

describe("penalty reason suggestions", () => {
  it("finds reasons by partial words in either order and by code", () => {
    expect(filterPenaltyReasons("клюш сопер").map(([code]) => code)).toContain("ЗД-КЛ-СП");
    expect(filterPenaltyReasons("зд-кл").map(([code]) => code)).toEqual(["ЗД-КЛ-СП", "ЗД-КЛ"]);
    expect(filterPenaltyReasons("силовой приём").map(([code]) => code)).toContain("ПОЗ-СП");
  });
  it("preserves the standard code for typed labels or codes", () => {
    expect(resolvePenaltyReason("  подножка  ")).toEqual({ code: "ПОДН", reason: "Подножка" });
    expect(resolvePenaltyReason("зд-кл")).toEqual({ code: "ЗД-КЛ", reason: "Задержка клюшкой" });
  });
  it("stores custom text as OTHER and clears the code for an empty field", () => {
    expect(resolvePenaltyReason("Своя причина")).toEqual({ code: "OTHER", reason: "Своя причина" });
    expect(resolvePenaltyReason(" ")).toEqual({ code: "", reason: "" });
  });
});
