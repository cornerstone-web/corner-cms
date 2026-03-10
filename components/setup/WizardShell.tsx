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
}

export default function WizardShell({ church, completedStepsArray }: WizardShellProps) {
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
    const stepProps = { church, onComplete: () => handleComplete(currentStep) };

    switch (currentStep) {
      case "welcome": return <WelcomeStep {...stepProps} />;
      case "identity": return <IdentityStep {...stepProps} />;
      case "logo": return <LogoStep {...stepProps} />;
      case "favicon": return <FaviconStep {...stepProps} />;
      case "theme": return <ThemeStep {...stepProps} />;
      case "contact": return <ContactStep {...stepProps} />;
      case "location": return <LocationStep {...stepProps} />;
      case "services": return <ServicesStep {...stepProps} />;
      case "social": return <SocialStep {...stepProps} />;
      case "giving": return <GivingStep {...stepProps} />;
      case "streaming": return <StreamingStep {...stepProps} />;
      case "sermons": return <SermonFeatureStep {...stepProps} />;
      case "series": return <SeriesFeatureStep {...stepProps} />;
      case "ministries": return <MinistriesFeatureStep {...stepProps} />;
      case "events": return <EventsFeatureStep {...stepProps} />;
      case "articles": return <ArticlesFeatureStep {...stepProps} />;
      case "staff": return <StaffFeatureStep {...stepProps} />;
      case "bulletins": return <BulletinsFeatureStep {...stepProps} />;
      case "leadership": return <LeadershipFeatureStep {...stepProps} />;
      case "members": return <MembersFeatureStep {...stepProps} />;
      case "first-sermon": return <FirstSermonStep {...stepProps} />;
      case "first-series": return <FirstSeriesStep {...stepProps} />;
      case "first-ministry": return <FirstMinistryStep {...stepProps} />;
      case "first-event": return <FirstEventStep {...stepProps} />;
      case "first-article": return <FirstArticleStep {...stepProps} />;
      case "first-staff": return <StaffStep {...stepProps} />;
      case "first-leaders": return <LeadersStep {...stepProps} />;
      case "hero": return <HeroStep {...stepProps} />;
      case "photos": return <PhotosStep {...stepProps} />;
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
