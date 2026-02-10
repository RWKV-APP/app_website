import type { Locale } from '@/i18n/locales';
import type { Theme } from '@/atoms';

/**
 * 获取 App Store 徽章路径
 * 根据语言和主题返回对应的 SVG 路径
 */
export function getAppStoreBadgePath(options: { locale: Locale; theme: Theme }): string {
  const { locale, theme } = options;
  // 深色模式用白色边框的徽章，浅色模式用黑色边框的徽章
  const variant = theme === 'dark' ? 'wht' : 'blk';
  return `/images/badges/app-store/${locale}-${variant}.svg`;
}

/**
 * 获取 Apple Logo 路径
 * 根据主题返回对应的 SVG 路径
 */
export function getAppleLogoPath(options: { theme: Theme }): string {
  const { theme } = options;
  // 深色模式用白色 logo，浅色模式用黑色 logo
  return theme === 'dark'
    ? '/images/logos/apple-logo-inverted.svg'
    : '/images/logos/apple-logo.svg';
}

/**
 * 获取平台图标路径
 */
export function getPlatformIconPath(options: { platform: string }): string {
  const { platform } = options;

  const platformIcons: Record<string, string> = {
    android: '/images/platforms/android.svg',
    ios: '/images/logos/apple-logo.svg', // iOS 使用 Apple logo
    macos: '/images/logos/apple-logo.svg', // macOS 使用 Apple logo
    windows: '/images/platforms/windows-logo.png',
    linux: '/images/platforms/linux.png',
  };

  return platformIcons[platform] || '';
}

/**
 * 获取 RWKV Logo 路径
 */
export function getRWKVLogoPath(): string {
  return '/images/logos/rwkv.png';
}

/**
 * 获取 APP Icon 的路径
 * 统一使用浅色版本
 */
export function getAppIconPath(): string {
  return '/images/app-icon/app-icon-light.png';
}

/**
 * 根据当前主题获取 Branding 图片的路径
 */
export function getBrandingPath({ theme }: { theme: Theme }): string {
  return theme === 'dark' ? '/images/logos/branding-dark.png' : '/images/logos/branding-light.png';
}

/**
 * 获取 Google Play Store 徽章路径
 * 根据语言返回对应的 SVG 路径
 */
export function getGooglePlayBadgePath(options: { locale: Locale }): string {
  const { locale } = options;

  // 将 locale 映射到 SVG 文件名
  const localeToFileName: Record<Locale, string> = {
    'zh-CN': 'Chinese-China',
    'zh-TW': 'Chinese-Taiwan',
    ja: 'Japanese',
    ko: 'Korean',
    en: 'English',
    ru: 'Russian',
  };

  const fileName = localeToFileName[locale] || localeToFileName['en'];
  return `/images/badges/playstore/GetItOnGooglePlay_Badge_Web_color_${fileName}.svg`;
}
