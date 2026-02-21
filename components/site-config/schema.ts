import { z } from "zod";

const navLinkSchema = z.object({
  label: z.string().min(1, "Label is required"),
  href: z.string().min(1, "URL is required"),
  description: z.string().optional(),
});

const navColumnSchema = z.object({
  heading: z.string().min(1, "Heading is required"),
  links: z.array(navLinkSchema).default([]),
  icon: z.string().optional(),
});

const navElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("link"),
    label: z.string().min(1, "Label is required"),
    href: z.string().optional(),
    columns: z.array(navColumnSchema).optional(),
    featured: z
      .object({
        type: z.enum(["sermon", "event", "article"]),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("search"),
    enabled: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("cta"),
    enabled: z.boolean().default(true),
    label: z.string().default(""),
    href: z.string().default(""),
  }),
]);

const customThemeSchema = z.object({
  primary: z.string().optional(),
  primaryForeground: z.string().optional(),
  secondary: z.string().optional(),
  accent: z.string().optional(),
  background: z.string().optional(),
  surface: z.string().optional(),
  text: z.string().optional(),
  textMuted: z.string().optional(),
  border: z.string().optional(),
});

const serviceTimeSchema = z.object({
  day: z.string().min(1, "Day is required"),
  time: z.string().min(1, "Time is required"),
  name: z.string().min(1, "Name is required"),
});

export const siteConfigSchema = z.object({
  name: z.string().min(1, "Site name is required"),
  description: z.string().default(""),

  theme: z.enum(["default", "warm", "ocean", "forest", "custom"]).default("default"),
  customTheme: customThemeSchema.optional(),
  fonts: z.object({
    heading: z.string().min(1, "Heading font is required"),
    body: z.string().min(1, "Body font is required"),
    google: z.string().optional(),
  }),

  navigation: z.object({
    desktopStyle: z.enum(["dropdown-columns", "dropdown", "simple"]).default("dropdown-columns"),
    mobileStyle: z.enum(["drawer", "fullscreen", "slidedown"]).default("drawer"),
    background: z.enum(["solid", "transparent"]).default("solid"),
    items: z.array(navElementSchema).default([]),
  }),

  footer: z.object({
    variant: z.enum(["comprehensive", "minimal"]).default("comprehensive"),
    style: z.enum(["centered", "left-aligned"]).default("centered"),
    socialLinks: z
      .array(
        z.object({
          platform: z.string().default("custom"),
          url: z.string().default(""),
          label: z.string().optional(),
          icon: z.string().optional(),
        })
      )
      .default([]),
    sections: z
      .array(
        z.object({
          heading: z.string().min(1, "Heading is required"),
          icon: z.string().optional(),
          links: z.array(navLinkSchema).default([]),
        })
      )
      .default([]),
  }),

  contact: z.object({
    email: z.string().email("Must be a valid email").or(z.literal("")),
    phone: z.string().default(""),
    address: z.object({
      street: z.string().default(""),
      city: z.string().default(""),
      state: z.string().default(""),
      zip: z.string().default(""),
    }),
  }),

  serviceTimes: z.array(serviceTimeSchema).default([]),

  integrations: z.object({
    youtubeApiKey: z.string().default(""),
  }),

  features: z.object({
    articles: z.boolean().default(true),
    events: z.boolean().default(true),
    ministries: z.boolean().default(true),
    series: z.boolean().default(true),
    sermons: z.boolean().default(true),
    staff: z.boolean().default(true),
  }),
});

export type SiteConfigFormValues = z.infer<typeof siteConfigSchema>;
