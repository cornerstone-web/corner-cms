export type StepKey =
  | "welcome" | "identity" | "logo" | "favicon" | "theme"
  | "contact" | "contact-form" | "location" | "services"
  | "social" | "giving" | "streaming"
  | "sermons" | "series" | "ministries" | "events" | "articles"
  | "staff" | "bulletins" | "leadership"
  | "first-sermon" | "first-series" | "first-ministry" | "first-event"
  | "first-article" | "first-staff" | "first-leaders"
  | "hero" | "photos"
  | "launched";

export interface StepDef {
  key: StepKey;
  label: string;
  group: string;
  /** If defined, this step is only shown when the given feature step key is in completedSteps */
  showWhen?: StepKey;
}

export interface StepGroup {
  key: string;
  label: string;
  steps: StepDef[];
}

export const STEP_GROUPS: StepGroup[] = [
  {
    key: "congregation",
    label: "Your Congregation",
    steps: [
      { key: "welcome", label: "Welcome", group: "congregation" },
      { key: "identity", label: "Church Identity", group: "congregation" },
      { key: "logo", label: "Logo", group: "congregation" },
      { key: "favicon", label: "Favicon", group: "congregation" },
      { key: "theme", label: "Theme & Colors", group: "congregation" },
      { key: "contact", label: "Contact Info", group: "congregation" },
      { key: "contact-form", label: "Contact Form", group: "congregation" },
      { key: "location", label: "Location", group: "congregation" },
      { key: "services", label: "Service Times", group: "congregation" },
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
      { key: "series", label: "Sermon Series", group: "features", showWhen: "sermons" },
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
      { key: "first-sermon", label: "First Sermon", group: "content", showWhen: "sermons" },
      { key: "first-series", label: "First Series", group: "content", showWhen: "series" },
      { key: "first-ministry", label: "Ministries", group: "content", showWhen: "ministries" },
      { key: "first-event", label: "First Event", group: "content", showWhen: "events" },
      { key: "first-article", label: "First Article", group: "content", showWhen: "articles" },
      { key: "first-staff", label: "Staff Members", group: "content", showWhen: "staff" },
      { key: "first-leaders", label: "Leadership", group: "content", showWhen: "leadership" },
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

/** Returns the list of steps that should be visible given the current completedSteps set */
export function getVisibleSteps(completedSteps: Set<string>): StepDef[] {
  return ALL_STEPS.filter(s => !s.showWhen || completedSteps.has(s.showWhen));
}

/** Returns the first incomplete step from the visible steps list */
export function getCurrentStep(completedSteps: Set<string>): StepKey {
  const visible = getVisibleSteps(completedSteps);
  const first = visible.find(s => !completedSteps.has(s.key));
  return first?.key ?? "launched";
}
