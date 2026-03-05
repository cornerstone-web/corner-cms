import Link from "next/link";
import { ChurchAssignment } from "@/types/user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, ExternalLink, Pencil } from "lucide-react";

export function ChurchPortalCard({ assignment }: { assignment: ChurchAssignment }) {
  const [owner, repo] = assignment.githubRepoName.split("/");
  const editorHref = `/${owner}/${repo}`;

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">{assignment.displayName}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {assignment.role === "church_admin" ? "Church Admin" : "Editor"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignment.cfPagesUrl && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Live site</span>
              <a
                href={assignment.cfPagesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-medium hover:underline text-xs truncate max-w-[200px]"
              >
                {assignment.cfPagesUrl.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href={editorHref}>
              <Pencil className="h-4 w-4 mr-2" />
              Open Editor
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
