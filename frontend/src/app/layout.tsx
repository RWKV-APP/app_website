import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'App Download',
  description: 'Download the latest version of the app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
