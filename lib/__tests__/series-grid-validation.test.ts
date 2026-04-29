import { describe, it, expect } from 'vitest';
import { generateZodSchema } from '../schema';
import type { Field } from '@/types/field';

// Mirror the resolved series-grid block fields after component resolution
// (see cornerstone-core/.pages.yml: seriesGridBlock + seriesItem).
const seriesGridFields: Field[] = [
  { name: 'type', type: 'string', hidden: true, default: 'series-grid' } as any,
  { name: 'showTitle', type: 'boolean', default: true, templateEditable: true } as any,
  { name: 'title', type: 'string', controlledBy: 'showTitle' } as any,
  { name: 'showAll', type: 'boolean', default: false, templateEditable: true } as any,
  { name: 'count', type: 'number', controlledBy: 'showAll', controlledByInverse: true } as any,
  { name: 'layout', type: 'select', default: 'grid', options: { values: ['grid', 'list'] } } as any,
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
      { name: 'image', type: 'image' } as any,
      { name: 'description', type: 'inline-rich-text' } as any,
    ],
  } as any,
];

describe('series-grid validation', () => {
  const schema = generateZodSchema(seriesGridFields);

  it('accepts items: undefined when useCollectionSource is true', () => {
    const result = schema.safeParse({
      type: 'series-grid',
      useCollectionSource: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts items: [] when useCollectionSource is true', () => {
    const result = schema.safeParse({
      type: 'series-grid',
      useCollectionSource: true,
      items: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects items: {} (the bug case)', () => {
    const result = schema.safeParse({
      type: 'series-grid',
      useCollectionSource: true,
      items: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => `${e.message} at ${e.path.join('.')}`);
      console.log('Errors for items: {}:', messages);
    }
  });

  it('accepts items: [{title: "", url: "", ...}] when useCollectionSource is true (list-controlled-children-strip fix)', () => {
    const result = schema.safeParse({
      type: 'series-grid',
      useCollectionSource: true,
      items: [{ title: '', url: '', image: '', description: '' }],
    });
    if (!result.success) {
      console.log('Errors for empty items:', result.error.errors.map((e) => `${e.message} at ${e.path.join('.')}`));
    }
    expect(result.success).toBe(true);
  });
});
