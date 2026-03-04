import { describe, it, expect, vi } from 'vitest';

/**
 * configSchema.ts uses a static ESM import:
 *   import { fieldTypes } from "@/fields/registry"
 * vi.mock() intercepts static ESM imports (unlike CJS require()), so this
 * works here without the require.cache injection used in schema.test.ts.
 */
vi.mock('@/fields/registry', () => ({
  fieldTypes: new Set(['string', 'text', 'boolean', 'number', 'select', 'image', 'date', 'rich-text']),
}));

import { ConfigSchema } from './configSchema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = (data: unknown) => expect(ConfigSchema.safeParse(data).success).toBe(true);
const fail = (data: unknown) => expect(ConfigSchema.safeParse(data).success).toBe(false);

/** Wrap a field definition in a minimal content collection */
const withField = (field: any) => ({
  content: [{
    name: 'items',
    type: 'collection',
    path: 'content/items',
    fields: [field],
  }],
});

// ---------------------------------------------------------------------------
// Top-level: all fields optional
// ---------------------------------------------------------------------------

describe('ConfigSchema — top-level', () => {
  it('accepts an empty config (all fields optional)', () => ok({}));
  it('accepts null (passthrough + nullable)', () => ok(null));
});

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

describe('ConfigSchema — media (string)', () => {
  it('accepts a relative path string', () => ok({ media: 'src/assets/media' }));
  it('accepts empty string', () => ok({ media: '' }));
  it('rejects path with leading slash', () =>
    fail({ media: '/absolute/path' }));
  it('rejects path with trailing slash', () =>
    fail({ media: 'trailing/' }));
});

describe('ConfigSchema — media (object)', () => {
  it('accepts object with required input and output', () =>
    ok({ media: { input: 'src/assets', output: '/media' } }));
  it('rejects object with leading slash on input', () =>
    fail({ media: { input: '/src/assets', output: '/media' } }));
  it('rejects object missing input', () =>
    fail({ media: { output: '/media' } }));
  it('rejects object missing output', () =>
    fail({ media: { input: 'src/assets' } }));
  it('accepts object with optional extensions array', () =>
    ok({ media: { input: 'src/assets', output: '/media', extensions: ['jpg', 'png'] } }));
  it('accepts object with optional categories array', () =>
    ok({ media: { input: 'src/assets', output: '/media', categories: ['image', 'video'] } }));
  it('rejects invalid category value', () =>
    fail({ media: { input: 'src/assets', output: '/media', categories: ['photo'] } }));
});

describe('ConfigSchema — media (named array)', () => {
  it('accepts array of named media configs', () =>
    ok({ media: [{ name: 'images', input: 'src/assets/images', output: '/images' }] }));
  it('rejects array entries without name', () =>
    fail({ media: [{ input: 'src/assets/images', output: '/images' }] }));
});

// ---------------------------------------------------------------------------
// content — ContentObjectSchema
// ---------------------------------------------------------------------------

describe('ConfigSchema — content (required fields)', () => {
  it('accepts a minimal collection', () =>
    ok({ content: [{ name: 'posts', type: 'collection', path: 'content/posts' }] }));
  it('accepts a file type', () =>
    ok({ content: [{ name: 'settings', type: 'file', path: 'src/config/settings.yaml' }] }));
  it('rejects missing name', () =>
    fail({ content: [{ type: 'collection', path: 'content/posts' }] }));
  it('rejects missing type', () =>
    fail({ content: [{ name: 'posts', path: 'content/posts' }] }));
  it('rejects missing path', () =>
    fail({ content: [{ name: 'posts', type: 'collection' }] }));
  it('rejects invalid type value', () =>
    fail({ content: [{ name: 'posts', type: 'pages', path: 'content/posts' }] }));
  it('rejects name with special characters', () =>
    fail({ content: [{ name: 'my posts!', type: 'collection', path: 'content' }] }));
});

describe('ConfigSchema — content (format enum)', () => {
  const base = { name: 'posts', type: 'collection', path: 'content/posts' };
  for (const fmt of ['yaml-frontmatter', 'json-frontmatter', 'toml-frontmatter', 'yaml', 'json', 'toml', 'datagrid', 'code', 'raw']) {
    it(`accepts format: "${fmt}"`, () => ok({ content: [{ ...base, format: fmt }] }));
  }
  it('rejects invalid format value', () =>
    fail({ content: [{ ...base, format: 'markdown' }] }));
});

// ---------------------------------------------------------------------------
// Field definitions — generateFieldObjectSchema
// ---------------------------------------------------------------------------

