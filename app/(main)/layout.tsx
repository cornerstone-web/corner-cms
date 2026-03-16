import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { getAuth } from "@/lib/auth";
import { Providers } from "@/components/providers";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth0.getSession();
  if (!session) return redirect("/auth/login");

  const { user } = await getAuth();
  if (!user) return redirect("/locked-out");

  return (
    <Providers user={user}>
      {children}
    </Providers>
  );
}
