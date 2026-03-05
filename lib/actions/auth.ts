"use server";

import { redirect } from "next/navigation";

// Sign out the user via Auth0.
const handleSignOut = async () => {
  return redirect("/auth/logout");
};

export { handleSignOut };
