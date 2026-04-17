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
import FirstSermonStep from "./steps/FirstSermonStep";
import FirstSeriesStep from "./steps/FirstSeriesStep";
import FirstMinistryStep from "./steps/FirstMinistryStep";
import FirstEventStep from "./steps/FirstEventStep";
import FirstArticleStep from "./steps/FirstArticleStep";
import StaffStep from "./steps/StaffStep";
import LeadersStep from "./steps/LeadersStep";
import HeroStep from "./steps/HeroStep";
import PhotosStep from "./steps/PhotosStep";
import AboutContentStep from "./steps/AboutContentStep";
import BeliefsContentStep from "./steps/BeliefsContentStep";
import VisitContentStep from "./steps/VisitContentStep";
import FAQStep from "./steps/FAQStep";
import FirstBulletinStep from "./steps/FirstBulletinStep";

interface WizardShellProps {
  site: {
    id: string;
    displayName: string;
    slug: string;
  };
  completedStepsArray: string[];
  initialConfig: Record<string, unknown>;
  initialLogoUrl?: string;
  initialHeroUrl?: string;
  initialFaviconUrl?: string;
  userEmail?: string;
  initialFirstSeries?: Record<string, unknown>;
  initialFirstSermon?: Record<string, unknown>;
  initialFirstMinistries?: Record<string, unknown>[];
  initialFirstEvent?: Record<string, unknown>;
  initialFirstArticle?: Record<string, unknown>;
  initialFirstStaff?: Record<string, unknown>[];
  initialFirstLeaders?: Record<string, unknown>[];
  initialMarqueePhotos?: { name: string; url: string }[];
  initialFirstBulletin?: { date: string; passwordProtected: boolean; password?: string };
  initialAboutProse?: string;
  initialBeliefsProse?: string;
  initialVisitProse?: string;
  initialFaqItems?: { question: string; answer: string }[];
}

