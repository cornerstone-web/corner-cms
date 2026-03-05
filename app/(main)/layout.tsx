import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { Providers } from "@/components/providers";

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  return (
    <Providers user={user}>
      {children}
    </Providers>
  );
}
