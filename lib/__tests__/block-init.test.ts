import { describe, it, expect } from 'vitest';
import { initializeState } from '../schema';
import type { Field } from '@/types/field';

// Reproduces the flow in entry-form.tsx handleBlockSelect for series-grid:
//   const choiceDefaults = initializeState(selectedBlockDef.fields, {});
//   applyDefaultFrom(selectedBlockDef.fields, choiceDefaults, siteDefaults);
// applyDefaultFrom is duplicated inline here so the test doesn't have to
// import the React component file.
function applyDefaultFrom(
  fields: Field[],
  defaults: Record<string, any>,
  siteDefaults: Record<string, unknown>
): void {
  for (const f of fields) {
    if (f.type === 'object' && f.fields && !f.list) {
      const sub = defaults[f.name] && typeof defaults[f.name] === 'object' ? defaults[f.name] : {};
      applyDefaultFrom(f.fields as Field[], sub, siteDefaults);
      defaults[f.name] = sub;
    } else if ((f as any).defaultFrom && (defaults[f.name] === undefined || defaults[f.name] === '')) {
      const value = ((f as any).defaultFrom as string).split('.').reduce(
        (acc: any, key: string) => (acc && typeof acc === 'object' ? acc[key] : undefined),
        siteDefaults as any
      );
      if (value !== undefined && value !== '') defaults[f.name] = value;
    }
  }
}

const seriesGridFields: Field[] = [
  { name: 'showTitle', type: 'boolean', default: true } as any,
  { name: 'title', type: 'string', controlledBy: 'showTitle' } as any,
  { name: 'useCollectionSource', type: 'boolean', default: true } as any,
  {
    name: 'items',
    type: 'object',
    list: true,
    controlledBy: 'useCollectionSource',
    controlledByInverse: true,
    fields: [
      { name: 'title', type: 'string', required: true } as any,
      { name: 'url', type: 'link', required: true } as any,
    ],
  } as any,
];

describe('block init produces a valid items shape', () => {
  it('initializeState leaves an unfilled list as undefined', () => {
    const state = initializeState(seriesGridFields, {});
    expect(state.items).toBeUndefined();
  });

  it('applyDefaultFrom does NOT clobber a list-of-object field with {}', () => {
    const state = initializeState(seriesGridFields, {});
    applyDefaultFrom(seriesGridFields, state, {});
    expect(state.items).toBeUndefined();
    expect(state.items).not.toEqual({});
  });
});
