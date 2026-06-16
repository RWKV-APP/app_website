'use client';

import { useId } from 'react';
import { useAtomValue } from 'jotai';
import { QRCodeSVG } from 'qrcode.react';
import { localeAtom } from '@/atoms';
import type { Locale } from '@/i18n/locales';
import styles from './PageQrButton.module.css';

const DEFAULT_PAGE_URL = process.env.NEXT_PUBLIC_APP_PAGE_URL || 'https://rwkv.halowang.cloud/';

const qrCopy: Record<
  Locale,
  { label: string; title: string; hint: string; mobileTitle: string; mobileHint: string }
> = {
  'zh-CN': {
    label: '用手机打开当前页面',
    title: '当前页面链接二维码',
    hint: '用手机相机扫码打开当前页面',
    mobileTitle: '手机扫码访问本网址',
    mobileHint: '用手机相机或浏览器扫描二维码，打开当前页面。',
  },
  'zh-TW': {
    label: '用手機開啟目前頁面',
    title: '目前頁面連結 QR Code',
    hint: '用手機相機掃碼開啟目前頁面',
    mobileTitle: '手機掃碼造訪本網址',
    mobileHint: '用手機相機或瀏覽器掃描 QR Code，開啟目前頁面。',
  },
  ja: {
    label: 'スマートフォンでこのページを開く',
    title: '現在のページのQRコード',
    hint: 'スマートフォンのカメラでスキャンして開く',
    mobileTitle: 'QRコードでこのサイトを開く',
    mobileHint: 'スマートフォンのカメラやブラウザでスキャンして現在のページを開けます。',
  },
  ko: {
    label: '휴대폰에서 현재 페이지 열기',
    title: '현재 페이지 QR 코드',
    hint: '휴대폰 카메라로 스캔해 현재 페이지를 엽니다',
    mobileTitle: 'QR 코드로 이 주소 열기',
    mobileHint: '휴대폰 카메라나 브라우저로 QR 코드를 스캔해 현재 페이지를 여세요.',
  },
  en: {
    label: 'Open this page on your phone',
    title: 'QR code for this page',
    hint: 'Scan with your phone camera to open this page',
    mobileTitle: 'Open this website with a QR code',
    mobileHint: 'Scan with your phone camera or browser to open the current page.',
  },
  ru: {
    label: 'Открыть эту страницу на телефоне',
    title: 'QR-код текущей страницы',
    hint: 'Отсканируйте камерой телефона, чтобы открыть страницу',
    mobileTitle: 'Открыть этот сайт по QR-коду',
    mobileHint:
      'Отсканируйте QR-код камерой телефона или браузером, чтобы открыть текущую страницу.',
  },
};

function usePageQrInfo() {
  const locale = useAtomValue(localeAtom);
  const copy = qrCopy[locale] ?? qrCopy.en;

  return { copy, pageUrl: DEFAULT_PAGE_URL };
}

export function PageQrButton() {
  const { copy, pageUrl } = usePageQrInfo();
  const tooltipId = useId();

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.qrButton}
        type="button"
        aria-label={copy.label}
        aria-describedby={tooltipId}
        title={copy.label}
      >
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M14 14h2v2h-2z" />
          <path d="M19 14h2v2h-2z" />
          <path d="M14 19h2v2h-2z" />
          <path d="M18 18h3v3h-3z" />
        </svg>
      </button>

      <div id={tooltipId} className={styles.popover} role="tooltip">
        <div className={styles.qrFrame}>
          <QRCodeSVG
            value={pageUrl}
            size={164}
            level="M"
            marginSize={3}
            bgColor="#ffffff"
            fgColor="#111827"
            title={copy.title}
          />
        </div>
        <p className={styles.hint}>{copy.hint}</p>
        <p className={styles.url}>{pageUrl}</p>
      </div>
    </div>
  );
}

export function MobilePageQrCard() {
  const { copy, pageUrl } = usePageQrInfo();

  return (
    <div className={styles.mobileCard} aria-label={copy.mobileTitle}>
      <div className={styles.mobileQrFrame}>
        <QRCodeSVG
          value={pageUrl}
          size={188}
          level="M"
          marginSize={3}
          bgColor="#ffffff"
          fgColor="#111827"
          title={copy.title}
        />
      </div>
      <p className={styles.mobileTitle}>{copy.mobileTitle}</p>
      <p className={styles.mobileHint}>{copy.mobileHint}</p>
      <p className={styles.mobileUrl}>{pageUrl}</p>
    </div>
  );
}
