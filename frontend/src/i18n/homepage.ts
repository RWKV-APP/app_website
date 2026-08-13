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
  showcaseTitle: string;
  showcaseDescription: string;
  showcaseCaptureMeta: string;
  showcaseNormalTitle: string;
  showcaseNormalDescription: string;
  showcaseNormalAlt: string;
  showcaseConcurrentTitle: string;
  showcaseConcurrentDescription: string;
  showcaseConcurrentAlt: string;
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
    showcaseTitle: '看看它如何在本地运行',
    showcaseDescription:
      '真实设备上的 RWKV Chat 运行界面。截图会匹配当前页面的明暗主题，并提供中文或英文界面。',
    showcaseCaptureMeta: 'RWKV Chat 4.7.0 · 真实应用截图 · 简体中文界面',
    showcaseNormalTitle: '日常对话',
    showcaseNormalDescription: '使用 G1i 在设备本地逐字生成，不必把对话发送到云端。',
    showcaseNormalAlt: 'RWKV Chat 使用 G1i 在本地进行日常对话的界面',
    showcaseConcurrentTitle: 'G1i 高并发',
    showcaseConcurrentDescription: '多路任务在设备本地同时实时输出，进度清楚可见。',
    showcaseConcurrentAlt: 'RWKV Chat 使用本地 G1i 进行多路高并发实时输出的界面',
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
    showcaseTitle: '看看它如何在本機執行',
    showcaseDescription:
      '真實裝置上的 RWKV Chat 執行介面。截圖會配合目前頁面的明暗主題，並提供中文或英文介面。',
    showcaseCaptureMeta: 'RWKV Chat 4.7.0 · 真實應用截圖 · 簡體中文介面',
    showcaseNormalTitle: '日常對話',
    showcaseNormalDescription: '使用 G1i 在裝置本機逐字生成，對話不必傳送到雲端。',
    showcaseNormalAlt: 'RWKV Chat 使用 G1i 在本機進行日常對話的介面',
    showcaseConcurrentTitle: 'G1i 高併發',
    showcaseConcurrentDescription: '多路任務在裝置本機同時即時輸出，進度清楚可見。',
    showcaseConcurrentAlt: 'RWKV Chat 使用本機 G1i 進行多路高併發即時輸出的介面',
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
    showcaseTitle: '端末上で動く様子を見る',
    showcaseDescription:
      '実機で動作する RWKV Chat の画面です。スクリーンショットは現在の明暗テーマに合わせ、中国語または英語の UI を表示します。',
    showcaseCaptureMeta: 'RWKV Chat 4.7.0 · 実機アプリ画面 · 英語 UI',
    showcaseNormalTitle: '普段のチャット',
    showcaseNormalDescription:
      'G1i が端末上で逐次生成するため、会話をクラウドへ送る必要はありません。',
    showcaseNormalAlt: 'RWKV Chat が G1i を使って端末上で日常会話を生成している画面',
    showcaseConcurrentTitle: 'G1i 高並列処理',
    showcaseConcurrentDescription:
      '複数のタスクを端末上で同時にリアルタイム出力し、進行状況も確認できます。',
    showcaseConcurrentAlt: 'RWKV Chat がローカルの G1i で複数タスクを同時出力している画面',
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
    showcaseTitle: '기기에서 실행되는 모습을 확인하세요',
    showcaseDescription:
      '실제 기기에서 실행 중인 RWKV Chat 화면입니다. 스크린샷은 현재 밝기 테마에 맞추며 중국어 또는 영어 UI를 제공합니다.',
    showcaseCaptureMeta: 'RWKV Chat 4.7.0 · 실제 앱 화면 · 영어 UI',
    showcaseNormalTitle: '일상 대화',
    showcaseNormalDescription:
      'G1i가 기기에서 순차 생성하므로 대화를 클라우드로 보낼 필요가 없습니다.',
    showcaseNormalAlt: 'RWKV Chat이 G1i로 기기에서 일상 대화를 생성하는 화면',
    showcaseConcurrentTitle: 'G1i 고동시성',
    showcaseConcurrentDescription:
      '여러 작업이 기기에서 동시에 실시간으로 출력되며 진행 상황도 명확히 확인됩니다.',
    showcaseConcurrentAlt: 'RWKV Chat이 로컬 G1i로 여러 작업을 동시에 실시간 출력하는 화면',
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
    showcaseTitle: 'See it running on your device',
    showcaseDescription:
      'Real RWKV Chat sessions captured on-device. Screenshots follow the active light or dark theme, with Chinese or English UI available.',
    showcaseCaptureMeta: 'RWKV Chat 4.7.0 · Real app capture · English UI',
    showcaseNormalTitle: 'Everyday chat',
    showcaseNormalDescription:
      'G1i generates each response on-device, without sending the conversation to the cloud.',
    showcaseNormalAlt: 'RWKV Chat using G1i for an everyday on-device conversation',
    showcaseConcurrentTitle: 'G1i high concurrency',
    showcaseConcurrentDescription:
      'Multiple tasks stream in real time at once, all running locally with visible progress.',
    showcaseConcurrentAlt:
      'RWKV Chat streaming multiple concurrent tasks in real time with local G1i',
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
    showcaseTitle: 'Посмотрите, как приложение работает на устройстве',
    showcaseDescription:
      'Настоящие сеансы RWKV Chat на реальном устройстве. Снимки соответствуют светлой или тёмной теме и показывают интерфейс на китайском или английском.',
    showcaseCaptureMeta: 'RWKV Chat 4.7.0 · Реальный снимок приложения · Интерфейс на английском',
    showcaseNormalTitle: 'Обычный диалог',
    showcaseNormalDescription:
      'G1i генерирует ответ на устройстве, не отправляя переписку в облако.',
    showcaseNormalAlt: 'Обычный диалог в RWKV Chat с локальной генерацией G1i',
    showcaseConcurrentTitle: 'Высокая параллельность G1i',
    showcaseConcurrentDescription:
      'Несколько задач одновременно выводят результат в реальном времени, локально и с видимым прогрессом.',
    showcaseConcurrentAlt: 'RWKV Chat одновременно выводит несколько задач с помощью локальной G1i',
  },
};

export function getHomePageCopy(locale: Locale): HomePageCopy {
  return homepageCopy[locale] || homepageCopy.en;
}
