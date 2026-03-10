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
}

export function generateNav(features: WizardFeatures) {
  const items: unknown[] = [];

  items.push({ type: "search", enabled: true });

  if (features.sermons) {
    const mediaColumns: unknown[] = [
      {
        label: "Sermons",
        links: [
          { label: "All Sermons", href: "/sermons" },
          ...(features.series ? [{ label: "Series", href: "/sermons" }] : []),
        ],
      },
    ];
    if (features.articles) {
      mediaColumns.push({
        label: "Resources",
        links: [
          { label: "Articles", href: "/articles" },
          ...(features.bulletins ? [{ label: "Bulletins", href: "/bulletins" }] : []),
        ],
      });
    }
    items.push({ type: "link", label: "Media", href: "/sermons", columns: mediaColumns });
  }

  if (features.ministries) {
    items.push({ type: "link", label: "Ministries", href: "/ministries" });
  }

  if (features.events) {
    items.push({ type: "link", label: "Events", href: "/events" });
  }

  if (features.articles && !features.sermons) {
    items.push({ type: "link", label: "Articles", href: "/articles" });
  }

  const aboutLinks = [
    { label: "About Us", href: "/about" },
    { label: "What We Believe", href: "/beliefs" },
    ...(features.leadership ? [{ label: "Leadership", href: "/leadership" }] : []),
    ...(features.staff ? [{ label: "Our Staff", href: "/staff" }] : []),
  ];
  const visitLinks = [
    { label: "Plan Your Visit", href: "/visit" },
    { label: "Contact Us", href: "/contact" },
  ];
  items.push({
    type: "link",
    label: "About",
    href: "/about",
    columns: [
      { label: "Our Church", links: aboutLinks },
      { label: "Visit", links: visitLinks },
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
