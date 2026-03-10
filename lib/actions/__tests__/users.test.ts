import { describe, it, expect } from "vitest";

// Pure logic: given an email send result, what should inviteUser return?
function resolveInviteStatus(emailOk: boolean): { status: string; emailSent: boolean } {
  return { status: "success", emailSent: emailOk };
}

describe("inviteUser email status logic", () => {
  it("returns emailSent: true when email succeeds", () => {
    expect(resolveInviteStatus(true)).toEqual({ status: "success", emailSent: true });
  });

  it("returns emailSent: false (not an error) when email fails", () => {
    const result = resolveInviteStatus(false);
    expect(result.status).toBe("success"); // NOT an error — user was created in Auth0
    expect(result.emailSent).toBe(false);
  });
});
