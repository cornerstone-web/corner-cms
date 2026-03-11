"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";
import { getCurrentStep, getVisibleSteps, StepKey } from "./steps";
import WizardTimeline from "./WizardTimeline";
import { User } from "@/components/user";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  const [sheetOpen, setSheetOpen] = useState(false);

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
        initialDescription={(cfg.description as string) || ""}
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

  const timeline = (
    <WizardTimeline
      visibleSteps={visibleSteps}
      completedSteps={completedSteps}
      currentStep={currentStep}
      onNavigate={(step) => { setCurrentStep(step); setSheetOpen(false); }}
    />
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top header */}
      <header className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <h1 className="text-sm font-semibold truncate flex-1 text-center sm:text-left">
          Setting Up {church.displayName}
        </h1>
        {/* Mobile steps toggle */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            {timeline}
          </SheetContent>
        </Sheet>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:block shrink-0">
          {timeline}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-2xl">
            {renderCurrentStep()}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="flex items-center gap-2 border-t px-2 py-2 lg:px-4 lg:py-3 shrink-0">
        <User className="mr-auto" />
      </footer>
    </div>
  );
}
