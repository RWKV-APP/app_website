import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download RWKV Music',
  description: 'Download RWKV Music for Android, iOS, macOS, and Windows',
  icons: {
    icon: [{ url: '/images/app-icon/rwkv-music.png', sizes: 'any', type: 'image/png' }],
    apple: [{ url: '/images/app-icon/rwkv-music.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/images/app-icon/rwkv-music.png',
  },
};

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
