import { describe, it, expect } from 'vitest';
import { parse, stringify } from './serialization';

// ---------------------------------------------------------------------------
// parse — serial formats (no frontmatter)
// ---------------------------------------------------------------------------

describe('parse — yaml format', () => {
  it('parses a simple key/value YAML string', () => {
    expect(parse('title: Hello\ndate: 2024-01-01\n', { format: 'yaml' })).toEqual({
      title: 'Hello',
      date: '2024-01-01',
    });
  });

  it('returns empty object for empty string', () => {
    expect(parse('', { format: 'yaml' })).toEqual({});
  });

  it('returns empty object for whitespace-only string', () => {
    expect(parse('   \n  ', { format: 'yaml' })).toEqual({});
  });

  it('parses nested YAML objects', () => {
    const yaml = 'author:\n  name: Alice\n  email: alice@example.com\n';
    expect(parse(yaml, { format: 'yaml' })).toEqual({
      author: { name: 'Alice', email: 'alice@example.com' },
    });
  });

  it('parses YAML arrays', () => {
    const yaml = 'tags:\n  - one\n  - two\n  - three\n';
    expect(parse(yaml, { format: 'yaml' })).toEqual({ tags: ['one', 'two', 'three'] });
  });
});

describe('parse — json format', () => {
  it('parses a JSON string', () => {
    expect(parse('{"title":"Hello","count":42}', { format: 'json' })).toEqual({
      title: 'Hello',
      count: 42,
    });
  });

  it('parses nested JSON', () => {
    const json = JSON.stringify({ a: { b: [1, 2, 3] } });
    expect(parse(json, { format: 'json' })).toEqual({ a: { b: [1, 2, 3] } });
  });
});

describe('parse — toml format', () => {
  it('parses a TOML string', () => {
    const toml = 'title = "Hello"\ncount = 42\n';
    const result = parse(toml, { format: 'toml' });
    expect(result).toMatchObject({ title: 'Hello', count: 42 });
  });
});

// ---------------------------------------------------------------------------
// parse — frontmatter formats
// ---------------------------------------------------------------------------

describe('parse — yaml-frontmatter format', () => {
  it('defaults to yaml-frontmatter when no format specified', () => {
    const content = '---\ntitle: Hello\n---\nBody text.';
    const result = parse(content);
    expect(result.title).toBe('Hello');
    expect(result.body).toBe('Body text.');
  });

  it('parses frontmatter + body', () => {
    const content = '---\ntitle: Hello\ndraft: true\n---\nBody text here.';
    const result = parse(content, { format: 'yaml-frontmatter' });
    expect(result).toEqual({ title: 'Hello', draft: true, body: 'Body text here.' });
  });

  it('returns body as empty string when no body after frontmatter', () => {
    const content = '---\ntitle: Hello\n---\n';
    const result = parse(content, { format: 'yaml-frontmatter' });
    expect(result.title).toBe('Hello');
    expect(result.body).toBe('');
  });

  it('returns { body: content } when no frontmatter markers found', () => {
    const content = 'Just plain text with no frontmatter.';
    expect(parse(content, { format: 'yaml-frontmatter' })).toEqual({
      body: 'Just plain text with no frontmatter.',
    });
  });

  it('handles empty frontmatter block', () => {
    const content = '---\n---\nBody only.';
    const result = parse(content, { format: 'yaml-frontmatter' });
    expect(result.body).toBe('Body only.');
  });

  it('handles multiline body', () => {
    const content = '---\ntitle: T\n---\nLine one.\nLine two.\nLine three.';
    const result = parse(content, { format: 'yaml-frontmatter' });
    expect(result.body).toBe('Line one.\nLine two.\nLine three.');
  });

  it('uses custom symmetric delimiters', () => {
    const content = '~~~\ntitle: Custom\n~~~\nBody here.';
    const result = parse(content, { format: 'yaml-frontmatter', delimiters: '~~~' });
    expect(result.title).toBe('Custom');
    expect(result.body).toBe('Body here.');
  });

  it('uses custom asymmetric delimiters', () => {
    const content = '<!--\ntitle: Custom\n-->\nBody here.';
    const result = parse(content, {
      format: 'yaml-frontmatter',
      delimiters: ['<!--', '-->'],
    });
    expect(result.title).toBe('Custom');
    expect(result.body).toBe('Body here.');
  });
});

describe('parse — toml-frontmatter format', () => {
  it('parses TOML frontmatter + body', () => {
    const content = '+++\ntitle = "Hello"\n+++\nBody text.';
    const result = parse(content, { format: 'toml-frontmatter' });
    expect(result.title).toBe('Hello');
    expect(result.body).toBe('Body text.');
  });

  it('returns { body: content } when no +++ markers', () => {
    const content = 'No TOML frontmatter here.';
    expect(parse(content, { format: 'toml-frontmatter' })).toEqual({
      body: 'No TOML frontmatter here.',
    });
  });
});

