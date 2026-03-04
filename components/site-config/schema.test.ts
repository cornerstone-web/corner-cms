import { describe, it, expect } from 'vitest';
import { siteConfigSchema } from './schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const minimalConfig = {
  name: 'Test Church',
  fonts: { heading: 'Inter', body: 'Inter' },
  navigation: {},
  footer: {},
  contact: { email: '', address: {} },
  integrations: {},
  features: {},
};

const ok = (data: unknown) => expect(siteConfigSchema.safeParse(data).success).toBe(true);
const fail = (data: unknown) => expect(siteConfigSchema.safeParse(data).success).toBe(false);

// ---------------------------------------------------------------------------
// Top-level required fields
// ---------------------------------------------------------------------------

describe('siteConfigSchema — required fields', () => {
  it('accepts a minimal valid config', () => ok(minimalConfig));

  it('rejects when name is missing', () =>
    fail({ ...minimalConfig, name: undefined }));

  it('rejects empty name', () =>
    fail({ ...minimalConfig, name: '' }));

  it('rejects when fonts is missing', () =>
    fail({ ...minimalConfig, fonts: undefined }));

  it('rejects when heading font is missing', () =>
    fail({ ...minimalConfig, fonts: { body: 'Inter' } }));

  it('rejects when body font is missing', () =>
    fail({ ...minimalConfig, fonts: { heading: 'Inter' } }));
});

// ---------------------------------------------------------------------------
// navElementSchema — discriminated union
// ---------------------------------------------------------------------------

describe('navElementSchema — type: link', () => {
  const linkItem = { type: 'link', label: 'Home', href: '/' };

  it('accepts a basic link element', () => {
    const cfg = { ...minimalConfig, navigation: { items: [linkItem] } };
    ok(cfg);
  });

  it('accepts a link with columns (dropdown)', () => {
    const cfg = {
      ...minimalConfig,
      navigation: {
        items: [{
          type: 'link',
          label: 'About',
          columns: [{
            heading: 'Our Story',
            links: [{ label: 'History', href: '/history' }],
          }],
        }],
      },
    };
    ok(cfg);
  });

  it('accepts a link with featured', () => {
    const cfg = {
      ...minimalConfig,
      navigation: { items: [{ type: 'link', label: 'Sermons', featured: { type: 'sermon' } }] },
    };
    ok(cfg);
  });

  it('rejects link with invalid featured type', () => {
    const cfg = {
      ...minimalConfig,
      navigation: { items: [{ type: 'link', label: 'X', featured: { type: 'invalid' } }] },
    };
    fail(cfg);
  });

  it('rejects link with missing label', () => {
    const cfg = { ...minimalConfig, navigation: { items: [{ type: 'link', href: '/' }] } };
    fail(cfg);
  });

  it('rejects link column with missing heading', () => {
    const cfg = {
      ...minimalConfig,
      navigation: {
        items: [{ type: 'link', label: 'X', columns: [{ links: [] }] }],
      },
    };
    fail(cfg);
  });
});

describe('navElementSchema — type: search', () => {
  it('accepts a search element', () => {
    const cfg = { ...minimalConfig, navigation: { items: [{ type: 'search' }] } };
    ok(cfg);
  });

  it('accepts a search element with enabled: false', () => {
    const cfg = { ...minimalConfig, navigation: { items: [{ type: 'search', enabled: false }] } };
    ok(cfg);
  });
});

describe('navElementSchema — type: cta', () => {
  it('accepts a CTA element', () => {
    const cfg = {
      ...minimalConfig,
      navigation: { items: [{ type: 'cta', label: 'Give', href: '/give' }] },
    };
    ok(cfg);
  });

  it('accepts a CTA with empty label and href (has defaults)', () => {
    const cfg = { ...minimalConfig, navigation: { items: [{ type: 'cta' }] } };
    ok(cfg);
  });
});

describe('navElementSchema — invalid type', () => {
  it('rejects an unknown nav element type', () => {
    const cfg = { ...minimalConfig, navigation: { items: [{ type: 'mega-menu' }] } };
    fail(cfg);
  });
});

// ---------------------------------------------------------------------------
// navigation enum fields
// ---------------------------------------------------------------------------

describe('navigation enum fields', () => {
  it('accepts valid desktopStyle values', () => {
    for (const style of ['dropdown-columns', 'dropdown', 'simple']) {
      ok({ ...minimalConfig, navigation: { desktopStyle: style } });
    }
  });

  it('rejects invalid desktopStyle', () => {
    fail({ ...minimalConfig, navigation: { desktopStyle: 'mega' } });
  });

  it('accepts valid mobileStyle values', () => {
    for (const style of ['drawer', 'fullscreen', 'slidedown']) {
      ok({ ...minimalConfig, navigation: { mobileStyle: style } });
    }
  });

  it('accepts valid background values', () => {
    ok({ ...minimalConfig, navigation: { background: 'solid' } });
    ok({ ...minimalConfig, navigation: { background: 'transparent' } });
  });
});

