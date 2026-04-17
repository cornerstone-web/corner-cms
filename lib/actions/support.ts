"use server";

/**
 * Sends a support message to the Cornerstone platform team via corner-apostle.
 * Never throws — returns { ok: boolean }.
 */
export async function sendSupportMessage({
  message,
  fromEmail,
  fromName,
  siteName,
}: {
  message: string;
  fromEmail?: string;
  fromName?: string;
  siteName?: string;
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${process.env.CORNER_APOSTLE_URL}/send-support`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CORNERSTONE_INTERNAL_SECRET ?? ""}`,
      },
      body: JSON.stringify({ message, fromEmail, fromName, siteName }),
    });
    if (!res.ok) {
      console.error("Support email send failed:", await res.text().catch(() => "(no body)"));
    }
    return { ok: res.ok };
  } catch (err) {
    console.error("Support email error:", err);
    return { ok: false };
  }
}