export default function WizardShell({ site, completedStepsArray, initialConfig, initialLogoUrl, initialHeroUrl, initialFaviconUrl, userEmail, initialFirstSeries, initialFirstSermon, initialFirstMinistries, initialFirstEvent, initialFirstArticle, initialFirstStaff, initialFirstLeaders, initialMarqueePhotos, initialFirstBulletin, initialAboutProse, initialBeliefsProse, initialVisitProse, initialFaqItems }: WizardShellProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    () => new Set(completedStepsArray)
  );
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(() => {
    const features = (initialConfig?.features as Record<string, boolean>) ?? {};
    return new Set(Object.entries(features).filter(([, v]) => v).map(([k]) => k));
  });
  const [currentStep, setCurrentStep] = useState<StepKey>(() => getCurrentStep(new Set(completedStepsArray), new Set(Object.entries((initialConfig?.features as Record<string, boolean>) ?? {}).filter(([, v]) => v).map(([k]) => k))));
  const progressStep = getCurrentStep(completedSteps, enabledFeatures);
  const [launched, setLaunched] = useState<{ cfPagesUrl: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleComplete(stepKey: StepKey, featureEnabled?: boolean) {
    const nextCompleted = new Set(completedSteps);
    nextCompleted.add(stepKey);
    let nextFeatures = enabledFeatures;
    if (featureEnabled !== undefined) {
      nextFeatures = new Set(enabledFeatures);
      if (featureEnabled) {
        nextFeatures.add(stepKey);
      } else {
        nextFeatures.delete(stepKey);
      }
      setEnabledFeatures(nextFeatures);
    }
    setCompletedSteps(nextCompleted);
    setCurrentStep(getCurrentStep(nextCompleted, nextFeatures));
  }

  // Post-launch: full-screen build progress replaces the entire wizard layout
  if (launched) {
    return <BuildProgressStep church={site} cfPagesUrl={launched.cfPagesUrl} />;
  }

  const visibleSteps = getVisibleSteps(completedSteps, enabledFeatures);

  function renderCurrentStep() {
    const base = { church: site, onComplete: () => handleComplete(currentStep) };
    const featureOnComplete = (enabled: boolean) => handleComplete(currentStep, enabled);
    const cfg = initialConfig;
    const contact = (cfg.contact as Record<string, unknown> | undefined) ?? {};
    const address = (contact.address as Record<string, string> | undefined) ?? {};
    const features = (cfg.features as Record<string, boolean> | undefined) ?? {};

    switch (currentStep) {
      case "welcome": return <WelcomeStep {...base}
        onNavigateToIdentity={completedSteps.has("welcome") ? () => setCurrentStep("identity") : undefined}
      />;
      case "identity": return <IdentityStep {...base}
        initialName={(cfg.name as string) || site.displayName}
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
      case "contact-form": return <ContactFormStep {...base}
        initialEmail={(contact.formEmail as string) || userEmail || ""}
      />;
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
        initialLinks={Array.isArray((cfg.footer as Record<string, unknown> | undefined)?.socialLinks)
          ? (cfg.footer as Record<string, unknown>).socialLinks as { platform: string; url: string; label?: string; icon?: string }[]
          : []}
      />;
      case "giving": return <GivingStep {...base}
        initialGivingUrl={(cfg.giving as Record<string, string> | undefined)?.url}
      />;
      case "streaming": return <StreamingStep {...base}
        initialYoutubeApiKey={(cfg.integrations as Record<string, string> | undefined)?.youtubeApiKey}
        initialYoutubeChannelId={(cfg.integrations as Record<string, string> | undefined)?.youtubeChannelId}
      />;
      case "sermons": return <SermonFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("sermons") ? features.sermons : undefined} />;
      case "series": return <SeriesFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("series") ? features.series : undefined} />;
      case "ministries": return <MinistriesFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("ministries") ? features.ministries : undefined} />;
      case "events": return <EventsFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("events") ? features.events : undefined} />;
      case "articles": return <ArticlesFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("articles") ? features.articles : undefined} />;
      case "staff": return <StaffFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("staff") ? features.staff : undefined} />;
      case "bulletins": return <BulletinsFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("bulletins") ? features.bulletins : undefined} />;
      case "leadership": return <LeadershipFeatureStep church={site} onComplete={featureOnComplete} initialEnabled={completedSteps.has("leadership") ? features.leadership : undefined} />;
      case "first-series": return <FirstSeriesStep {...base}
        initialTitle={initialFirstSeries?.title as string | undefined}
        initialDescription={initialFirstSeries?.description as string | undefined}
      />;
      case "first-sermon": {
        const sermonBlocks = initialFirstSermon?.blocks as { type: string; url?: string; content?: string }[] | undefined;
        const existingVideoUrl = sermonBlocks?.find(b => b.type === "video-embed")?.url;
        const existingProseContent = sermonBlocks?.find(b => b.type === "prose")?.content;
        return <FirstSermonStep {...base}
          initialTitle={initialFirstSermon?.title as string | undefined}
          initialDate={initialFirstSermon?.date as string | undefined}
          initialSpeaker={initialFirstSermon?.speaker as string | undefined}
          initialSeries={
            (initialFirstSermon?.series as string | undefined) ||
            (completedSteps.has("first-series") ? initialFirstSeries?.title as string | undefined : undefined)
          }
          initialDescription={initialFirstSermon?.description as string | undefined}
          initialProseContent={existingProseContent}
          initialVideoUrl={existingVideoUrl}
        />;
      }
      case "first-ministry": return <FirstMinistryStep {...base}
        initialMinistries={initialFirstMinistries?.map(m => {
          const blocks = m.blocks as { type: string; content?: string }[] | undefined;
          return {
            name: m.title as string ?? "",
            description: m.description as string | undefined,
            icon: m.icon as string | undefined,
            proseContent: blocks?.find(b => b.type === "prose")?.content,
          };
        })}
      />;
      case "first-event": {
        const eventBlocks = initialFirstEvent?.blocks as { type: string; content?: string }[] | undefined;
        const existingEventProse = eventBlocks?.find(b => b.type === "prose")?.content;
        return <FirstEventStep {...base}
          initialTitle={initialFirstEvent?.title as string | undefined}
          initialDate={initialFirstEvent?.date as string | undefined}
          initialTime={initialFirstEvent?.time as string | undefined}
          initialLocation={initialFirstEvent?.location as string | undefined}
          initialDescription={initialFirstEvent?.description as string | undefined}
          initialProseContent={existingEventProse}
        />;
      }
      case "first-article": {
        const articleBlocks = initialFirstArticle?.blocks as { type: string; content?: string }[] | undefined;
        const existingArticleProse = articleBlocks?.find(b => b.type === "prose")?.content;
        return <FirstArticleStep {...base}
          initialTitle={initialFirstArticle?.title as string | undefined}
          initialAuthor={initialFirstArticle?.author as string | undefined}
          initialCategory={initialFirstArticle?.category as string | undefined}
          initialDescription={initialFirstArticle?.description as string | undefined}
          initialProseContent={existingArticleProse}
        />;
      }
      case "first-staff": return <StaffStep {...base}
        initialMembers={initialFirstStaff?.map(m => {
          const blocks = m.blocks as { type: string; content?: string }[] | undefined;
          return {
            name: m.name as string ?? "",
            title: m.title as string | undefined,
            proseContent: blocks?.find(b => b.type === "prose")?.content,
            photoUrl: m.photoUrl as string | undefined,
          };
        })}
      />;
      case "first-leaders": return <LeadersStep {...base}
        initialLeaders={initialFirstLeaders?.map(l => ({
          name: l.name as string ?? "",
          role: l.role as string ?? "",
          photoUrl: l.photoUrl as string | undefined,
          existingPhotoPath: (l.existingPhotoPath ?? l.photo) as string | undefined,
        }))}
      />;
      case "first-bulletin": return <FirstBulletinStep {...base} initialDate={initialFirstBulletin?.date} initialPasswordProtected={initialFirstBulletin?.passwordProtected} initialPassword={initialFirstBulletin?.password} />;
      case "about-content": return <AboutContentStep {...base} initialProseContent={initialAboutProse} />;
      case "beliefs-content": return <BeliefsContentStep {...base} initialProseContent={initialBeliefsProse} />;
      case "visit-content": return <VisitContentStep {...base} initialProseContent={initialVisitProse} initialServiceTimes={(cfg.serviceTimes as { day?: string; time?: string; name?: string; label?: string }[] | undefined) ?? []} />;
      case "faq-content": return <FAQStep {...base} initialItems={initialFaqItems} />;
      case "hero": return <HeroStep {...base} initialHeroUrl={initialHeroUrl} />;
      case "photos": return <PhotosStep {...base} initialPhotos={initialMarqueePhotos} />;
      case "launched": return (
        <LaunchStep
          church={site}
          completedSteps={completedSteps}
          onLaunched={(url) => setLaunched({ cfPagesUrl: url })}
        />
      );
      default: return <div className="text-muted-foreground">Step not found.</div>;
    }
  }

  const desktopTimeline = (
    <WizardTimeline
      visibleSteps={visibleSteps}
      completedSteps={completedSteps}
      currentStep={currentStep}
      progressStep={progressStep}
      onNavigate={setCurrentStep}
    />
  );

  const mobileTimeline = (
    <WizardTimeline
      visibleSteps={visibleSteps}
      completedSteps={completedSteps}
      currentStep={currentStep}
      progressStep={progressStep}
      onNavigate={(step) => { setCurrentStep(step); setSheetOpen(false); }}
      className="border-r-0 w-full"
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
          Setting Up {site.displayName}
        </h1>
        {/* Mobile steps toggle */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            {mobileTimeline}
          </SheetContent>
        </Sheet>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex shrink-0 overflow-hidden">
          {desktopTimeline}
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
