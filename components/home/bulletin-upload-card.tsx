"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BulletinUploader } from "@/components/media/bulletin-uploader";

export function BulletinUploadCard({
  owner,
  repoName,
  branch,
  viewAllHref,
}: {
  owner: string;
  repoName: string;
  branch: string;
  viewAllHref: string;
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">Quick Bulletin Upload</CardTitle>
          </div>
          <Link
            href={viewAllHref}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            View All
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <BulletinUploader owner={owner} repoName={repoName} branch={branch} />
      </CardContent>
    </Card>
  );
}