describe('parse — json-frontmatter format', () => {
  it('parses JSON frontmatter using brace delimiters', () => {
    const content = '{"title":"Hello","draft":false}\nBody text.';
    const result = parse(content, { format: 'json-frontmatter' });
    expect(result.title).toBe('Hello');
    expect(result.draft).toBe(false);
    expect(result.body).toBe('Body text.');
  });
});

// ---------------------------------------------------------------------------
// stringify — serial formats (no frontmatter)
// ---------------------------------------------------------------------------

describe('stringify — yaml format', () => {
  it('serializes object to YAML', () => {
    const result = stringify({ title: 'Hello', count: 3 }, { format: 'yaml' });
    expect(result).toContain('title: Hello');
    expect(result).toContain('count: 3');
  });

  it('returns empty string for empty object', () => {
    expect(stringify({}, { format: 'yaml' })).toBe('');
  });
});

describe('stringify — json format', () => {
  it('serializes object to JSON', () => {
    const result = stringify({ title: 'Hello' }, { format: 'json' });
    expect(JSON.parse(result)).toEqual({ title: 'Hello' });
  });

  it('returns empty string for empty object', () => {
    expect(stringify({}, { format: 'json' })).toBe('');
  });
});

describe('stringify — toml format', () => {
  it('serializes object to TOML', () => {
    const result = stringify({ title: 'Hello', count: 3 }, { format: 'toml' });
    expect(result).toContain('title');
    expect(result).toContain('Hello');
  });
});

// ---------------------------------------------------------------------------
// stringify — frontmatter formats
// ---------------------------------------------------------------------------

describe('stringify — yaml-frontmatter format', () => {
  it('defaults to yaml-frontmatter', () => {
    const result = stringify({ title: 'Hello', body: 'Body text.' });
    expect(result).toMatch(/^---\n/);
    expect(result).toContain('title: Hello');
    expect(result).toContain('Body text.');
  });

  it('produces frontmatter + body', () => {
    const result = stringify(
      { title: 'Hello', draft: true, body: 'Content here.' },
      { format: 'yaml-frontmatter' },
    );
    expect(result).toMatch(/^---\n/);
    expect(result).toContain('title: Hello');
    expect(result).toContain('draft: true');
    expect(result).toContain('Content here.');
    // body key should NOT appear in the frontmatter block
    const frontmatterBlock = result.split('---')[1];
    expect(frontmatterBlock).not.toContain('body:');
  });

  it('produces only frontmatter when no body field', () => {
    const result = stringify({ title: 'Hello' }, { format: 'yaml-frontmatter' });
    expect(result).toMatch(/^---\n/);
    expect(result).toContain('title: Hello');
  });

  it('produces empty frontmatter block when object is empty', () => {
    const result = stringify({}, { format: 'yaml-frontmatter' });
    // Empty frontmatter: delimiters with nothing between them
    expect(result).toContain('---');
  });

  it('uses custom symmetric delimiters', () => {
    const result = stringify(
      { title: 'Hello', body: 'Body.' },
      { format: 'yaml-frontmatter', delimiters: '~~~' },
    );
    expect(result).toMatch(/^~~~\n/);
    expect(result).toContain('~~~\nBody.');
  });
});

describe('stringify — toml-frontmatter format', () => {
  it('produces +++ delimiters for TOML frontmatter', () => {
    const result = stringify(
      { title: 'Hello', body: 'Body.' },
      { format: 'toml-frontmatter' },
    );
    expect(result).toMatch(/^\+\+\+\n/);
    expect(result).toContain('Body.');
  });
});

// ---------------------------------------------------------------------------
// Roundtrip: parse(stringify(data)) === data
// ---------------------------------------------------------------------------

describe('roundtrip invariant', () => {
  const data = { title: 'Hello World', count: 42, tags: ['a', 'b'], nested: { x: 1 } };
  const dataWithBody = { ...data, body: 'Some body text.' };

  it('yaml roundtrip', () => {
    const serialized = stringify(data, { format: 'yaml' });
    expect(parse(serialized, { format: 'yaml' })).toMatchObject(data);
  });

  it('json roundtrip', () => {
    const serialized = stringify(data, { format: 'json' });
    expect(parse(serialized, { format: 'json' })).toEqual(data);
  });

  it('yaml-frontmatter roundtrip', () => {
    const serialized = stringify(dataWithBody, { format: 'yaml-frontmatter' });
    const parsed = parse(serialized, { format: 'yaml-frontmatter' });
    expect(parsed).toMatchObject(dataWithBody);
  });

  it('toml-frontmatter roundtrip', () => {
    const simpleData = { title: 'Hello', count: 42, body: 'Body text.' };
    const serialized = stringify(simpleData, { format: 'toml-frontmatter' });
    const parsed = parse(serialized, { format: 'toml-frontmatter' });
    expect(parsed.title).toBe(simpleData.title);
    expect(parsed.count).toBe(simpleData.count);
    expect(parsed.body).toBe(simpleData.body);
  });
});
