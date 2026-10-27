import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import offlineHtml from '../../public/offline.html?raw';

describe('Mobile Viewport Zoom and Accessibility (F009)', () => {
  it('1. index.html contains an accessible responsive viewport meta tag', () => {
    // Locate all viewport meta tags
    const viewportMetaRegex = /<meta\s+[^>]*name=["']viewport["'][^>]*>/gi;
    const matches = indexHtml.match(viewportMetaRegex);

    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(1);

    const viewportTag = matches![0];
    const contentMatch = viewportTag.match(/content=["']([^"']+)["']/i);
    expect(contentMatch).not.toBeNull();

    const content = contentMatch![1];
    expect(content).toContain('width=device-width');
    expect(content).toMatch(/initial-scale=1(\.0)?/);
  });

  it('2. index.html does not disable user scaling (user-scalable)', () => {
    const viewportTag = indexHtml.match(/<meta\s+[^>]*name=["']viewport["'][^>]*>/i)?.[0] || '';
    expect(viewportTag.toLowerCase()).not.toContain('user-scalable=no');
    expect(viewportTag.toLowerCase()).not.toContain('user-scalable=0');
    expect(viewportTag.toLowerCase()).not.toContain('user-scalable="no"');
  });

  it('3. index.html does not contain restrictive maximum-scale or minimum-scale', () => {
    const viewportTag = indexHtml.match(/<meta\s+[^>]*name=["']viewport["'][^>]*>/i)?.[0] || '';
    expect(viewportTag.toLowerCase()).not.toContain('maximum-scale');
    expect(viewportTag.toLowerCase()).not.toContain('minimum-scale');
  });

  it('4. offline.html contains an accessible responsive viewport allowing zoom', () => {
    const viewportTag = offlineHtml.match(/<meta\s+[^>]*name=["']viewport["'][^>]*>/i)?.[0] || '';
    expect(viewportTag).toContain('width=device-width');
    expect(viewportTag).toMatch(/initial-scale=1(\.0)?/);
    expect(viewportTag.toLowerCase()).not.toContain('user-scalable');
    expect(viewportTag.toLowerCase()).not.toContain('maximum-scale');
    expect(viewportTag.toLowerCase()).not.toContain('minimum-scale');
  });

  it('5. no duplicate or conflicting viewport meta tags exist in the entry HTML', () => {
    const viewportMatches = indexHtml.match(/name=["']viewport["']/gi) || [];
    expect(viewportMatches.length).toBe(1);
  });
});
