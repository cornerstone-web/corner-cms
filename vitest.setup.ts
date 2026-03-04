import Module from 'module';
import path from 'path';
import { z } from 'zod';

const ROOT = path.resolve(process.cwd());

/**
 * CJS module cache injection for @/fields/registry
 *
 * schema.ts calls require("@/fields/registry") inside a function body —
 * a CJS require() in an ESM module. vi.mock() registers mocks in Vitest's
 * ESM import hook and does NOT intercept runtime CJS require() calls.
 *
 * Solution: pre-populate Node's require.cache with a minimal stub so the
 * require() returns the stub without ever loading the real registry.ts
 * (which uses webpack's require.context and cannot run in Node).
 *
 * Tests that need custom field schemas can replace require.cache[REGISTRY_PATH]
 * before the test and restore it afterwards.
 */
export const REGISTRY_PATH = path.join(ROOT, 'fields', 'registry.ts');

const schemas: Record<string, (field: any) => any> = {
  string: (field) => {
    let s = z.string();
    if (field.required) s = s.min(1, 'This field is required');
    return s;
  },
  text: (field) => {
    let s = z.string();
    if (field.required) s = s.min(1, 'This field is required');
    return s;
  },
  boolean: () => z.coerce.boolean(),
  number: (field) => {
    const n = z.number();
    return field.required ? n : n.optional();
  },
  select: (field) => {
    if (field.options?.values && Array.isArray(field.options.values)) {
      const values = field.options.values.map(String) as [string, ...string[]];
      const enumSchema = z.enum(values, { message: 'This field is required' });
      return field.required
        ? enumSchema
        : z.union([z.literal(''), enumSchema]).optional().nullable();
    }
    const s = z.string();
    return field.required ? s.min(1) : s;
  },
};

const defaultValues: Record<string, any> = {
  string: '',
  text: '',
  boolean: false,
  number: 0,
  select: '',
};

(require as any).cache[REGISTRY_PATH] = {
  id: REGISTRY_PATH,
  filename: REGISTRY_PATH,
  loaded: true,
  exports: { schemas, defaultValues },
  parent: undefined,
  children: [],
  paths: [],
};

/**
 * Module._load patch: resolve @/ path aliases.
 *
 * After Vitest's own _load wrapper is already in place, our wrapper (setupFiles
 * run after Vitest's init) adds @/ → absolute-path conversion on top, so
 * require("@/fields/registry") maps to the cache entry we just injected.
 */
const _originalLoad = (Module as any)._load;
(Module as any)._load = function patchedLoad(
  request: string,
  parent: NodeJS.Module,
  isMain: boolean,
) {
  if (request.startsWith('@/')) {
    let resolved = path.join(ROOT, request.slice(2));
    if (!path.extname(resolved)) resolved += '.ts';
    request = resolved;
  }
  return _originalLoad.call(this, request, parent, isMain);
};
