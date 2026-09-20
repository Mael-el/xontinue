// ============================================================
// TESTS — Accusés de lecture ✓ / ✓✓ / ✓✓ bleu
// (src/lib/chat/read-status.ts — fonction pure)
// ============================================================

import {
  computeDeliveryStatus,
  statusToTicks,
  type MemberConsumption,
} from "@/lib/chat/read-status";

const T0 = new Date("2026-09-20T12:00:00Z");
const BEFORE = new Date("2026-09-20T11:00:00Z");
const AFTER = new Date("2026-09-20T13:00:00Z");

const member = (partial: Partial<MemberConsumption>): MemberConsumption => ({
  lastReadAt: null,
  lastSeenAt: null,
  online: false,
  ...partial,
});

describe("computeDeliveryStatus", () => {
  it("sans autre membre → toujours « sent » (groupe vide)", () => {
    expect(computeDeliveryStatus(T0, [])).toBe("sent");
  });

  it("1-1, jamais vu ni lu → « sent » (1 coche)", () => {
    expect(computeDeliveryStatus(T0, [member({})])).toBe("sent");
  });

  it("correspondant vu APRÈS l'émission → « delivered » (2 coches)", () => {
    expect(computeDeliveryStatus(T0, [member({ lastSeenAt: AFTER })])).toBe(
      "delivered"
    );
  });

  it("correspondant en ligne → « delivered » même sans lecture", () => {
    expect(computeDeliveryStatus(T0, [member({ online: true })])).toBe(
      "delivered"
    );
  });

  it("correspondant vu AVANT → reste « sent »", () => {
    expect(computeDeliveryStatus(T0, [member({ lastSeenAt: BEFORE })])).toBe("sent");
  });

  it("message lu (pointeur ≥ createdAt) → « read » (2 coches bleues)", () => {
    expect(computeDeliveryStatus(T0, [member({ lastReadAt: AFTER })])).toBe("read");
    expect(computeDeliveryStatus(T0, [member({ lastReadAt: T0 })])).toBe("read");
  });

  it("groupe : TOUS doivent avoir lu pour « read »", () => {
    const others = [
      member({ lastReadAt: AFTER, online: true }),
      member({ lastReadAt: BEFORE, online: true }), // pas ce message
    ];
    expect(computeDeliveryStatus(T0, others)).toBe("delivered");
  });

  it("groupe : un membre hors ligne et jamais vu → « sent »", () => {
    const others = [
      member({ lastReadAt: AFTER }),
      member({ lastSeenAt: BEFORE, online: false }),
    ];
    expect(computeDeliveryStatus(T0, others)).toBe("sent");
  });
});

describe("statusToTicks", () => {
  it("sent = 1 coche grise", () => {
    expect(statusToTicks("sent")).toEqual({ ticks: 1, color: "gray" });
  });
  it("delivered = 2 coches grises", () => {
    expect(statusToTicks("delivered")).toEqual({ ticks: 2, color: "gray" });
  });
  it("read = 2 coches bleues", () => {
    expect(statusToTicks("read")).toEqual({ ticks: 2, color: "blue" });
  });
});
