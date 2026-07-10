import type { Metadata } from 'next';
import * as fs from 'fs';
import * as path from 'path';
import { Providers } from '@/components';
import './globals.css';

interface BuildInfo {
  builtAt: string;
  buildSource: string;
  gitBranch: string;
  gitCommit: string;
  gitCommitShort: string;
  gitDirty: boolean;
  packageVersion: string;
}

function readBuildInfo(): BuildInfo {
  const fallback: BuildInfo = {
    builtAt: 'unknown',
    buildSource: 'unknown',
    gitBranch: 'unknown',
    gitCommit: 'unknown',
    gitCommitShort: 'unknown',
    gitDirty: false,
    packageVersion: 'unknown',
  };

  try {
    const filePath = path.join(process.cwd(), 'public', 'build-info.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BuildInfo>;

    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return fallback;
  }
}

export const metadata: Metadata = {
  title: 'Download RWKV Chat',
  description: 'Download the latest version of the app',
  icons: {
    icon: [
      { url: '/images/app-icon/app-icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/app-icon/app-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/app-icon/app-icon-64.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: [{ url: '/images/app-icon/app-icon-180.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/images/app-icon/app-icon-32.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const buildInfo = readBuildInfo();
  const buildSummary = `${buildInfo.gitCommitShort} @ ${buildInfo.builtAt}`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Additional Apple Touch Icon sizes for better Safari compatibility */}
        <link rel="apple-touch-icon" sizes="192x192" href="/images/app-icon/app-icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/images/app-icon/app-icon-512.png" />
        <meta name="theme-color" content="#14b8a6" />
        <meta name="rwkv-build-summary" content={buildSummary} />
        <meta name="rwkv-build-time" content={buildInfo.builtAt} />
        <meta name="rwkv-build-source" content={buildInfo.buildSource} />
        <meta name="rwkv-build-branch" content={buildInfo.gitBranch} />
        <meta name="rwkv-build-commit" content={buildInfo.gitCommit} />
        <meta name="rwkv-build-commit-short" content={buildInfo.gitCommitShort} />
        <meta name="rwkv-build-dirty" content={String(buildInfo.gitDirty)} />
        <meta name="rwkv-build-package-version" content={buildInfo.packageVersion} />
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
