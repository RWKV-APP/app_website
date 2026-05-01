import type { Locale } from './locales';

export interface HomePageCopy {
  heroTitle: string;
  choosePlatform: string;
  chooseArchitecture: string;
  chooseInstallType: string;
  downloadSectionTitle: string;
  installerRecommendedDesc: string;
  zipPortableDesc: string;
  appImagePortableDesc: string;
  tarGzArchiveDesc: string;
  sourceDescEarlyAccess: string;
  sourceDescStableRelease: string;
  sourceDescFastInChina: string;
  sourceDescMirrorForChina: string;
  sourceDescDistributionPlatform: string;
  sourceDescGlobalSource: string;
  sourceDescAlternativeSource: string;
  sourceDescPrimarySource: string;
  sourceDescMainlandChina: string;
  sourceDescOfficialStore: string;
  downloadNowButton: string;
  loadingDownloads: string;
  noDownloadLink: string;
  currentSourceLabel: string;
  switchDownloadSource: string;
  hideOtherSources: string;
  recommendedLabel: string;
}

const homepageCopy: Record<Locale, HomePageCopy> = {
  'zh-CN': {
    heroTitle: '下载 RWKV Chat',
    choosePlatform: '选择你的平台',
    chooseArchitecture: '选择处理器架构',
    chooseInstallType: '选择安装方式',
    downloadSectionTitle: '下载',
    installerRecommendedDesc: '推荐，自动安装',
    zipPortableDesc: '免安装，解压即用',
    appImagePortableDesc: '单文件运行，适合桌面用户',
    tarGzArchiveDesc: '压缩包，适合手动部署',
    sourceDescEarlyAccess: '抢先体验最新版本',
    sourceDescStableRelease: '稳定正式版',
    sourceDescFastInChina: '国内高速下载',
    sourceDescMirrorForChina: '国内镜像',
    sourceDescDistributionPlatform: '国内分发平台',
    sourceDescGlobalSource: '海外源',
    sourceDescAlternativeSource: '备用下载源',
    sourceDescPrimarySource: '首选下载源',
    sourceDescMainlandChina: '适合中国大陆用户',
    sourceDescOfficialStore: '官方应用商店',
    downloadNowButton: '立即下载',
    loadingDownloads: '加载中...',
    noDownloadLink: '暂无下载链接',
    currentSourceLabel: '下载源',
    switchDownloadSource: '切换其他下载源',
    hideOtherSources: '收起其他下载源',
    recommendedLabel: '推荐',
  },
  'zh-TW': {
    heroTitle: '下載 RWKV Chat',
    choosePlatform: '選擇你的平台',
    chooseArchitecture: '選擇處理器架構',
    chooseInstallType: '選擇安裝方式',
    downloadSectionTitle: '下載',
    installerRecommendedDesc: '推薦，自動安裝',
    zipPortableDesc: '免安裝，解壓即用',
    appImagePortableDesc: '單檔執行，適合桌面用戶',
    tarGzArchiveDesc: '壓縮包，適合手動部署',
    sourceDescEarlyAccess: '搶先體驗最新版本',
    sourceDescStableRelease: '穩定正式版',
    sourceDescFastInChina: '中國大陸高速下載',
    sourceDescMirrorForChina: '中國大陸鏡像',
    sourceDescDistributionPlatform: '分發平台',
    sourceDescGlobalSource: '海外源',
    sourceDescAlternativeSource: '備用下載源',
    sourceDescPrimarySource: '首選下載源',
    sourceDescMainlandChina: '適合中國大陸用戶',
    sourceDescOfficialStore: '官方應用商店',
    downloadNowButton: '立即下載',
    loadingDownloads: '載入中...',
    noDownloadLink: '暫無下載連結',
    currentSourceLabel: '下載源',
    switchDownloadSource: '切換其他下載源',
    hideOtherSources: '收起其他下載源',
    recommendedLabel: '推薦',
  },
  ja: {
    heroTitle: 'RWKV Chat をダウンロード',
    choosePlatform: 'プラットフォームを選択',
    chooseArchitecture: 'アーキテクチャを選択',
    chooseInstallType: 'インストール方式を選択',
    downloadSectionTitle: 'ダウンロード',
    installerRecommendedDesc: '推奨、自動インストール',
    zipPortableDesc: '展開してすぐ使えます',
    appImagePortableDesc: '単一ファイルで実行、デスクトップ向け',
    tarGzArchiveDesc: '手動配置向けの圧縮アーカイブ',
    sourceDescEarlyAccess: '最新バージョンを先行体験',
    sourceDescStableRelease: '安定版',
    sourceDescFastInChina: '中国本土で高速',
    sourceDescMirrorForChina: '中国向けミラー',
    sourceDescDistributionPlatform: '配布プラットフォーム',
    sourceDescGlobalSource: 'グローバル配布元',
    sourceDescAlternativeSource: '代替配布元',
    sourceDescPrimarySource: '推奨配布元',
    sourceDescMainlandChina: '中国本土ユーザー向け',
    sourceDescOfficialStore: '公式ストア',
    downloadNowButton: '今すぐダウンロード',
    loadingDownloads: '読み込み中...',
    noDownloadLink: '利用可能なダウンロードリンクがありません',
    currentSourceLabel: 'ダウンロード元',
    switchDownloadSource: '他のダウンロード元に切り替え',
    hideOtherSources: '他のダウンロード元を隠す',
    recommendedLabel: 'おすすめ',
  },
  ko: {
    heroTitle: 'RWKV Chat 다운로드',
    choosePlatform: '플랫폼 선택',
    chooseArchitecture: '아키텍처 선택',
    chooseInstallType: '설치 방식 선택',
    downloadSectionTitle: '다운로드',
    installerRecommendedDesc: '권장, 자동 설치',
    zipPortableDesc: '압축 해제 후 바로 사용',
    appImagePortableDesc: '단일 파일 실행, 데스크톱에 적합',
    tarGzArchiveDesc: '수동 배포용 압축 파일',
    sourceDescEarlyAccess: '최신 버전 미리 체험',
    sourceDescStableRelease: '안정 버전',
    sourceDescFastInChina: '중국 본토에서 빠름',
    sourceDescMirrorForChina: '중국용 미러',
    sourceDescDistributionPlatform: '배포 플랫폼',
    sourceDescGlobalSource: '글로벌 소스',
    sourceDescAlternativeSource: '대체 소스',
    sourceDescPrimarySource: '기본 다운로드 소스',
    sourceDescMainlandChina: '중국 본토 사용자용',
    sourceDescOfficialStore: '공식 스토어',
    downloadNowButton: '지금 다운로드',
    loadingDownloads: '불러오는 중...',
    noDownloadLink: '다운로드 링크가 아직 없습니다',
    currentSourceLabel: '다운로드 소스',
    switchDownloadSource: '다른 다운로드 소스 선택',
    hideOtherSources: '다른 다운로드 소스 숨기기',
    recommendedLabel: '추천',
  },
  en: {
    heroTitle: 'Download RWKV Chat',
    choosePlatform: 'Choose your platform',
    chooseArchitecture: 'Choose architecture',
    chooseInstallType: 'Choose install type',
    downloadSectionTitle: 'Download',
    installerRecommendedDesc: 'Recommended, auto install',
    zipPortableDesc: 'Portable, no install needed',
    appImagePortableDesc: 'Single-file app for desktop users',
    tarGzArchiveDesc: 'Archive for manual setup',
    sourceDescEarlyAccess: 'Get early access to new versions',
    sourceDescStableRelease: 'Stable release',
    sourceDescFastInChina: 'Fast in China',
    sourceDescMirrorForChina: 'Mirror for China',
    sourceDescDistributionPlatform: 'Distribution platform',
    sourceDescGlobalSource: 'Global source',
    sourceDescAlternativeSource: 'Alternative source',
    sourceDescPrimarySource: 'Primary source',
    sourceDescMainlandChina: 'Best for mainland China users',
    sourceDescOfficialStore: 'Official app store',
    downloadNowButton: 'Download Now',
    loadingDownloads: 'Loading...',
    noDownloadLink: 'No download link available',
    currentSourceLabel: 'Source',
    switchDownloadSource: 'Switch download source',
    hideOtherSources: 'Hide other sources',
    recommendedLabel: 'Recommended',
  },
  ru: {
    heroTitle: 'Скачать RWKV Chat',
    choosePlatform: 'Выберите платформу',
    chooseArchitecture: 'Выберите архитектуру',
    chooseInstallType: 'Выберите способ установки',
    downloadSectionTitle: 'Скачать',
    installerRecommendedDesc: 'Рекомендуется, установка автоматически',
    zipPortableDesc: 'Портативная версия, без установки',
    appImagePortableDesc: 'Один файл для настольных систем',
    tarGzArchiveDesc: 'Архив для ручной настройки',
    sourceDescEarlyAccess: 'Ранний доступ к новым версиям',
    sourceDescStableRelease: 'Стабильный релиз',
    sourceDescFastInChina: 'Быстро в материковом Китае',
    sourceDescMirrorForChina: 'Зеркало для Китая',
    sourceDescDistributionPlatform: 'Платформа распространения',
    sourceDescGlobalSource: 'Глобальный источник',
    sourceDescAlternativeSource: 'Альтернативный источник',
    sourceDescPrimarySource: 'Основной источник',
    sourceDescMainlandChina: 'Подходит для пользователей материкового Китая',
    sourceDescOfficialStore: 'Официальный магазин',
    downloadNowButton: 'Скачать сейчас',
    loadingDownloads: 'Загрузка...',
    noDownloadLink: 'Ссылка на скачивание недоступна',
    currentSourceLabel: 'Источник',
    switchDownloadSource: 'Сменить источник загрузки',
    hideOtherSources: 'Скрыть другие источники',
    recommendedLabel: 'Рекомендуем',
  },
};

export function getHomePageCopy(locale: Locale): HomePageCopy {
  return homepageCopy[locale] || homepageCopy.en;
}
