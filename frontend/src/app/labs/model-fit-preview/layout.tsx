import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '模型性能查询 · RWKV Chat',
  description:
    'Real-world inference speed (prefill / decode) across SoCs and model weights, reported anonymously by RWKV Chat users.',
};

export default function ModelFitPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
