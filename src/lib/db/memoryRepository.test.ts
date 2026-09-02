import { filterMemoriesByQuery } from "@/lib/db/memoryRepository";
import type { DbMemory } from "@/lib/db/types";
import { asMemoryId } from "@/lib/types/ids";

function mem(id: number, content: string): DbMemory {
  return {
    id: asMemoryId(id),
    userId: "u1",
    content,
    createdAt: id,
    updatedAt: id,
    lastAccessedAt: id,
    source: "model",
  };
}

describe("filterMemoriesByQuery", () => {
  const memories = [
    mem(1, "User prefers short answers"),
    mem(2, "Drone is a Meteor75 Pro"),
    mem(3, "Flies FPV whoops indoors"),
  ];

  it("returns rows matching any token, case-insensitive", () => {
    const result = filterMemoriesByQuery(memories, "drone");
    expect(result.map((m) => m.id)).toEqual([asMemoryId(2)]);
  });

  it("splits the query on whitespace and matches each token independently", () => {
    const result = filterMemoriesByQuery(memories, "METEOR whoops");
    expect(result.map((m) => m.id)).toEqual([asMemoryId(2), asMemoryId(3)]);
  });

  it("returns the full list for a blank query, so a tool with an optional query cannot wedge the model", () => {
    expect(filterMemoriesByQuery(memories, "   ")).toHaveLength(3);
    expect(filterMemoriesByQuery(memories, "")).toHaveLength(3);
  });

  it("returns nothing when no row matches", () => {
    expect(filterMemoriesByQuery(memories, "submarine")).toEqual([]);
  });
});
