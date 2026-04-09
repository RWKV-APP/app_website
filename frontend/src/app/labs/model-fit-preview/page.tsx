'use client';

import { useState } from 'react';
import styles from './page.module.css';

type PlatformId = 'macos' | 'android' | 'ios' | 'windows' | 'linux' | 'huawei';
type WeightClass =
  | '0.4B'
  | '0.5B'
  | '1.5B-Q4_K_M'
  | '1.5B-INT6'
  | '2.9B-Q4_K_M'
  | '2.9B-INT6'
  | '7B'
  | '14B';

interface WeightColumn {
  id: WeightClass;
  label: string;
  quant: string;
}

interface MatrixCell {
  prefill: number | null;
  decode: number | null;
  note?: string;
}

interface MatrixRow {
  id: string;
  vendor?: string;
  name: string;
  subtitle: string;
  meta: string;
  results: Record<WeightClass, MatrixCell>;
}

interface PlatformMatrix {
  id: PlatformId;
  label: string;
  title: string;
  subtitle: string;
  rowHeader: string;
  rows: MatrixRow[];
  comingSoon?: boolean;
}

const weightColumns: WeightColumn[] = [
  { id: '0.4B', label: '0.4B', quant: 'Q4' },
  { id: '0.5B', label: '0.5B', quant: 'Q4' },
  { id: '1.5B-Q4_K_M', label: '1.5B', quant: 'Q4_K_M' },
  { id: '1.5B-INT6', label: '1.5B', quant: 'INT6' },
  { id: '2.9B-Q4_K_M', label: '2.9B', quant: 'Q4_K_M' },
  { id: '2.9B-INT6', label: '2.9B', quant: 'INT6' },
  { id: '7B', label: '7B', quant: 'Q4_K_M' },
  { id: '14B', label: '14B', quant: 'Q4_K_M' },
];

function cell(prefill: number | null, decode: number | null, note?: string): MatrixCell {
  return { prefill, decode, note };
}

