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
}

export function generateHomeBlocks(opts: HomeGenOptions): unknown[] {
  const blocks: unknown[] = [];

  blocks.push({
    type: "hero",
    variant: "center",
    backgroundType: opts.heroVideo ? "video" : opts.heroImage ? "image" : "color",
    ...(opts.heroImage ? { backgroundImage: opts.heroImage } : {}),
    ...(opts.heroVideo ? { backgroundVideo: opts.heroVideo } : {}),
    blockHeight: "full",
    headline: "Welcome",
    subheadline: "We're glad you're here.",
    overlayOpacity: 40,
    scrollIndicator: false,
  });

  if (opts.photos) {
    blocks.push({
      type: "image-marquee",
      images: [],
      speed: 30,
      direction: "left",
      imageStyle: "square",
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
    primaryCta: { label: "Plan Your Visit", href: "/visit" },
  });

  return blocks;
}
