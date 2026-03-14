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
  const churchLinks: FooterLink[] = [
    { label: "About Us", href: "/about" },
    { label: "What We Believe", href: "/beliefs" },
  ];
  if (features.leadership) {
    churchLinks.push({ label: "Leadership", href: "/leadership" });
  }
  if (features.staff) {
    churchLinks.push({ label: "Our Staff", href: "/staff" });
  }
  churchLinks.push({ label: "Plan Your Visit", href: "/visit" });
  churchLinks.push({ label: "Contact Us", href: "/contact" });

  sections.push({ heading: "Our Church", links: churchLinks });

  // "Resources" section — only if at least one resource feature is enabled
  const resourceLinks: FooterLink[] = [];
  if (features.sermons) {
    resourceLinks.push({ label: "Sermons", href: "/sermons" });
  }
  if (features.series) {
    resourceLinks.push({ label: "Series", href: "/sermons" });
  }
  if (features.events) {
    resourceLinks.push({ label: "Events", href: "/events" });
  }
  if (features.ministries) {
    resourceLinks.push({ label: "Ministries", href: "/ministries" });
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
