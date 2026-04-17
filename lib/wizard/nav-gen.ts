export interface WizardFeatures {
  sermons?: boolean;
  series?: boolean;
  ministries?: boolean;
  events?: boolean;
  articles?: boolean;
  staff?: boolean;
  bulletins?: boolean;
  leadership?: boolean;
  givingUrl?: string;
  siteType?: "church" | "organization";
  visitPageEnabled?: boolean;
}

export function generateNav(features: WizardFeatures) {
  const items: unknown[] = [];

  items.push({ type: "search", enabled: true });

  if (features.sermons) {
    const mediaColumns: unknown[] = [
      {
        heading: "Sermons",
        icon: "video",
        links: [
          { label: "All Sermons", href: "/sermons" },
          ...(features.series ? [{ label: "Series", href: "/series" }] : []),
        ],
      },
    ];
    if (features.articles) {
      mediaColumns.push({
        heading: "Resources",
        icon: "book-open",
        links: [
          { label: "Articles", href: "/articles" },
          ...(features.bulletins ? [{ label: "Bulletins", href: "/bulletins" }] : []),
        ],
      });
    }
    items.push({ type: "link", label: "Media", href: "/sermons", columns: mediaColumns });
  }

  if (features.events) {
    items.push({ type: "link", label: "Events", href: "/events" });
  }

  if (features.articles && !features.sermons) {
    items.push({ type: "link", label: "Articles", href: "/articles" });
  }

  const isChurch = features.siteType !== "organization";
  const visitEnabled = features.visitPageEnabled !== false;

  const aboutLinks = [
    { label: "About Us", href: "/about" },
    ...(isChurch ? [{ label: "What We Believe", href: "/beliefs" }] : []),
    ...(features.leadership ? [{ label: "Leadership", href: "/leadership" }] : []),
    ...(features.staff ? [{ label: "Our Staff", href: "/staff" }] : []),
    { label: "FAQ", href: "/faq" },
  ];
  const visitLinks = [
    ...(visitEnabled ? [{ label: "Plan Your Visit", href: "/visit" }] : []),
    { label: "Contact Us", href: "/contact" },
  ];
  items.push({
    type: "link",
    label: "About",
    href: "/about",
    columns: [
      { heading: isChurch ? "Our Church" : "About Us", icon: isChurch ? "church" : "info", links: aboutLinks },
      { heading: "Visit", icon: "map-pin", links: visitLinks },
    ],
  });

  items.push({
    type: "cta",
    enabled: Boolean(features.givingUrl),
    label: "Give",
    href: features.givingUrl ?? "#",
  });

  return {
    desktopStyle: "dropdown-columns",
    mobileStyle: "drawer",
    background: "transparent",
    items,
  };
}
