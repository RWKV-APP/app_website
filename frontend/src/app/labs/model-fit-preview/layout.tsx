import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RWKV Model Fit Preview',
  description: 'A device-first preview page for showing how the RWKV model family feels on different hardware.',
};

export default function ModelFitPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
