"use client";

import { useState } from "react";
import { getCurrentStep, getVisibleSteps, StepKey } from "./steps";
import WizardTimeline from "./WizardTimeline";
import BuildProgressStep from "./steps/BuildProgressStep";
import LaunchStep from "./steps/LaunchStep";
import WelcomeStep from "./steps/WelcomeStep";
import IdentityStep from "./steps/IdentityStep";
import LogoStep from "./steps/LogoStep";
import FaviconStep from "./steps/FaviconStep";
import ThemeStep from "./steps/ThemeStep";
import ContactStep from "./steps/ContactStep";
import ContactFormStep from "./steps/ContactFormStep";
import LocationStep from "./steps/LocationStep";
import ServicesStep from "./steps/ServicesStep";
import SocialStep from "./steps/SocialStep";
import GivingStep from "./steps/GivingStep";
import StreamingStep from "./steps/StreamingStep";
import SermonFeatureStep from "./steps/SermonFeatureStep";
import SeriesFeatureStep from "./steps/SeriesFeatureStep";
import MinistriesFeatureStep from "./steps/MinistriesFeatureStep";
import EventsFeatureStep from "./steps/EventsFeatureStep";
import ArticlesFeatureStep from "./steps/ArticlesFeatureStep";
import StaffFeatureStep from "./steps/StaffFeatureStep";
import BulletinsFeatureStep from "./steps/BulletinsFeatureStep";
import LeadershipFeatureStep from "./steps/LeadershipFeatureStep";
import MembersFeatureStep from "./steps/MembersFeatureStep";
import FirstSermonStep from "./steps/FirstSermonStep";
import FirstSeriesStep from "./steps/FirstSeriesStep";
import FirstMinistryStep from "./steps/FirstMinistryStep";
import FirstEventStep from "./steps/FirstEventStep";
import FirstArticleStep from "./steps/FirstArticleStep";
import StaffStep from "./steps/StaffStep";
import LeadersStep from "./steps/LeadersStep";
import HeroStep from "./steps/HeroStep";
import PhotosStep from "./steps/PhotosStep";

interface WizardShellProps {
  church: {
    id: string;
    displayName: string;
    slug: string;
  };
  completedStepsArray: string[];
  initialConfig: Record<string, unknown>;
  initialLogoUrl?: string;
  initialFaviconUrl?: string;
}

function extractSocialLinks(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const item of raw) {
      if (item?.platform && item?.url) out[item.platform as string] = item.url as string;
    }
    return out;
  }
  if (typeof raw === "object") return raw as Record<string, string>;
  return {};
}

export default function WizardShell({ church, completedStepsArray, initialConfig, initialLogoUrl, initialFaviconUrl }: WizardShellProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    () => new Set(completedStepsArray)
  );
  const [currentStep, setCurrentStep] = useState<StepKey>(() => getCurrentStep(new Set(completedStepsArray)));
  const [launched, setLaunched] = useState<{ cfPagesUrl: string } | null>(null);

  function handleComplete(stepKey: StepKey) {
    const next = new Set(completedSteps);
    next.add(stepKey);
    setCompletedSteps(next);
    setCurrentStep(getCurrentStep(next));
  }

  // Post-launch: full-screen build progress replaces the entire wizard layout
  if (launched) {
    return <BuildProgressStep church={church} cfPagesUrl={launched.cfPagesUrl} />;
  }

  const visibleSteps = getVisibleSteps(completedSteps);

  function renderCurrentStep() {
    const base = { church, onComplete: () => handleComplete(currentStep) };
    const cfg = initialConfig;
    const contact = (cfg.contact as Record<string, unknown> | undefined) ?? {};
    const address = (contact.address as Record<string, string> | undefined) ?? {};
    const features = (cfg.features as Record<string, boolean> | undefined) ?? {};
    const social = extractSocialLinks((cfg.footer as Record<string, unknown> | undefined)?.socialLinks);

    switch (currentStep) {
      case "welcome": return <WelcomeStep {...base} />;
      case "identity": return <IdentityStep {...base}
        initialName={(cfg.name as string) || church.displayName}
        initialTagline={(cfg.tagline as string) || ""}
      />;
      case "logo": return <LogoStep {...base}
        initialLogoUrl={initialLogoUrl}
      />;
      case "favicon": return <FaviconStep {...base}
        initialFaviconUrl={initialFaviconUrl}
      />;
      case "theme": return <ThemeStep {...base}
        initialTheme={(cfg.theme as string) || "default"}
        initialCustomColors={(cfg.customTheme as Record<string, string>) || {}}
      />;
      case "contact": return <ContactStep {...base}
        initialEmail={(contact.email as string) || ""}
        initialPhone={(contact.phone as string) || ""}
      />;
      case "contact-form": return <ContactFormStep {...base} />;
      case "location": return <LocationStep {...base}
        initialStreet={address.street || ""}
        initialCity={address.city || ""}
        initialState={address.state || ""}
        initialZip={address.zip || ""}
      />;
      case "services": return <ServicesStep {...base}
        initialServiceTimes={(cfg.serviceTimes as { day: string; time: string; name?: string; label?: string }[]) || []}
      />;
      case "social": return <SocialStep {...base}
        initialSocial={social}
      />;
      case "giving": return <GivingStep {...base}
        initialGivingUrl={((cfg.giving as Record<string, string> | undefined)?.url) || ""}
      />;
      case "streaming": return <StreamingStep {...base}
        initialYoutubeApiKey={((cfg.integrations as Record<string, string> | undefined)?.youtubeApiKey) || ""}
      />;
      case "sermons": return <SermonFeatureStep {...base} initialEnabled={features.sermons} />;
      case "series": return <SeriesFeatureStep {...base} initialEnabled={features.series} />;
      case "ministries": return <MinistriesFeatureStep {...base} initialEnabled={features.ministries} />;
      case "events": return <EventsFeatureStep {...base} initialEnabled={features.events} />;
      case "articles": return <ArticlesFeatureStep {...base} initialEnabled={features.articles} />;
      case "staff": return <StaffFeatureStep {...base} initialEnabled={features.staff} />;
      case "bulletins": return <BulletinsFeatureStep {...base} initialEnabled={features.bulletins} />;
      case "leadership": return <LeadershipFeatureStep {...base} initialEnabled={features.leadership} />;
      case "members": return <MembersFeatureStep {...base} initialEnabled={features.members} />;
      case "first-sermon": return <FirstSermonStep {...base} />;
      case "first-series": return <FirstSeriesStep {...base} />;
      case "first-ministry": return <FirstMinistryStep {...base} />;
      case "first-event": return <FirstEventStep {...base} />;
      case "first-article": return <FirstArticleStep {...base} />;
      case "first-staff": return <StaffStep {...base} />;
      case "first-leaders": return <LeadersStep {...base} />;
      case "hero": return <HeroStep {...base} />;
      case "photos": return <PhotosStep {...base} />;
      case "launched": return (
        <LaunchStep
          church={church}
          completedSteps={completedSteps}
          onLaunched={(url) => setLaunched({ cfPagesUrl: url })}
        />
      );
      default: return <div className="text-muted-foreground">Step not found.</div>;
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <WizardTimeline
        visibleSteps={visibleSteps}
        completedSteps={completedSteps}
        currentStep={currentStep}
        onNavigate={setCurrentStep}
      />
      <main className="flex-1 p-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Setting Up {church.displayName}</h1>
        </div>
        {renderCurrentStep()}
      </main>
    </div>
  );
}
