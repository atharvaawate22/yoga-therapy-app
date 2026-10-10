import { describe, expect, it } from "vitest";
import { conditionBySlug } from "@/content";
import { saveCustomSet, saveProfile } from "@/lib/storage";
import { resolveRoutine } from "./PracticeLoader";

const params = (query: string) => new URLSearchParams(query);

describe("resolveRoutine", () => {
  it("filters a condition's poses to the user's level", async () => {
    const all = conditionBySlug("headache")!.poses;
    const beginner = await resolveRoutine(params("condition=headache"));
    expect(beginner?.poses.every((p) => p.difficulty === "beginner")).toBe(true);

    await saveProfile({ name: "A", experience: "expert" });
    const expert = await resolveRoutine(params("condition=headache"));
    expect(expert?.poses).toHaveLength(all.length);
    expect(expert).toMatchObject({ title: "Headache", type: "routine", backHref: "/conditions/headache" });
  });

  it("resolves a single pose", async () => {
    const routine = await resolveRoutine(params("pose=tree_pose"));
    expect(routine).toMatchObject({ title: "Tree Pose", type: "single" });
    expect(routine?.poses.map((p) => p.id)).toEqual(["tree_pose"]);
  });

  it("resolves a custom set in its saved order", async () => {
    const set = await saveCustomSet({ name: "Morning", poseIds: ["tree_pose", "cat_cow"] });
    const routine = await resolveRoutine(params(`set=${set.id}`));
    expect(routine).toMatchObject({ title: "Morning", type: "custom" });
    expect(routine?.poses.map((p) => p.id)).toEqual(["tree_pose", "cat_cow"]);
  });

  it.each(["", "condition=nope", "pose=nope", "set=nope"])("returns null for %j", async (query) => {
    expect(await resolveRoutine(params(query))).toBeNull();
  });
});
