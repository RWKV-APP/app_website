import type { Metadata } from 'next';
import { Providers, LanguageSwitcher } from '@/components';
import './globals.css';

export const metadata: Metadata = {
  title: 'App Download',
  description: 'Download the latest version of the app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <LanguageSwitcher />
          {children}
        </Providers>
      </body>
    </html>
  );
}
