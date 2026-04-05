"use client";

import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import { useRepo } from "@/contexts/repo-context";
import { User } from "@/components/user";
import { RepoDropdown } from "@/components/repo/repo-dropdown";
import { RepoNav } from "@/components/repo/repo-nav";
import { About } from "@/components/about";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { checkNavigationGuard } from "@/lib/navigation-guard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RepoSidebar = ({
  onClick,
  collapsed = false,
  onToggleCollapse,
}: {
  onClick?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) => {
  const { user } = useUser();
  const repo = useRepo();

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
              onClick={onToggleCollapse}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <>
      <header className="border-b flex items-center px-3 py-2">
        <Link
          className={buttonVariants({ variant: "ghost", size: "xs" })}
          href="/"
          prefetch={true}
          onNavigate={(e) => {
            if (!checkNavigationGuard("/")) e.preventDefault();
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          All projects
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`${buttonVariants({ variant: "ghost", size: "icon-xs" })} ml-auto`}
              onClick={onToggleCollapse}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Collapse sidebar</TooltipContent>
        </Tooltip>
      </header>
      <div className="px-3 pt-1">
        <RepoDropdown onClick={onClick} />
      </div>
      <nav className="px-3 pb-5 flex flex-col gap-y-1 overflow-auto flex-1 min-h-0">
        <RepoNav onClick={onClick}/>
      </nav>
      <footer className="flex items-center gap-x-2 border-t px-3 py-2 mt-auto">
        <User className="mr-auto" onClick={onClick}/>
        <About onClick={onClick}/>
      </footer>
    </>
  );
}

export { RepoSidebar };
