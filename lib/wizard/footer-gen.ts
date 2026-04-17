import type { WizardFeatures } from "./nav-gen";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  heading: string;
  links: FooterLink[];
}

export function generateFooterSections(features: WizardFeatures): FooterSection[] {
  const sections: FooterSection[] = [];

  // "Our Church" section — always present
  const siteLinks: FooterLink[] = [
    { label: "About Us", href: "/about" },
    { label: "What We Believe", href: "/beliefs" },
  ];
  if (features.leadership) {
    siteLinks.push({ label: "Leadership", href: "/leadership" });
  }
  if (features.staff) {
    siteLinks.push({ label: "Our Staff", href: "/staff" });
  }
  siteLinks.push({ label: "FAQ", href: "/faq" });
  siteLinks.push({ label: "Plan Your Visit", href: "/visit" });
  siteLinks.push({ label: "Contact Us", href: "/contact" });

  sections.push({ heading: "Our Church", links: siteLinks });

  // "Resources" section — only if at least one resource feature is enabled
  const resourceLinks: FooterLink[] = [];
  if (features.sermons) {
    resourceLinks.push({ label: "Sermons", href: "/sermons" });
  }
  if (features.series) {
    resourceLinks.push({ label: "Series", href: "/series" });
  }
  if (features.events) {
    resourceLinks.push({ label: "Events", href: "/events" });
  }
  if (features.articles) {
    resourceLinks.push({ label: "Articles", href: "/articles" });
  }
  if (features.bulletins) {
    resourceLinks.push({ label: "Bulletins", href: "/bulletins" });
  }

  if (resourceLinks.length > 0) {
    sections.push({ heading: "Resources", links: resourceLinks });
  }

  return sections;
}
