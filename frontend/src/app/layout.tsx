import type { Metadata } from 'next';
import { Providers } from '@/components';
import './globals.css';

export const metadata: Metadata = {
  title: 'Download RWKV Chat',
  description: 'Download the latest version of the app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const themePreference = localStorage.getItem('theme-preference');
                  let theme = 'light';
                  
                  if (themePreference === 'dark' || themePreference === 'light') {
                    theme = themePreference;
                    document.documentElement.setAttribute('data-theme', theme);
                  } else {
                    // Use system preference - remove data-theme to let CSS media query work
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    theme = prefersDark ? 'dark' : 'light';
                    document.documentElement.removeAttribute('data-theme');
                  }
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {
                  // Fallback to system preference if localStorage is not available
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.removeAttribute('data-theme');
                }
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
