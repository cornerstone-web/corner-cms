import { describe, it, expect } from 'vitest';
import {
  getFileSize,
  getFileExtension,
  getFileName,
  normalizePath,
  getParentPath,
  getRelativePath,
  joinPathSegments,
  sortFiles,
} from './file';

// ---------------------------------------------------------------------------
// getFileSize
// ---------------------------------------------------------------------------

describe('getFileSize', () => {
  it('formats 0 bytes', () => expect(getFileSize(0)).toBe('0 Bytes'));
  it('formats bytes (< 1 KB)', () => expect(getFileSize(500)).toBe('500 Bytes'));
  it('formats kilobytes', () => expect(getFileSize(1024)).toBe('1 KB'));
  it('formats 1.5 KB', () => expect(getFileSize(1536)).toBe('1.5 KB'));
  it('formats megabytes', () => expect(getFileSize(1024 * 1024)).toBe('1 MB'));
  it('formats gigabytes', () => expect(getFileSize(1024 ** 3)).toBe('1 GB'));
  it('respects decimals param', () => expect(getFileSize(1500, 0)).toBe('1 KB'));
});

// ---------------------------------------------------------------------------
// getFileExtension
// ---------------------------------------------------------------------------

describe('getFileExtension', () => {
  it('returns extension for a simple filename', () => expect(getFileExtension('photo.jpg')).toBe('jpg'));
  it('returns extension for a path with directories', () => expect(getFileExtension('images/photo.jpg')).toBe('jpg'));
  it('returns last extension for multi-dot filenames', () => expect(getFileExtension('archive.tar.gz')).toBe('gz'));
  it('returns undefined for a file with no extension', () => expect(getFileExtension('Makefile')).toBeUndefined());
  it('returns empty string for a dotfile (hidden file)', () => expect(getFileExtension('.gitignore')).toBe(''));
  it('returns extension for dotfile with extension', () => expect(getFileExtension('.env.local')).toBe('local'));
});

// ---------------------------------------------------------------------------
// getFileName
// ---------------------------------------------------------------------------

describe('getFileName', () => {
  it('extracts filename from path', () => expect(getFileName('images/photo.jpg')).toBe('photo.jpg'));
  it('returns filename when no directory', () => expect(getFileName('photo.jpg')).toBe('photo.jpg'));
  it('handles deeply nested path', () => expect(getFileName('a/b/c/file.txt')).toBe('file.txt'));
  it('returns empty string for empty input', () => expect(getFileName('')).toBe(''));
  it('handles dotfiles', () => expect(getFileName('.gitignore')).toBe('.gitignore'));
});

// ---------------------------------------------------------------------------
// normalizePath
// ---------------------------------------------------------------------------

describe('normalizePath', () => {
  it('removes leading slash', () => expect(normalizePath('/foo/bar')).toBe('foo/bar'));
  it('removes trailing slash', () => expect(normalizePath('foo/bar/')).toBe('foo/bar'));
  it('removes both leading and trailing slash', () => expect(normalizePath('/foo/bar/')).toBe('foo/bar'));
  it('resolves .. segments', () => expect(normalizePath('foo/baz/../bar')).toBe('foo/bar'));
  it('resolves . segments', () => expect(normalizePath('foo/./bar')).toBe('foo/bar'));
  it('returns empty string for empty input', () => expect(normalizePath('')).toBe(''));
  it('handles already clean path', () => expect(normalizePath('foo/bar')).toBe('foo/bar'));
  it('collapses double slashes', () => expect(normalizePath('foo//bar')).toBe('foo/bar'));
});

// ---------------------------------------------------------------------------
// getParentPath
// ---------------------------------------------------------------------------

describe('getParentPath', () => {
  it('returns parent directory', () => expect(getParentPath('foo/bar/baz.txt')).toBe('foo/bar'));
  it('returns empty string for top-level file', () => expect(getParentPath('file.txt')).toBe(''));
  it('returns empty string for empty input', () => expect(getParentPath('')).toBe(''));
  it('returns empty string for root slash', () => expect(getParentPath('/')).toBe(''));
  it('returns parent from nested path', () => expect(getParentPath('a/b/c/d')).toBe('a/b/c'));
});

// ---------------------------------------------------------------------------
// getRelativePath
// ---------------------------------------------------------------------------

describe('getRelativePath', () => {
  it('makes path relative to root', () =>
    expect(getRelativePath('content/posts/hello.md', 'content/posts')).toBe('hello.md'));

  it('handles nested relative path', () =>
    expect(getRelativePath('content/posts/2024/hello.md', 'content')).toBe('posts/2024/hello.md'));

  it('returns path as-is when root is empty', () =>
    expect(getRelativePath('content/posts/hello.md', '')).toBe('content/posts/hello.md'));

  it('returns original path if not within root (logs error)', () =>
    expect(getRelativePath('other/file.md', 'content')).toBe('other/file.md'));
});

// ---------------------------------------------------------------------------
// joinPathSegments
// ---------------------------------------------------------------------------

describe('joinPathSegments', () => {
  it('joins simple segments', () => expect(joinPathSegments(['foo', 'bar', 'baz'])).toBe('foo/bar/baz'));
  it('strips leading/trailing slashes from segments', () =>
    expect(joinPathSegments(['/foo/', '/bar/', '/baz/'])).toBe('foo/bar/baz'));
  it('filters empty segments', () => expect(joinPathSegments(['foo', '', 'baz'])).toBe('foo/baz'));
  it('returns empty string for all-empty segments', () => expect(joinPathSegments(['', ''])).toBe(''));
  it('handles single segment', () => expect(joinPathSegments(['foo'])).toBe('foo'));
  it('handles empty array', () => expect(joinPathSegments([])).toBe(''));
});

// ---------------------------------------------------------------------------
// sortFiles
// ---------------------------------------------------------------------------

describe('sortFiles', () => {
  it('places directories before files', () => {
    const input = [
      { type: 'file', name: 'a.txt' },
      { type: 'dir', name: 'zdir' },
    ];
    const result = sortFiles(input);
    expect(result[0].type).toBe('dir');
    expect(result[1].type).toBe('file');
  });

  it('sorts alphabetically within dirs', () => {
    const input = [
      { type: 'dir', name: 'zeta' },
      { type: 'dir', name: 'alpha' },
    ];
    const result = sortFiles(input);
    expect(result[0].name).toBe('alpha');
    expect(result[1].name).toBe('zeta');
  });

  it('sorts alphabetically within files', () => {
    const input = [
      { type: 'file', name: 'z.txt' },
      { type: 'file', name: 'a.txt' },
    ];
    const result = sortFiles(input);
    expect(result[0].name).toBe('a.txt');
    expect(result[1].name).toBe('z.txt');
  });

  it('handles mixed dirs and files correctly', () => {
    const input = [
      { type: 'file', name: 'a.txt' },
      { type: 'dir', name: 'c' },
      { type: 'file', name: 'b.txt' },
      { type: 'dir', name: 'a' },
    ];
    const result = sortFiles(input);
    expect(result[0]).toMatchObject({ type: 'dir', name: 'a' });
    expect(result[1]).toMatchObject({ type: 'dir', name: 'c' });
    expect(result[2]).toMatchObject({ type: 'file', name: 'a.txt' });
    expect(result[3]).toMatchObject({ type: 'file', name: 'b.txt' });
  });

  it('returns empty array unchanged', () => {
    expect(sortFiles([])).toEqual([]);
  });
});
