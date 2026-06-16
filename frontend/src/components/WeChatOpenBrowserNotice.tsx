'use client';

import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { localeAtom } from '@/atoms';
import type { Locale } from '@/i18n/locales';
import styles from './WeChatOpenBrowserNotice.module.css';

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    body: string;
    action: string;
    stepOne: string;
    stepTwo: string;
    close: string;
  }
> = {
  'zh-CN': {
    eyebrow: '微信内打开',
    title: '请用默认浏览器打开本页',
    body: '微信内置浏览器可能限制安装包下载。切到系统浏览器后，下载会更稳定。',
    action: '查看打开方式',
    stepOne: '点击微信右上角的三个点按钮',
    stepTwo: '选择“在浏览器打开”，然后回到本页下载 RWKV Chat',
    close: '收起',
  },
  'zh-TW': {
    eyebrow: '微信內開啟',
    title: '請用預設瀏覽器開啟本頁',
    body: '微信內建瀏覽器可能限制安裝包下載。切到系統瀏覽器後，下載會更穩定。',
    action: '查看開啟方式',
    stepOne: '點擊微信右上角的三個點按鈕',
    stepTwo: '選擇「在瀏覽器開啟」，然後回到本頁下載 RWKV Chat',
    close: '收起',
  },
  ja: {
    eyebrow: 'WeChat内で表示中',
    title: '標準ブラウザでこのページを開いてください',
    body: 'WeChatの内蔵ブラウザではダウンロードが制限されることがあります。',
    action: '開き方を見る',
    stepOne: 'WeChat右上の三点ボタンをタップ',
    stepTwo: '「ブラウザで開く」を選んでから RWKV Chat をダウンロード',
    close: '閉じる',
  },
  ko: {
    eyebrow: 'WeChat에서 열림',
    title: '기본 브라우저에서 이 페이지를 열어 주세요',
    body: 'WeChat 내장 브라우저에서는 설치 파일 다운로드가 제한될 수 있습니다.',
    action: '여는 방법 보기',
    stepOne: 'WeChat 오른쪽 위 점 세 개 버튼을 탭하세요',
    stepTwo: '브라우저에서 열기를 선택한 뒤 RWKV Chat을 다운로드하세요',
    close: '접기',
  },
  en: {
    eyebrow: 'Opened in WeChat',
    title: 'Open this page in your default browser',
    body: 'WeChat may limit app downloads. Using your system browser makes downloading more reliable.',
    action: 'Show how to open',
    stepOne: 'Tap the three-dot menu in the top-right corner of WeChat',
    stepTwo: 'Choose “Open in Browser”, then download RWKV Chat from this page',
    close: 'Collapse',
  },
  ru: {
    eyebrow: 'Открыто в WeChat',
    title: 'Откройте страницу в браузере по умолчанию',
    body: 'Встроенный браузер WeChat может ограничивать загрузку установочных файлов.',
    action: 'Показать способ',
    stepOne: 'Нажмите меню с тремя точками в правом верхнем углу WeChat',
    stepTwo: 'Выберите «Открыть в браузере», затем скачайте RWKV Chat с этой страницы',
    close: 'Свернуть',
  },
};

function isWeChatBrowser(userAgent: string): boolean {
  return /micromessenger/i.test(userAgent);
}

export function WeChatOpenBrowserNotice() {
  const locale = useAtomValue(localeAtom);
  const text = copy[locale] ?? copy.en;
  const [isWeChat, setIsWeChat] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setIsWeChat(isWeChatBrowser(navigator.userAgent));
  }, []);

  if (!isWeChat) {
    return null;
  }

  return (
    <section className={styles.notice} aria-label={text.title}>
      <div className={styles.content}>
        <div className={styles.iconWrap} aria-hidden="true">
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10.5h.01M12 10.5h.01M17 10.5h.01M5 18.5l1.35-3.05A7.8 7.8 0 0 1 4 10c0-4.14 3.58-7.5 8-7.5s8 3.36 8 7.5-3.58 7.5-8 7.5a8.7 8.7 0 0 1-3.28-.64L5 18.5Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className={styles.text}>
          <p className={styles.eyebrow}>{text.eyebrow}</p>
          <h2 className={styles.title}>{text.title}</h2>
          <p className={styles.body}>{text.body}</p>

          {expanded && (
            <ol className={styles.steps}>
              <li>{text.stepOne}</li>
              <li>{text.stepTwo}</li>
            </ol>
          )}
        </div>

        <button
          className={styles.action}
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
          </svg>
          <span>{expanded ? text.close : text.action}</span>
        </button>
      </div>
    </section>
  );
}
