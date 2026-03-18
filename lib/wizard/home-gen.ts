export interface HomeGenOptions {
  photos?: boolean;
  sermons?: boolean;
  ministries?: boolean;
  events?: boolean;
  articles?: boolean;
  streaming?: boolean;
  channelId?: string;
  heroImage?: string;
  heroVideo?: string;
  marqueeImages?: string[];
  serviceTimes?: { time: string; label: string }[];
  name?: string;
  description?: string;
}

export function generateHomeBlocks(opts: HomeGenOptions): unknown[] {
  const blocks: unknown[] = [];

  blocks.push({
    type: "hero",
    variant: "centered",
    backgroundType: opts.heroVideo ? "video" : opts.heroImage ? "image" : "default",
    ...(opts.heroImage ? { backgroundImage: opts.heroImage } : {}),
    ...(opts.heroVideo ? { backgroundVideo: opts.heroVideo } : {}),
    blockHeight: "full",
    headline: opts.name ? `Welcome to ${opts.name}` : "Welcome",
    showSubheadline: Boolean(opts.description),
    subheadline: opts.description ?? "",
    overlayOpacity: 40,
    showScrollIndicator: true,
    showPrimaryCta: false,
    showSecondaryCta: false,
  });

  if ((opts.marqueeImages?.length ?? 0) > 0) {
    blocks.push({
      type: "image-marquee",
      images: (opts.marqueeImages ?? []).map(src => ({ src, alt: "" })),
      speed: 30,
      direction: "left",
      imageStyle: "freeform",
      enableDragScroll: true,
    });
  }

  if (opts.ministries) {
    blocks.push({
      type: "ministry-links",
      displayMode: "icons",
      showTitle: false,
      showDescription: false,
    });
  }

  const times = opts.serviceTimes ?? [];
  blocks.push({
    type: "service-times",
    mobileAlignment: "center",
    showTitle: true,
    title: "Come Be Our Guest",
    showDescription: false,
    times: times.map(t => ({ time: t.time, label: t.label })),
  });

  if (opts.streaming && opts.channelId) {
    blocks.push({
      type: "video-embed",
      title: "Join Us Live",
      useYoutubeLive: true,
      channelId: opts.channelId,
      aspectRatio: "16:9",
      showTitle: true,
    });
  }

  if (opts.sermons) {
    blocks.push({
      type: "sermon-grid",
      title: "Recent Sermons",
      count: 3,
      columns: 3,
      showTitle: true,
      showDescription: false,
      showViewAll: true,
      showAll: false,
    });
  }

  if (opts.events) {
    blocks.push({
      type: "event-list",
      title: "Upcoming Events",
      count: 4,
      columns: 3,
      showTitle: true,
      showDescription: false,
      showViewAll: true,
      showAll: false,
    });
  }

  if (opts.articles) {
    blocks.push({
      type: "article-grid",
      title: "Latest Articles",
      count: 3,
      columns: 3,
      showTitle: true,
      showDescription: false,
      showViewAll: true,
      showAll: false,
    });
  }

  blocks.push({
    type: "cta",
    variant: "primary",
    headline: "Join Us This Sunday",
    showDescription: false,
    showPrimaryCta: true,
    primaryCta: { label: "Plan Your Visit", href: "/visit" },
    showSecondaryCta: false,
  });

  return blocks;
}