const platformMatrices: Record<PlatformId, PlatformMatrix> = {
  macos: {
    id: 'macos',
    label: 'macOS',
    title: 'macOS 芯片 x 权重',
    subtitle:
      '纵轴是 Apple Silicon 芯片 / 机型档位，横轴是不同权重和量化。单元格展示 Prefill / Decode 假数据。',
    rowHeader: 'Chip / Device',
    rows: [
      {
        id: 'm4-max',
        vendor: 'Apple',
        name: 'M4 Max',
        subtitle: 'MacBook Pro / Studio',
        meta: '48-128 GB unified',
        results: {
          '0.4B': cell(828, 182.0),
          '0.5B': cell(720, 158.0),
          '1.5B-Q4_K_M': cell(516, 112.4),
          '1.5B-INT6': cell(442, 96.1),
          '2.9B-Q4_K_M': cell(358, 76.8),
          '2.9B-INT6': cell(302, 64.0),
          '7B': cell(170, 34.8),
          '14B': cell(88, 18.1),
        },
      },
      {
        id: 'm3-max',
        vendor: 'Apple',
        name: 'M3 Max',
        subtitle: 'MacBook Pro / Studio',
        meta: '36-64 GB unified',
        results: {
          '0.4B': cell(764, 164.4),
          '0.5B': cell(664, 142.0),
          '1.5B-Q4_K_M': cell(468, 101.2),
          '1.5B-INT6': cell(400, 86.7),
          '2.9B-Q4_K_M': cell(323, 69.1),
          '2.9B-INT6': cell(272, 57.2),
          '7B': cell(149, 30.2),
          '14B': cell(76, 15.2),
        },
      },
      {
        id: 'm4-pro',
        vendor: 'Apple',
        name: 'M4 Pro',
        subtitle: 'Mac mini / MacBook Pro',
        meta: '24-48 GB unified',
        results: {
          '0.4B': cell(628, 138.0),
          '0.5B': cell(542, 118.4),
          '1.5B-Q4_K_M': cell(384, 83.9),
          '1.5B-INT6': cell(326, 71.6),
          '2.9B-Q4_K_M': cell(258, 56.7),
          '2.9B-INT6': cell(216, 46.9),
          '7B': cell(118, 24.1),
          '14B': cell(56, 10.9),
        },
      },
      {
        id: 'm3',
        vendor: 'Apple',
        name: 'M3',
        subtitle: 'MacBook Air / iMac',
        meta: '16-24 GB unified',
        results: {
          '0.4B': cell(494, 108.0),
          '0.5B': cell(418, 92.0),
          '1.5B-Q4_K_M': cell(292, 64.8),
          '1.5B-INT6': cell(248, 55.0),
          '2.9B-Q4_K_M': cell(192, 42.1),
          '2.9B-INT6': cell(161, 35.1),
          '7B': cell(84, 16.5),
          '14B': cell(36, 6.2),
        },
      },
      {
        id: 'm2',
        vendor: 'Apple',
        name: 'M2',
        subtitle: 'MacBook Air / Mac mini',
        meta: '8-24 GB unified',
        results: {
          '0.4B': cell(428, 89.5),
          '0.5B': cell(364, 76.2),
          '1.5B-Q4_K_M': cell(248, 53.4),
          '1.5B-INT6': cell(208, 44.8),
          '2.9B-Q4_K_M': cell(156, 33.5),
          '2.9B-INT6': cell(128, 27.1),
          '7B': cell(62, 11.7),
          '14B': cell(24, 3.9, 'tight'),
        },
      },
    ],
  },
  android: {
    id: 'android',
    label: '安卓',
    title: 'Android SoC x 权重',
    subtitle:
      '纵轴是手机 SoC。单元格是 Prefill / Decode 假数据，重点看高权重在手机端的落点和 1.5B / 2.9B 的不同量化。',
    rowHeader: 'SoC',
    rows: [
      {
        id: 'snapdragon-8-elite',
        vendor: 'Qualcomm',
        name: 'Snapdragon 8 Elite',
        subtitle: 'Xiaomi 15 / OnePlus 13',
        meta: '3nm · 12-16 GB',
        results: {
          '0.4B': cell(432, 61.8),
          '0.5B': cell(338, 48.1),
          '1.5B-Q4_K_M': cell(256, 35.2),
          '1.5B-INT6': cell(219, 29.9),
          '2.9B-Q4_K_M': cell(173, 22.6),
          '2.9B-INT6': cell(147, 19.0),
          '7B': cell(84, 8.9),
          '14B': cell(34, 3.8, 'tight'),
        },
      },
      {
        id: 'dimensity-9400',
        vendor: 'MediaTek',
        name: 'Dimensity 9400',
        subtitle: 'vivo X200 Pro / Find X8',
        meta: '3nm · 12-16 GB',
        results: {
          '0.4B': cell(406, 57.2),
          '0.5B': cell(321, 44.6),
          '1.5B-Q4_K_M': cell(238, 32.5),
          '1.5B-INT6': cell(202, 27.3),
          '2.9B-Q4_K_M': cell(162, 20.9),
          '2.9B-INT6': cell(136, 17.4),
          '7B': cell(76, 8.1),
          '14B': cell(30, 3.2, 'tight'),
        },
      },
      {
        id: 'snapdragon-8-gen-3',
        vendor: 'Qualcomm',
        name: 'Snapdragon 8 Gen 3',
        subtitle: 'Galaxy S24 Ultra / Xiaomi 14',
        meta: '4nm · 12 GB',
        results: {
          '0.4B': cell(364, 50.8),
          '0.5B': cell(286, 39.5),
          '1.5B-Q4_K_M': cell(214, 29.7),
          '1.5B-INT6': cell(184, 25.1),
          '2.9B-Q4_K_M': cell(148, 17.8),
          '2.9B-INT6': cell(126, 15.0),
          '7B': cell(64, 6.5),
          '14B': cell(24, 2.3, 'borderline'),
        },
      },
      {
        id: 'exynos-2400',
        vendor: 'Samsung',
        name: 'Exynos 2400',
        subtitle: 'Galaxy S24 / S24+',
        meta: '4nm · 8-12 GB',
        results: {
          '0.4B': cell(326, 43.4),
          '0.5B': cell(254, 33.0),
          '1.5B-Q4_K_M': cell(184, 23.8),
          '1.5B-INT6': cell(156, 19.6),
          '2.9B-Q4_K_M': cell(122, 14.9),
          '2.9B-INT6': cell(102, 12.3),
          '7B': cell(48, 4.8),
          '14B': cell(16, 1.4, 'borderline'),
        },
      },
      {
        id: 'snapdragon-7-plus-gen-3',
        vendor: 'Qualcomm',
        name: 'Snapdragon 7+ Gen 3',
        subtitle: 'Ace 3V / GT Neo',
        meta: '4nm · 8-12 GB',
        results: {
          '0.4B': cell(236, 28.4),
          '0.5B': cell(182, 21.4),
          '1.5B-Q4_K_M': cell(129, 15.7),
          '1.5B-INT6': cell(108, 13.0),
          '2.9B-Q4_K_M': cell(78, 8.6),
          '2.9B-INT6': cell(66, 7.0),
          '7B': cell(24, 1.8, 'tight'),
          '14B': cell(null, null, 'no fit'),
        },
      },
    ],
  },
  ios: {
    id: 'ios',
    label: 'iOS',
    title: 'iPhone SoC x 权重',
    subtitle: '纵轴是 iPhone SoC。保持同一套横轴，并给 1.5B / 2.9B 分别补两个量化档位的 Prefill / Decode。',
    rowHeader: 'SoC',
    rows: [
      {
        id: 'a18-pro',
        vendor: 'Apple',
        name: 'A18 Pro',
        subtitle: 'iPhone 16 Pro / Pro Max',
        meta: '3nm · 8 GB',
        results: {
          '0.4B': cell(438, 63.5),
          '0.5B': cell(346, 47.2),
          '1.5B-Q4_K_M': cell(270, 34.8),
          '1.5B-INT6': cell(232, 29.6),
          '2.9B-Q4_K_M': cell(181, 21.4),
          '2.9B-INT6': cell(152, 17.9),
          '7B': cell(78, 8.6),
          '14B': cell(31, 3.4, 'borderline'),
        },
      },
      {
        id: 'a17-pro',
        vendor: 'Apple',
        name: 'A17 Pro',
        subtitle: 'iPhone 15 Pro / Pro Max',
        meta: '3nm · 8 GB',
        results: {
          '0.4B': cell(412, 58.2),
          '0.5B': cell(326, 43.0),
          '1.5B-Q4_K_M': cell(248, 31.6),
          '1.5B-INT6': cell(212, 26.5),
          '2.9B-Q4_K_M': cell(169, 18.7),
          '2.9B-INT6': cell(140, 15.6),
          '7B': cell(72, 7.2),
          '14B': cell(26, 2.8, 'tight'),
        },
      },
      {
        id: 'a16-bionic',
        vendor: 'Apple',
        name: 'A16 Bionic',
        subtitle: 'iPhone 15 / 15 Plus',
        meta: '4nm · 6 GB',
        results: {
          '0.4B': cell(306, 40.8),
          '0.5B': cell(242, 31.7),
          '1.5B-Q4_K_M': cell(178, 24.6),
          '1.5B-INT6': cell(149, 20.2),
          '2.9B-Q4_K_M': cell(118, 14.1),
          '2.9B-INT6': cell(98, 11.7),
          '7B': cell(44, 4.1),
          '14B': cell(null, null, 'no fit'),
        },
      },
      {
        id: 'a15-bionic',
        vendor: 'Apple',
        name: 'A15 Bionic',
        subtitle: 'iPhone 14 / 13',
        meta: '5nm · 6 GB',
        results: {
          '0.4B': cell(256, 31.4),
          '0.5B': cell(204, 25.9),
          '1.5B-Q4_K_M': cell(146, 18.8),
          '1.5B-INT6': cell(121, 15.4),
          '2.9B-Q4_K_M': cell(92, 10.3),
          '2.9B-INT6': cell(76, 8.5),
          '7B': cell(31, 2.4, 'ram-limited'),
          '14B': cell(null, null, 'no fit'),
        },
      },
      {
        id: 'a14-bionic',
        vendor: 'Apple',
        name: 'A14 Bionic',
        subtitle: 'iPhone 12 / 12 Pro',
        meta: '5nm · 4-6 GB',
        results: {
          '0.4B': cell(208, 25.0),
          '0.5B': cell(164, 20.8),
          '1.5B-Q4_K_M': cell(112, 13.9),
          '1.5B-INT6': cell(92, 11.4),
          '2.9B-Q4_K_M': cell(64, 7.0),
          '2.9B-INT6': cell(52, 5.6),
          '7B': cell(18, 1.3, 'tight'),
          '14B': cell(null, null, 'no fit'),
        },
      },
    ],
  },
  windows: {
    id: 'windows',
    label: 'Windows',
    title: 'Windows 芯片 / 配置 x 权重',
    subtitle: '纵轴是 Windows 设备常见芯片或配置。补了 0.4B 列，并把 2.9B / 1.5B 拆成两个量化档位。',
    rowHeader: 'Chip / Device',
    rows: [
      {
        id: 'snapdragon-x-elite',
        vendor: 'Qualcomm',
        name: 'Snapdragon X Elite',
        subtitle: 'Copilot+ PC',
        meta: '16-32 GB LPDDR5X',
        results: {
          '0.4B': cell(388, 55.8),
          '0.5B': cell(302, 43.0),
          '1.5B-Q4_K_M': cell(219, 30.4),
          '1.5B-INT6': cell(188, 26.0),
          '2.9B-Q4_K_M': cell(150, 20.1),
          '2.9B-INT6': cell(127, 16.8),
          '7B': cell(70, 8.3),
          '14B': cell(28, 3.1, 'tight'),
        },
      },
      {
        id: 'intel-ultra-258v',
        vendor: 'Intel',
        name: 'Core Ultra 7 258V',
        subtitle: 'Lunar Lake laptop',
        meta: '32 GB LPDDR5X',
        results: {
          '0.4B': cell(364, 49.7),
          '0.5B': cell(286, 38.2),
          '1.5B-Q4_K_M': cell(206, 27.0),
          '1.5B-INT6': cell(176, 23.0),
          '2.9B-Q4_K_M': cell(140, 17.8),
          '2.9B-INT6': cell(117, 14.8),
          '7B': cell(60, 7.1),
          '14B': cell(22, 2.6, 'tight'),
        },
      },
      {
        id: 'ryzen-ai-370',
        vendor: 'AMD',
        name: 'Ryzen AI 9 HX 370',
        subtitle: 'Strix Point laptop',
        meta: '32-64 GB LPDDR5X',
        results: {
          '0.4B': cell(432, 60.9),
          '0.5B': cell(344, 46.8),
          '1.5B-Q4_K_M': cell(248, 33.8),
          '1.5B-INT6': cell(214, 29.0),
          '2.9B-Q4_K_M': cell(176, 22.4),
          '2.9B-INT6': cell(150, 18.9),
          '7B': cell(84, 10.2),
          '14B': cell(38, 4.1),
        },
      },
      {
        id: 'rtx-4060-laptop',
        vendor: 'NVIDIA',
        name: 'RTX 4060 Laptop',
        subtitle: 'Consumer laptop GPU',
        meta: '8 GB VRAM · 32 GB RAM',
        results: {
          '0.4B': cell(518, 92.2),
          '0.5B': cell(408, 71.0),
          '1.5B-Q4_K_M': cell(302, 52.4),
          '1.5B-INT6': cell(258, 44.8),
          '2.9B-Q4_K_M': cell(221, 36.2),
          '2.9B-INT6': cell(188, 30.6),
          '7B': cell(118, 19.6),
          '14B': cell(58, 9.3),
        },
      },
      {
        id: 'rtx-4070-desktop',
        vendor: 'NVIDIA',
        name: 'RTX 4070 Desktop',
        subtitle: 'Consumer desktop GPU',
        meta: '12 GB VRAM · 64 GB RAM',
        results: {
          '0.4B': cell(614, 109.6),
          '0.5B': cell(486, 84.6),
          '1.5B-Q4_K_M': cell(358, 61.8),
          '1.5B-INT6': cell(306, 52.7),
          '2.9B-Q4_K_M': cell(264, 43.1),
          '2.9B-INT6': cell(226, 36.8),
          '7B': cell(140, 23.8),
          '14B': cell(72, 12.2),
        },
      },
    ],
  },
  linux: {
    id: 'linux',
    label: 'Linux',
    title: 'Linux 配置 x 权重',
    subtitle: '纵轴是 Linux 侧常见测试配置。这里更偏内部 benchmark 工作机和服务器档位。',
    rowHeader: 'Config',
    rows: [
      {
        id: '7840u',
        vendor: 'AMD',
        name: 'Ryzen 7 7840U',
        subtitle: 'Mini PC / handheld class',
        meta: '32 GB LPDDR5',
        results: {
          '0.4B': cell(228, 31.0),
          '0.5B': cell(176, 24.0),
          '1.5B-Q4_K_M': cell(126, 16.2),
          '1.5B-INT6': cell(107, 13.8),
          '2.9B-Q4_K_M': cell(84, 10.1),
          '2.9B-INT6': cell(70, 8.4),
          '7B': cell(28, 2.7, 'tight'),
          '14B': cell(null, null, 'no fit'),
        },
      },
      {
        id: 'arc-a770',
        vendor: 'Intel',
        name: 'Arc A770',
        subtitle: 'Desktop GPU',
        meta: '16 GB VRAM · 64 GB RAM',
        results: {
          '0.4B': cell(504, 81.6),
          '0.5B': cell(392, 62.4),
          '1.5B-Q4_K_M': cell(282, 45.6),
          '1.5B-INT6': cell(242, 39.0),
          '2.9B-Q4_K_M': cell(194, 29.8),
          '2.9B-INT6': cell(164, 25.2),
          '7B': cell(96, 13.6),
          '14B': cell(46, 6.4),
        },
      },
      {
        id: 'rx-7800-xt',
        vendor: 'AMD',
        name: 'RX 7800 XT',
        subtitle: 'Desktop GPU',
        meta: '16 GB VRAM · 64 GB RAM',
        results: {
          '0.4B': cell(562, 90.4),
          '0.5B': cell(438, 68.8),
          '1.5B-Q4_K_M': cell(316, 49.8),
          '1.5B-INT6': cell(271, 42.6),
          '2.9B-Q4_K_M': cell(228, 33.2),
          '2.9B-INT6': cell(194, 28.2),
          '7B': cell(114, 17.4),
          '14B': cell(54, 8.1),
        },
      },
      {
        id: 'rtx-3090',
        vendor: 'NVIDIA',
        name: 'RTX 3090',
        subtitle: 'Desktop GPU',
        meta: '24 GB VRAM · 128 GB RAM',
        results: {
          '0.4B': cell(664, 122.0),
          '0.5B': cell(522, 92.0),
          '1.5B-Q4_K_M': cell(382, 67.4),
          '1.5B-INT6': cell(326, 57.1),
          '2.9B-Q4_K_M': cell(282, 46.2),
          '2.9B-INT6': cell(238, 39.2),
          '7B': cell(156, 26.1),
          '14B': cell(84, 14.1),
        },
      },
      {
        id: '4090-server',
        vendor: 'NVIDIA',
        name: 'RTX 4090 / 5090 class',
        subtitle: 'Internal benchmark box',
        meta: '24-32 GB VRAM · 128 GB RAM',
        results: {
          '0.4B': cell(798, 152.0),
          '0.5B': cell(626, 118.0),
          '1.5B-Q4_K_M': cell(462, 87.5),
          '1.5B-INT6': cell(394, 74.0),
          '2.9B-Q4_K_M': cell(348, 61.8),
          '2.9B-INT6': cell(296, 52.1),
          '7B': cell(194, 34.4),
          '14B': cell(108, 19.1),
        },
      },
    ],
  },
  huawei: {
    id: 'huawei',
    label: '华为',
    title: '华为平台',
    subtitle: 'Kirin / NPU / 推理栈还在适配中。',
    rowHeader: 'SoC',
    rows: [],
    comingSoon: true,
  },
};