describe('field definitions — type vs component', () => {
  it('accepts field with valid registered type', () =>
    ok(withField({ name: 'title', type: 'string' })));
  it('rejects field with invalid type', () =>
    fail(withField({ name: 'title', type: 'unicorn' })));
  it('rejects field with both type and component (must be exactly one)', () =>
    fail(withField({ name: 'x', type: 'string', component: 'myComp' })));
  it('rejects field with neither type nor component', () =>
    fail(withField({ name: 'x' })));
  it('accepts field referencing a component', () =>
    ok(withField({ name: 'x', component: 'myComp' })));
});

describe('field definitions — type: object', () => {
  it('accepts object field with fields array', () =>
    ok(withField({ name: 'meta', type: 'object', fields: [{ name: 'x', type: 'string' }] })));
  it('rejects object field without fields', () =>
    fail(withField({ name: 'meta', type: 'object' })));
});

describe('field definitions — type: block', () => {
  const blockWithFields = {
    name: 'content',
    type: 'block',
    blocks: [{ name: 'hero', fields: [{ name: 't', type: 'string' }] }],
  };

  it('accepts block field with blocks array', () => ok(withField(blockWithFields)));
  it('rejects block field without blocks attribute', () =>
    fail(withField({ name: 'content', type: 'block' })));
  it('accepts blocks ref syntax', () =>
    ok(withField({ name: 'content', type: 'block', blocks: 'ref:heroBlocks' })));
  it('rejects blocks ref without ref: prefix', () =>
    fail(withField({ name: 'content', type: 'block', blocks: 'heroBlocks' })));
});

describe('field definitions — blockKey', () => {
  it('accepts blockKey on block type', () =>
    ok(withField({
      name: 'content',
      type: 'block',
      blocks: [{ name: 'hero', fields: [] }],
      blockKey: '_type',
    })));
  it('rejects blockKey on non-block type', () =>
    fail(withField({ name: 'title', type: 'string', blockKey: '_type' })));
});

describe('field definitions — list', () => {
  it('accepts list: true', () =>
    ok(withField({ name: 'tags', type: 'string', list: true })));
  it('accepts list with min/max', () =>
    ok(withField({ name: 'tags', type: 'string', list: { min: 1, max: 5 } })));
  it('rejects list with negative min', () =>
    fail(withField({ name: 'tags', type: 'string', list: { min: -1 } })));
});

// ---------------------------------------------------------------------------
// components
// ---------------------------------------------------------------------------

describe('ConfigSchema — components', () => {
  it('accepts a valid object component definition', () =>
    ok({
      components: {
        hero: { type: 'object', fields: [{ name: 'title', type: 'string' }] },
      },
    }));
  it('accepts a component with a label', () =>
    ok({
      components: {
        hero: { label: 'Hero', type: 'object', fields: [{ name: 'title', type: 'string' }] },
      },
    }));
  it('rejects component missing type or component reference (type XOR component required)', () =>
    fail({
      components: {
        hero: { label: 'Hero', fields: [{ name: 'title', type: 'string' }] },
      },
    }));
  it('rejects component key with special characters', () =>
    fail({
      components: {
        'my component!': { type: 'object', fields: [] },
      },
    }));
});

// ---------------------------------------------------------------------------
// blockCategories
// ---------------------------------------------------------------------------

describe('ConfigSchema — blockCategories', () => {
  it('accepts a valid block category', () =>
    ok({ blockCategories: [{ key: 'hero-blocks', label: 'Hero Blocks' }] }));
  it('accepts category with optional description', () =>
    ok({ blockCategories: [{ key: 'hero', label: 'Hero', description: 'Big header blocks' }] }));
  it('rejects category missing key', () =>
    fail({ blockCategories: [{ label: 'Hero Blocks' }] }));
  it('rejects category missing label', () =>
    fail({ blockCategories: [{ key: 'hero' }] }));
  it('rejects category key with spaces', () =>
    fail({ blockCategories: [{ key: 'my blocks', label: 'Hero' }] }));
  it('rejects category key with special characters', () =>
    fail({ blockCategories: [{ key: 'my-blocks!', label: 'Hero' }] }));
});

// ---------------------------------------------------------------------------
// previewUrl
// ---------------------------------------------------------------------------

describe('ConfigSchema — previewUrl', () => {
  it('accepts a valid URL', () => ok({ previewUrl: 'https://example.com' }));
  it('rejects a non-URL string', () => fail({ previewUrl: 'not-a-url' }));
  it('accepts when absent', () => ok({}));
});

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

describe('ConfigSchema — settings', () => {
  it('accepts settings as boolean false', () => ok({ settings: false }));
  it('accepts settings as boolean true', () => ok({ settings: true }));
  it('accepts settings as object with hide', () => ok({ settings: { hide: true } }));
  it('accepts settings with content.merge', () => ok({ settings: { content: { merge: false } } }));
});
