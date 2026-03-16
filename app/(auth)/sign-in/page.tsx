import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";

export default async function Page() {
  const session = await auth0.getSession();
  if (session) return redirect("/");

  return redirect("/auth/login");
}