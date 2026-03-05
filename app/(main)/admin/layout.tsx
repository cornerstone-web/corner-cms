import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { MainRootLayout } from "../main-root-layout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuth();
  if (!user || !user.isSuperAdmin) return redirect("/");

  return <MainRootLayout>{children}</MainRootLayout>;
}
