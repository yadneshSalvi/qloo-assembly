import { describe, expect, it } from "vitest";
import {
  assessOfferSchedule,
  offerProgramSlot,
  offerSetupSlot,
  programScheduleFor,
  type ScheduledOffer,
} from "@assembly/contracts";

const sound = (): ScheduledOffer => ({
  id: "synthetic-sound",
  name: "Synthetic sound offer",
  programStart: "19:00",
  durationMinutes: 50,
  setupStart: "17:30",
  setupMinutes: 60,
  canOverlap: false,
});
const service = (): ScheduledOffer => ({
  id: "synthetic-table",
  name: "Synthetic table offer",
  programStart: "20:00",
  durationMinutes: 45,
  setupStart: "18:00",
  setupMinutes: 30,
  canOverlap: false,
});

describe("operator-entered program slots", () => {
  it("supports the five-offer rehearsal pool without silently allowing program conflicts", () => {
    const first = sound();
    const table = { ...service(), setupStart: "17:30", setupMinutes: 45 };
    const film = {
      ...sound(),
      id: "synthetic-film",
      name: "Synthetic film offer",
      programStart: "18:50",
      durationMinutes: 70,
    };
    const workshop = {
      ...sound(),
      id: "synthetic-workshop",
      name: "Synthetic workshop offer",
      durationMinutes: 90,
    };
    const replacement = {
      ...sound(),
      id: "synthetic-replacement",
      name: "Synthetic replacement offer",
    };
    for (const offers of [
      [first, table],
      [film, table],
      [workshop],
      [replacement, table],
    ])
      expect(assessOfferSchedule(offers, "18:30", "22:00")).toEqual({
        violations: [],
        unresolvedProgram: [],
        unresolvedSetup: [],
      });
    expect(
      assessOfferSchedule([workshop, table], "18:30", "22:00").violations.join(
        " ",
      ),
    ).toContain("overlap");
  });
  it("keeps the entered starts, derives their ends and sorts without moving either offer to doors", () => {
    const offers = [service(), sound()];
    const before = structuredClone(offers);
    expect(
      programScheduleFor(offers).map(({ start, end }) => ({ start, end })),
    ).toEqual([
      { start: "19:00", end: "19:50" },
      { start: "20:00", end: "20:45" },
    ]);
    expect(assessOfferSchedule(offers, "18:30", "22:00")).toEqual({
      violations: [],
      unresolvedProgram: [],
      unresolvedSetup: [],
    });
    expect(offers).toEqual(before);
  });

  it("treats prose-only or missing timing as unresolved without fabricating a slot", () => {
    const offer = {
      ...sound(),
      programStart: undefined,
      scope: "19:00–19:50 with soundcheck at 17:30",
    };
    expect(programScheduleFor([offer])).toEqual([]);
    expect(
      assessOfferSchedule([offer], "18:30", "22:00").unresolvedProgram,
    ).toHaveLength(1);
    expect(offerProgramSlot(offer)).toBeNull();
  });

  it("blocks competing slots unless the operator explicitly permits a concurrent service", () => {
    const food = { ...service(), programStart: "19:30" };
    expect(
      assessOfferSchedule([sound(), food], "18:30", "22:00").violations.join(
        " ",
      ),
    ).toContain("overlap");
    food.canOverlap = true;
    expect(
      assessOfferSchedule([sound(), food], "18:30", "22:00").violations,
    ).toEqual([]);
    expect(programScheduleFor([food])[0].canOverlap).toBe(true);
  });

  it("accepts adjacent slots and rejects starts before doors or finishes after the event", () => {
    expect(
      assessOfferSchedule(
        [sound(), { ...service(), programStart: "19:50" }],
        "18:30",
        "22:00",
      ).violations,
    ).toEqual([]);
    for (const programStart of ["18:00", "21:30"])
      expect(
        assessOfferSchedule(
          [{ ...sound(), programStart, setupMinutes: 0 }],
          "18:30",
          "22:00",
        ).violations.join(" "),
      ).toContain("must fit");
    expect(
      assessOfferSchedule([sound()], "invalid", "22:00").violations,
    ).toHaveLength(1);
  });

  it("requires actual setup timing and checks that setup finishes before the program", () => {
    expect(offerSetupSlot(sound())).toEqual({ start: "17:30", end: "18:30" });
    expect(
      assessOfferSchedule(
        [{ ...sound(), setupStart: undefined }],
        "18:30",
        "22:00",
      ).unresolvedSetup,
    ).toHaveLength(1);
    expect(
      assessOfferSchedule(
        [{ ...sound(), setupStart: "18:30" }],
        "18:30",
        "22:00",
      ).violations.join(" "),
    ).toContain("setup must finish");
    expect(
      assessOfferSchedule(
        [{ ...sound(), setupMinutes: 0, setupStart: undefined }],
        "18:30",
        "22:00",
      ).unresolvedSetup,
    ).toEqual([]);
  });

  it("rejects malformed times and durations that would cross into another day", () => {
    for (const programStart of ["25:00", "19:60", "7pm", "23:45"])
      expect(
        offerProgramSlot({ programStart, durationMinutes: 50 }),
      ).toBeNull();
    expect(
      offerProgramSlot({ programStart: "19:00", durationMinutes: 0 }),
    ).toBeNull();
  });
});
