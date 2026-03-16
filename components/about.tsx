"use client";

import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CircleHelp, Chrome, Book, Github } from "lucide-react";
import { cn } from "@/lib/utils";

export function About({ onClick }: { onClick?: () => void }) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <CircleHelp className="h-4 w-4" />
              <span className="sr-only">About Cornerstone Web Development</span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>About Cornerstone Web Development</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>About Cornerstone Web Development</DialogTitle>
          <DialogDescription>
            Cornerstone exists because every congregation deserves a beautiful,
            easy-to-use website that helps them share their message and connect
            with their community.
          </DialogDescription>
        </DialogHeader>
        <footer className="grid grid-flow-col justify-stretch text-sm gap-x-2">
          <a
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-full",
            )}
            href="https://cornerstoneweb.dev/about"
            target="_blank"
          >
            <Chrome className="h-4 w-4 shrink-0 mr-2" />
            Website
          </a>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
