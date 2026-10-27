import { describe, expect, it } from 'vitest';
import { getInstallationMessage, isStandaloneMode } from '../../src/pwa/pwaState';
import { PWA_MANIFEST } from '../../src/pwa/manifest';
import serviceWorkerTemplate from '../../src/pwa/sw.template.js?raw';

describe('Tutorly PWA assets and safety policy', () => {
  it('defines a root-scoped standalone manifest with valid local PNG icons', () => {
    expect(PWA_MANIFEST).toMatchObject({
      name: 'Tutorly', short_name: 'Tutorly', start_url: '/', scope: '/', display: 'standalone',
      theme_color: '#6366F1', background_color: '#F8FAFC',
    });
    expect(PWA_MANIFEST.icons).toHaveLength(3);
    for (const icon of PWA_MANIFEST.icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.src.startsWith('/icons/')).toBe(true);
    }
    expect(PWA_MANIFEST.icons.find((icon) => icon.purpose === 'maskable')?.sizes).toBe('512x512');
  });

  it('keeps API/auth routes outside service-worker interception and runtime caching', () => {
    const apiBypass = serviceWorkerTemplate.indexOf("if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;");
    const navigationHandler = serviceWorkerTemplate.indexOf("if (request.mode === 'navigate')");
    const publicAllowlist = serviceWorkerTemplate.indexOf('if (!PRECACHE_PATHS.has(url.pathname)) return;');
    expect(apiBypass).toBeGreaterThan(-1);
    expect(navigationHandler).toBeGreaterThan(apiBypass);
    expect(publicAllowlist).toBeGreaterThan(navigationHandler);
    expect(serviceWorkerTemplate).not.toContain('cache.put(');
    expect(serviceWorkerTemplate).toContain('cache.addAll(PRECACHE_URLS)');
    expect(serviceWorkerTemplate).toContain("const OFFLINE_URL = '/offline.html'");
    expect(serviceWorkerTemplate).toContain("key.startsWith('tutorly-public-') && key !== CACHE_NAME");
    expect(serviceWorkerTemplate).toContain("event.data?.type === 'TUTORLY_ACTIVATE_UPDATE'");
  });

  it('recognizes standalone mode and does not claim installation before browser confirmation', () => {
    expect(isStandaloneMode(true, false)).toBe(true);
    expect(isStandaloneMode(false, true)).toBe(true);
    expect(isStandaloneMode(false, false)).toBe(false);
    expect(getInstallationMessage('accepted')).toContain('browser will confirm');
    expect(getInstallationMessage('installed')).toContain('Tutorly is installed');
    expect(getInstallationMessage('dismissed')).toContain('dismissed');
  });
});