function formatCompactSpeed(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
}

function buildCellClass(prefill: number | null, decode: number | null): string {
  if (prefill === null || decode === null) {
    return styles.cellUnavailable;
  }

  if (decode >= 35) {
    return styles.cellStrong;
  }

  if (decode >= 15) {
    return styles.cellGood;
  }

  if (decode >= 4) {
    return styles.cellTight;
  }

  return styles.cellWeak;
}

export default function ModelFitPreviewPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('android');
  const activeMatrix = platformMatrices[selectedPlatform];

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Internal Preview</p>
          <h1 className={styles.title}>RWKV prefill / decode matrix</h1>
          <p className={styles.description}>
            顶部按平台切 Tab。表格按内容宽度渲染，列数继续增加时会横向滚动。当前包含 0.4B，
            以及 1.5B / 2.9B 的 `Q4_K_M` 和 `INT6` 两个量化列。
          </p>
        </section>

        <section className={styles.tabSection}>
          <div className={styles.tabScroller}>
            <div className={styles.tabRow}>
              {(
                ['macos', 'android', 'ios', 'windows', 'linux', 'huawei'] as const
              ).map((platformId) => {
                const platform = platformMatrices[platformId];
                return (
                  <button
                    key={platform.id}
                    type="button"
                    className={`${styles.tabButton} ${selectedPlatform === platform.id ? styles.tabButtonSelected : ''}`}
                    onClick={() => setSelectedPlatform(platform.id)}
                  >
                    {platform.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.metaBlock}>
            <span>{activeMatrix.title}</span>
            <span>Rows: {activeMatrix.rows.length}</span>
            <span>Weights: {weightColumns.length}</span>
            <span>H-scroll: on</span>
          </div>
        </section>

        <section className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{activeMatrix.title}</h2>
          <p className={styles.sectionDescription}>{activeMatrix.subtitle}</p>
        </section>

        {activeMatrix.comingSoon ? (
          <section className={styles.comingSoonBox}>
            <h3 className={styles.comingSoonTitle}>华为平台正在适配中</h3>
            <p className={styles.comingSoonText}>
              先预留 Tab，等 Kirin / 推理链路 / benchmark 口径稳定后再补完整矩阵。
            </p>
          </section>
        ) : (
          <section className={styles.tableSection}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.rowHead}>{activeMatrix.rowHeader}</th>
                    {weightColumns.map((column) => (
                      <th key={column.id} className={styles.weightHead}>
                        <div className={styles.weightTitle}>{column.label}</div>
                        <div className={styles.weightMeta}>{column.quant}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {activeMatrix.rows.map((row) => (
                    <tr key={row.id}>
                      <th className={styles.rowCell}>
                        <div className={styles.rowTopline}>
                          {row.vendor ? <span className={styles.vendorTag}>{row.vendor}</span> : null}
                          <strong className={styles.rowName}>{row.name}</strong>
                        </div>
                        <div className={styles.rowSubtitle}>{row.subtitle}</div>
                        <div className={styles.rowMeta}>{row.meta}</div>
                      </th>

                      {weightColumns.map((column) => {
                        const result = row.results[column.id];
                      return (
                        <td
                          key={column.id}
                          className={`${styles.speedCell} ${buildCellClass(result.prefill, result.decode)}`}
                        >
                          <div className={styles.metricLine}>
                            <span className={styles.metricLabel}>Prefill</span>
                            <strong className={styles.metricValue}>
                              {formatCompactSpeed(result.prefill)}
                            </strong>
                          </div>
                            <div className={styles.metricLine}>
                              <span className={styles.metricLabel}>Decode</span>
                              <strong className={styles.metricValue}>
                                {formatCompactSpeed(result.decode)}
                              </strong>
                            </div>
                            {result.note ? <div className={styles.noteTag}>{result.note}</div> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.cellStrong}`} />
            <span>Decode ≥ 35</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.cellGood}`} />
            <span>Decode 15-34.9</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.cellTight}`} />
            <span>Decode 4-14.9</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.cellWeak}`} />
            <span>Decode &lt; 4</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.cellUnavailable}`} />
            <span>Unavailable</span>
          </div>
        </section>

        <section className={styles.notes}>
          <h2 className={styles.notesTitle}>Notes</h2>
          <ul className={styles.notesList}>
            <li>现在全部还是假数据，目的只是先把矩阵的阅读方式和信息密度做对。</li>
            <li>这版优先内部使用，不做用户导向解释，不做营销文案。</li>
            <li>真实版可以直接接 benchmark JSON，平台和权重继续扩展时表格会横向滚动。</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
