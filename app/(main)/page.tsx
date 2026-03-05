// Home page — full role-based implementation is in Step 4.
// This file is replaced in Step 4 with the church portal card / super admin dashboard.
import { getAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MainRootLayout } from "./main-root-layout";

export default async function Page() {
  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  return (
    <MainRootLayout>
      <div className="max-w-screen-sm mx-auto p-4 md:p-6">
        <p className="text-muted-foreground">Loading your portal…</p>
      </div>
    </MainRootLayout>
  );
}
