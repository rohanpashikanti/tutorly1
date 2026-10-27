export const PWA_MANIFEST = {
  id: '/',
  name: 'Tutorly',
  short_name: 'Tutorly',
  description: 'Manage your tuition center, classes, attendance, examinations, and fees with Tutorly.',
  lang: 'en',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#F8FAFC',
  theme_color: '#6366F1',
  categories: ['education', 'productivity'],
  icons: [
    { src: '/icons/tutorly-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/tutorly-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/tutorly-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
} as const;