// ---------------------------------------------------------------------------
// footer schema
// ---------------------------------------------------------------------------

describe('footer schema', () => {
  it('accepts comprehensive variant', () =>
    ok({ ...minimalConfig, footer: { variant: 'comprehensive' } }));

  it('accepts minimal variant', () =>
    ok({ ...minimalConfig, footer: { variant: 'minimal' } }));

  it('rejects invalid variant', () =>
    fail({ ...minimalConfig, footer: { variant: 'full' } }));

  it('accepts centered and left-aligned styles', () => {
    ok({ ...minimalConfig, footer: { style: 'centered' } });
    ok({ ...minimalConfig, footer: { style: 'left-aligned' } });
  });

  it('rejects invalid style', () =>
    fail({ ...minimalConfig, footer: { style: 'right' } }));

  it('accepts sections with heading', () => {
    const cfg = {
      ...minimalConfig,
      footer: {
        sections: [{ heading: 'About', links: [{ label: 'Mission', href: '/mission' }] }],
      },
    };
    ok(cfg);
  });

  it('rejects section missing heading', () => {
    const cfg = {
      ...minimalConfig,
      footer: { sections: [{ links: [] }] },
    };
    fail(cfg);
  });

  it('accepts social links', () => {
    const cfg = {
      ...minimalConfig,
      footer: { socialLinks: [{ platform: 'youtube', url: 'https://youtube.com' }] },
    };
    ok(cfg);
  });
});

// ---------------------------------------------------------------------------
// contact schema
// ---------------------------------------------------------------------------

describe('contact schema', () => {
  it('accepts valid email', () =>
    ok({ ...minimalConfig, contact: { email: 'info@church.org', address: {} } }));

  it('accepts empty email string', () =>
    ok({ ...minimalConfig, contact: { email: '', address: {} } }));

  it('rejects invalid email format', () =>
    fail({ ...minimalConfig, contact: { email: 'not-an-email', address: {} } }));

  it('accepts full address', () => {
    const cfg = {
      ...minimalConfig,
      contact: {
        email: '',
        address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
      },
    };
    ok(cfg);
  });
});

// ---------------------------------------------------------------------------
// serviceTimeSchema
// ---------------------------------------------------------------------------

describe('serviceTimeSchema', () => {
  it('accepts valid service time', () => {
    const cfg = {
      ...minimalConfig,
      serviceTimes: [{ day: 'Sunday', time: '10:00 AM', name: 'Traditional' }],
    };
    ok(cfg);
  });

  it('rejects service time with missing day', () => {
    const cfg = {
      ...minimalConfig,
      serviceTimes: [{ time: '10:00 AM', name: 'Traditional' }],
    };
    fail(cfg);
  });

  it('rejects service time with empty name', () => {
    const cfg = {
      ...minimalConfig,
      serviceTimes: [{ day: 'Sunday', time: '10:00 AM', name: '' }],
    };
    fail(cfg);
  });
});

// ---------------------------------------------------------------------------
// theme
// ---------------------------------------------------------------------------

describe('theme field', () => {
  it('accepts all valid theme values', () => {
    for (const theme of ['default', 'warm', 'ocean', 'forest', 'custom']) {
      ok({ ...minimalConfig, theme });
    }
  });

  it('rejects unknown theme', () =>
    fail({ ...minimalConfig, theme: 'dark' }));

  it('accepts customTheme object with optional color strings', () => {
    const cfg = {
      ...minimalConfig,
      theme: 'custom',
      customTheme: { primary: '#ff0000', background: '#ffffff' },
    };
    ok(cfg);
  });
});

// ---------------------------------------------------------------------------
// features + integrations
// ---------------------------------------------------------------------------

describe('features', () => {
  it('accepts partial feature overrides', () =>
    ok({ ...minimalConfig, features: { articles: false } }));

  it('rejects non-boolean feature value', () =>
    fail({ ...minimalConfig, features: { articles: 'yes' } }));
});

describe('integrations', () => {
  it('accepts youtubeApiKey', () =>
    ok({ ...minimalConfig, integrations: { youtubeApiKey: 'abc123' } }));
});

// ---------------------------------------------------------------------------
// previewUrl
// ---------------------------------------------------------------------------

describe('previewUrl', () => {
  it('accepts a valid URL', () =>
    ok({ ...minimalConfig, previewUrl: 'https://example.com' }));

  it('rejects a non-URL string', () =>
    fail({ ...minimalConfig, previewUrl: 'not-a-url' }));

  it('accepts when absent', () =>
    ok({ ...minimalConfig, previewUrl: undefined }));
});
