import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Voxora',
    short_name: 'Voxora',
    description: 'Paste anything. Listen to anything.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0F1626',
    theme_color: '#0F1626',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
