import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { MainRootLayout } from "../main-root-layout";
import { getInitialsFromName } from "@/lib/utils/avatar";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  CardFooter,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function Page() {
  const { user } = await getAuth();
  if (!user) throw new Error("User not found");

  return (
    <MainRootLayout>
      <div className="max-w-screen-sm mx-auto p-4 md:p-6 space-y-6">
        <Link className={cn(buttonVariants({ variant: "outline", size: "xs" }), "inline-flex")} href="/" prefetch={true}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Go home
        </Link>
        <header className="flex items-center mb-6">
          <h1 className="font-semibold tracking-tight text-lg md:text-2xl">Settings</h1>
        </header>
        <div className="flex flex-col relative flex-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Profile</CardTitle>
              <CardDescription>Your account information.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Name</Label>
                  <div className="col-span-3">
                    <Input disabled defaultValue={user.name || ""} />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Email</Label>
                  <div className="col-span-3">
                    <Input disabled defaultValue={user.email} />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Picture</Label>
                  <div className="col-span-3">
                    <Avatar className="h-24 w-24 rounded-md">
                      <AvatarFallback className="rounded-md text-3xl">
                        {getInitialsFromName(user.name || user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Profile managed via Auth0. Contact your admin to make changes.</p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </MainRootLayout>
  );
}
