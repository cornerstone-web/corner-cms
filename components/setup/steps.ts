export type StepKey =
  | "welcome" | "identity" | "logo" | "favicon" | "theme"
  | "contact" | "contact-form" | "location" | "services"
  | "social" | "giving" | "streaming"
  | "sermons" | "series" | "ministries" | "events" | "articles"
  | "staff" | "bulletins" | "leadership"
  | "first-sermon" | "first-series" | "first-ministry" | "first-event"
  | "first-article" | "first-staff" | "first-leaders" | "first-bulletin"
  | "about-content" | "beliefs-content" | "visit-content" | "faq-content"
  | "hero" | "photos"
  | "launched";

export interface StepDef {
  key: StepKey;
  label: string;
  group: string;
  /** If defined, this step is only shown when the given step key is in completedSteps */
  showWhen?: StepKey;
  /** If defined, this step is only shown when the given feature name is in enabledFeatures */
  showWhenFeature?: string;
}

export interface StepGroup {
  key: string;
  label: string;
  steps: StepDef[];
}

export const STEP_GROUPS: StepGroup[] = [
  {
    key: "site",
    label: "Your Site",
    steps: [
      { key: "welcome", label: "Welcome", group: "site" },
      { key: "identity", label: "Identity", group: "site" },
      { key: "logo", label: "Logo", group: "site" },
      { key: "favicon", label: "Favicon", group: "site" },
      { key: "theme", label: "Theme & Colors", group: "site" },
      { key: "contact", label: "Contact Info", group: "site" },
      { key: "contact-form", label: "Contact Form", group: "site" },
      { key: "location", label: "Location", group: "site" },
      { key: "services", label: "Service Times", group: "site" },
    ],
  },
  {
    key: "online",
    label: "Online Presence",
    steps: [
      { key: "social", label: "Social Media", group: "online" },
      { key: "giving", label: "Online Giving", group: "online" },
      { key: "streaming", label: "Live Streaming", group: "online" },
    ],
  },
  {
    key: "features",
    label: "Your Features",
    steps: [
      { key: "sermons", label: "Sermons", group: "features" },
      { key: "series", label: "Sermon Series", group: "features", showWhenFeature: "sermons" },
      { key: "ministries", label: "Ministries", group: "features" },
      { key: "events", label: "Events", group: "features" },
      { key: "articles", label: "Articles", group: "features" },
      { key: "staff", label: "Staff Directory", group: "features" },
      { key: "bulletins", label: "Bulletins", group: "features" },
      { key: "leadership", label: "Leadership", group: "features" },
    ],
  },
  {
    key: "content",
    label: "Your First Content",
    steps: [
      { key: "first-series", label: "First Series", group: "content", showWhenFeature: "series" },
      { key: "first-sermon", label: "First Sermon", group: "content", showWhenFeature: "sermons" },
      { key: "first-ministry", label: "Ministries", group: "content", showWhenFeature: "ministries" },
      { key: "first-event", label: "First Event", group: "content", showWhenFeature: "events" },
      { key: "first-article", label: "First Article", group: "content", showWhenFeature: "articles" },
      { key: "first-staff", label: "Staff Members", group: "content", showWhenFeature: "staff" },
      { key: "first-leaders", label: "Leadership", group: "content", showWhenFeature: "leadership" },
      { key: "first-bulletin", label: "First Bulletin", group: "content", showWhenFeature: "bulletins" },
    ],
  },
  {
    key: "pages",
    label: "Pages",
    steps: [
      { key: "about-content", label: "About Us", group: "pages" },
      { key: "beliefs-content", label: "What We Believe", group: "pages" },
      { key: "visit-content", label: "Plan Your Visit", group: "pages" },
      { key: "faq-content", label: "FAQ", group: "pages" },
    ],
  },
  {
    key: "home",
    label: "Home Page",
    steps: [
      { key: "hero", label: "Hero Image", group: "home" },
      { key: "photos", label: "Featured Photos", group: "home" },
    ],
  },
  {
    key: "launch",
    label: "Launch",
    steps: [
      { key: "launched", label: "Launch Your Site", group: "launch" },
    ],
  },
];

// Flat ordered list of ALL steps
export const ALL_STEPS: StepDef[] = STEP_GROUPS.flatMap(g => g.steps);

/** Returns the list of steps that should be visible given the current state */
export function getVisibleSteps(completedSteps: Set<string>, enabledFeatures?: Set<string>): StepDef[] {
  return ALL_STEPS.filter(s => {
    if (s.showWhenFeature) {
      return enabledFeatures ? enabledFeatures.has(s.showWhenFeature) : completedSteps.has(s.showWhenFeature);
    }
    if (s.showWhen) return completedSteps.has(s.showWhen);
    return true;
  });
}

/** Returns the first incomplete step from the visible steps list */
export function getCurrentStep(completedSteps: Set<string>, enabledFeatures?: Set<string>): StepKey {
  const visible = getVisibleSteps(completedSteps, enabledFeatures);
  const first = visible.find(s => !completedSteps.has(s.key));
  return first?.key ?? "launched";
}
