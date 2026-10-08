import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProfile, isOnboarded } from "@/lib/storage";
import { ProfileForm } from "./ProfileForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());

describe("ProfileForm", () => {
  it("onboarding saves name and level, then goes home", async () => {
    const user = userEvent.setup();
    render(<ProfileForm mode="onboarding" />);
    const save = screen.getByRole("button", { name: /start my journey/i });
    await waitFor(() => expect(save).toBeEnabled());

    await user.type(screen.getByLabelText(/your name/i), "  Asha ");
    await user.click(screen.getByRole("radio", { name: /intermediate/i }));
    await user.click(save);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(await getProfile()).toEqual({ name: "Asha", experience: "intermediate" });
    expect(await isOnboarded()).toBe(true);
  });

  it("editing starts from the saved profile instead of blank defaults", async () => {
    localStorage.setItem("@yoga_onboarded", "true");
    localStorage.setItem("@yoga_user_profile", JSON.stringify({ name: "Ravi", experience: "expert" }));
    render(<ProfileForm mode="edit" />);

    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toHaveValue("Ravi"));
    expect(screen.getByRole("radio", { name: /expert/i })).toBeChecked();
  });

  it("skipping onboarding keeps the default profile", async () => {
    const user = userEvent.setup();
    render(<ProfileForm mode="onboarding" />);
    await user.click(screen.getByRole("button", { name: /skip for now/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(await isOnboarded()).toBe(true);
    expect(await getProfile()).toEqual({ name: "Yogi", experience: "beginner" });
  });
});
