/** Pure helper: given email send success/failure, resolve the invite return status. */
export function resolveInviteEmailStatus(emailSent: boolean): { status: "success"; emailSent: boolean } {
  return { status: "success", emailSent };
}
