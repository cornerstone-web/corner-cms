import { describe, it, expect } from 'vitest';

/**
 * The field registry stub is injected via vitest.setup.ts.
 *
 * Background: schema.ts calls require("@/fields/registry") inside a function
 * body — a CJS require() in an ESM module. vi.mock() hooks into Vitest's ESM
 * import system and does NOT intercept runtime CJS require() calls, so a
 * vi.mock factory here would be silently ignored. Instead, vitest.setup.ts
 * pre-populates Node's require.cache for fields/registry.ts with a minimal
 * Zod-based stub, and patches Module._load to resolve @/ aliases.
 */
import { generateZodSchema } from './schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parse = (fields: any[], data: any) =>
  generateZodSchema(fields).safeParse(data);

const ok = (fields: any[], data: any) =>
  expect(parse(fields, data).success).toBe(true);

const fail = (fields: any[], data: any) =>
  expect(parse(fields, data).success).toBe(false);

// ---------------------------------------------------------------------------
// Scalar field contracts
// ---------------------------------------------------------------------------

describe('scalar fields — required/optional contract', () => {
  it('non-required scalar accepts undefined', () => {
    ok([{ name: 'title', type: 'string' }], {});
  });

  it('non-required scalar accepts empty string', () => {
    ok([{ name: 'title', type: 'string' }], { title: '' });
  });

  it('non-required scalar accepts a value', () => {
    ok([{ name: 'title', type: 'string' }], { title: 'Hello' });
  });

  it('required scalar rejects undefined', () => {
    fail([{ name: 'title', type: 'string', required: true }], {});
  });

  it('required scalar rejects empty string', () => {
    fail([{ name: 'title', type: 'string', required: true }], { title: '' });
  });

  it('required scalar accepts a value', () => {
    ok([{ name: 'title', type: 'string', required: true }], { title: 'Hello' });
  });
});

// ---------------------------------------------------------------------------
// List field contracts — this is the bug class fixed in lib/schema.ts
// ---------------------------------------------------------------------------

describe('list fields — required/optional contract', () => {
  const listField = { name: 'items', type: 'string', list: true };
  const requiredListField = { name: 'items', type: 'string', list: true, required: true };

  it('non-required list accepts undefined (absent from saved YAML)', () => {
    ok([listField], {});
  });

  it('non-required list accepts an empty array', () => {
    ok([listField], { items: [] });
  });

  it('non-required list accepts a populated array', () => {
    ok([listField], { items: ['a', 'b'] });
  });

  it('required list rejects undefined', () => {
    fail([requiredListField], {});
  });

  it('required list rejects an empty array', () => {
    fail([requiredListField], { items: [] });
  });

  it('required list accepts a populated array', () => {
    ok([requiredListField], { items: ['a'] });
  });
});

// ---------------------------------------------------------------------------
// Object list field — mirrors formBlock.fields + formField definition
// (the exact shape that caused the bug: a non-required list field inside an
// object list, where the default items don't include the list field's key)
// ---------------------------------------------------------------------------

describe('formField-style object list — the fixed bug scenario', () => {
  // Mirrors the resolved formField component: an object with a non-required
  // list sub-field (options), only shown when type === "select".
  const formFieldDef = {
    name: 'fields',
    type: 'object',
    list: true,
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'type', type: 'select', required: true, options: { values: ['text', 'email', 'textarea', 'select'] } },
      { name: 'label', type: 'string', required: true },
      { name: 'required', type: 'boolean' },
      { name: 'placeholder', type: 'string' },
      // This is the field that caused the bug: non-required list, absent from
      // default items — previously Zod rejected undefined here.
      { name: 'options', type: 'string', list: true, controlledBy: 'type', controlledByValue: 'select' },
    ],
  };

  const validItem = { name: 'email', type: 'email', label: 'Email', required: true };
  const validItemWithOptions = { name: 'choice', type: 'select', label: 'Choice', options: ['a', 'b'] };

  it('accepts default items that omit the non-required options list', () => {
    ok([formFieldDef], {
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'email', type: 'email', label: 'Email', required: true },
        { name: 'message', type: 'textarea', label: 'Message', required: true },
      ],
    });
  });

  it('accepts an item that includes options for a select field', () => {
    ok([formFieldDef], { fields: [validItemWithOptions] });
  });

  it('rejects an item missing a required inner field (name)', () => {
    fail([formFieldDef], { fields: [{ type: 'text', label: 'Email' }] });
  });

  it('rejects an item with an invalid type enum value', () => {
    fail([formFieldDef], { fields: [{ name: 'x', type: 'invalid', label: 'X' }] });
  });

  it('accepts an empty fields array (non-required list)', () => {
    ok([formFieldDef], { fields: [] });
  });

  it('accepts no fields key at all (non-required list)', () => {
    ok([formFieldDef], {});
  });
});

// ---------------------------------------------------------------------------
// list.min / list.max constraints
// ---------------------------------------------------------------------------

describe('list field — min/max constraints', () => {
  const minList = { name: 'items', type: 'string', list: { min: 2 } };
  const maxList = { name: 'items', type: 'string', list: { max: 3 } };

  it('list with min rejects arrays below the minimum', () => {
    fail([minList], { items: ['a'] });
  });

  it('list with min accepts arrays at the minimum', () => {
    ok([minList], { items: ['a', 'b'] });
  });

  it('list with max rejects arrays above the maximum', () => {
    fail([maxList], { items: ['a', 'b', 'c', 'd'] });
  });

  it('list with max accepts arrays at the maximum', () => {
    ok([maxList], { items: ['a', 'b', 'c'] });
  });
});
