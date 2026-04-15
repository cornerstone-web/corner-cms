"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConfig } from "@/contexts/config-context";
import { useUser } from "@/contexts/user-context";
import { cn } from "@/lib/utils";
import { BarChart3, FileStack, FileText, FolderOpen, Settings, Users } from "lucide-react";
import { useSiteFeatures } from "@/hooks/use-site-features";
import { checkNavigationGuard } from "@/lib/navigation-guard";
import { isAdminUser, hasCollectionAccess, hasMediaAccess, hasSiteConfigAccess } from "@/lib/utils/access-control";

const RepoNavItem = ({
  children,
  href,
  icon,
  active,
  onClick
}: {
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  active: boolean;
  onClick?: () => void;
}) => (
  <Link
    className={cn(
      active ? "bg-accent" : "hover:bg-accent",
      "flex items-center rounded-lg px-3 py-2 font-medium focus:bg-accent outline-none"
    )}
    href={href}
    onClick={onClick}
    onNavigate={(e) => {
      if (!checkNavigationGuard(href)) e.preventDefault();
    }}
    prefetch={true}
  >
    {icon}
    <span className="truncate">{children}</span>
  </Link>
);

const RepoNav = ({
  onClick
}: {
  onClick?: () => void;
}) => {
  const { config } = useConfig();
  const { user } = useUser();
  const pathname = usePathname();
  const { features } = useSiteFeatures();

  const items = useMemo(() => {
    if (!config || !config.object) return [];
    const configObject: any = config.object;
    type ContentItem = { type: string; name: string };
    const contentItems = configObject.content
      ?.filter((item: any) => {
        if (item.type !== "collection") return true;
        if (item.name === "pages" || item.name === "templates") return true;
        return features[item.name] !== false;
      })
      .filter((item: ContentItem) => !user || hasCollectionAccess(user, item.name))
      .map((item: any) => ({
        key: item.name,
        icon: item.type === "collection"
          ? <FileStack className="h-5 w-5 mr-2" />
          : <FileText className="h-5 w-5 mr-2" />
        ,
        href: `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/${item.type}/${encodeURIComponent(item.name)}`,
        label: item.label || item.name,
      })) || [];

    const hasMediaScope = !user || hasMediaAccess(user);
    const hasConfigScope = !user || hasSiteConfigAccess(user);

    const mediaItems = hasMediaScope ? [{
      key: "media",
      icon: <FolderOpen className="h-5 w-5 mr-2" />,
      href: `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/media`,
      label: "Media"
    }] : [];

    const settingsItem = !configObject.settings?.hide && hasConfigScope
      ? {
        key: "settings",
        icon: <Settings className="h-5 w-5 mr-2" />,
        href: `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/settings`,
        label: "Settings"
      }
      : null;

    const usersItem =
      user && isAdminUser(user)
        ? {
            key: "users",
            icon: <Users className="h-5 w-5 mr-2" />,
            href: `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/users`,
            label: "Users",
          }
        : null;

    const analyticsItem = {
      key: "analytics",
      icon: <BarChart3 className="h-5 w-5 mr-2" />,
      href: `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/analytics`,
      label: "Analytics",
    };

    return [
      ...contentItems,
      ...mediaItems,
      analyticsItem,
      usersItem,
      settingsItem,
    ].filter(Boolean);
  }, [config, features, user]);

  if (!items.length) return null;

  return (
    <>
      {items.map(item => (
        <RepoNavItem
          key={item.key}
          icon={item.icon}
          href={item.href}
          active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          onClick={onClick}
        >
          {item.label}
        </RepoNavItem>
      ))}
    </>
  );
}

export { RepoNav };