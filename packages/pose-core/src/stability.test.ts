import { describe, expect, it } from "vitest";
import { NO_POSE, StabilityVote, TimeWindowVote } from "./index";

describe("TimeWindowVote", () => {
  it("reports a pose once it holds the window", () => {
    const vote = new TimeWindowVote(1000, 0.6, 3);
    expect(vote.push("tree_pose", 0)).toBe(NO_POSE); // 1 frame
    expect(vote.push("tree_pose", 100)).toBe(NO_POSE); // 2 frames
    expect(vote.push("tree_pose", 200)).toBe("tree_pose"); // 3 frames, 100%
  });

  it("needs a majority share, not just a count, at high frame rates", () => {
    const vote = new TimeWindowVote(1000, 0.6, 3);
    // 10 fps: alternating labels never reach 60%.
    let reported = "";
    for (let i = 0; i < 10; i++) reported = vote.push(i % 2 ? "tree_pose" : "chair_pose", i * 100);
    expect(reported).toBe(NO_POSE);
  });

  it("forgets frames older than the window", () => {
    const vote = new TimeWindowVote(1000, 0.6, 3);
    for (let i = 0; i < 10; i++) vote.push("tree_pose", i * 100);
    // A second later the old pose has aged out and a new one takes over.
    for (let i = 0; i < 4; i++) vote.push("chair_pose", 2000 + i * 100);
    expect(vote.push("chair_pose", 2400)).toBe("chair_pose");
  });

  it("smooths a one-frame glitch at 10 fps", () => {
    const vote = new TimeWindowVote();
    const labels = ["tree_pose", "tree_pose", "tree_pose", "tree_pose", "chair_pose", "tree_pose", "tree_pose"];
    const reported = labels.map((label, i) => vote.push(label, i * 100));
    expect(reported.slice(2)).toEqual(Array(5).fill("tree_pose"));
  });

  it("can report 'no pose' when that is the stable state", () => {
    const vote = new TimeWindowVote(1000, 0.6, 3);
    for (let i = 0; i < 5; i++) vote.push(NO_POSE, i * 100);
    expect(vote.push("tree_pose", 500)).toBe(NO_POSE);
  });

  it("starts over after reset", () => {
    const vote = new TimeWindowVote(1000, 0.6, 3);
    for (let i = 0; i < 5; i++) vote.push("tree_pose", i * 100);
    vote.reset();
    expect(vote.push("tree_pose", 600)).toBe(NO_POSE);
  });
});

describe("TimeWindowVote on slow devices", () => {
  it("still reports a pose at 1 frame a second", () => {
    const vote = new TimeWindowVote();
    const reported = ["tree_pose", "tree_pose", "tree_pose"].map((label, i) => vote.push(label, i * 1000));
    expect(reported).toEqual([NO_POSE, NO_POSE, "tree_pose"]);
  });

  it("matches the server's 3-of-5 frame rule when frames are slow", () => {
    const sequence = ["a", "a", "b", "a", "b", "b", "b", NO_POSE, "b", "a", "a", "a"];
    const server = new StabilityVote();
    const slow = new TimeWindowVote();
    expect(sequence.map((p, i) => slow.push(p, i * 2000))).toEqual(sequence.map((p) => server.push(p)));
  });
});

describe("StabilityVote", () => {
  it("keeps the server's 3-of-5 frame rule", () => {
    const vote = new StabilityVote();
    expect(["a", "a", "b", "a", "b", "b", "b"].map((p) => vote.push(p))).toEqual([
      NO_POSE, NO_POSE, NO_POSE, "a", "a", "b", "b",
    ]);
  });
});
