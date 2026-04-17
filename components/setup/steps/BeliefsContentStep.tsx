"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveBeliefPage } from "@/lib/actions/setup-steps";
import WizardProseEditor from "@/components/setup/WizardProseEditor";

const DEFAULT_BELIEFS_PROSE = `## The Bible

We believe the Bible is the inspired Word of God, our only guide for faith and practice. We seek to follow the New Testament pattern for the church in all we do.

## Jesus Christ

We believe Jesus Christ is the Son of God, fully divine and fully human. Through His death, burial, and resurrection, He provides salvation to all who believe and obey.

## Salvation

We believe salvation comes through faith in Jesus Christ, demonstrated by repentance, confession, and baptism for the forgiveness of sins. We continue to grow in grace through faithful Christian living.

## The Church

We believe the church is the body of Christ, made up of all those who have been saved by His grace. We gather each Lord's Day to worship in spirit and truth.

## Worship

We worship through:
- **Singing** - A cappella, from the heart (Ephesians 5:19)
- **Prayer** - Individual and congregational (1 Thessalonians 5:17)
- **Lord's Supper** - Every Sunday (Acts 20:7)
- **Giving** - Cheerfully and generously (2 Corinthians 9:7)
- **Preaching** - Teaching God's Word (2 Timothy 4:2)`;

interface StepProps {
  site: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialProseContent?: string;
}

export default function BeliefsContentStep({ site, onComplete, initialProseContent }: StepProps) {
  const [proseContent, setProseContent] = useState(initialProseContent ?? DEFAULT_BELIEFS_PROSE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      await saveBeliefPage(site.id, site.slug, proseContent.trim());
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">What We Believe Page</h2>
        <p className="text-muted-foreground text-sm">
          Share your core beliefs. Edit the content for your What We Believe page.
        </p>
      </div>
      <div className="space-y-1.5">
        <WizardProseEditor value={proseContent} onChange={setProseContent} />
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
