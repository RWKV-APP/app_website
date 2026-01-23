import type { Locale } from './locales';

export interface Translations {
  // Common
  backToDownload: string;

  // Home page - Hero
  appName: string;
  appTagline: string;
  appDescription: string;

  // Home page - Features
  features: string;
  featureOffline: string;
  featureOfflineDesc: string;
  featurePrivacy: string;
  featurePrivacyDesc: string;
  featureCrossplatform: string;
  featureCrossplatformDesc: string;
  featureAcceleration: string;
  featureAccelerationDesc: string;
  featureMultimodal: string;
  featureMultimodalDesc: string;

  // Home page - Download
  downloadNow: string;
  smartDownload: string;
  downloadForYourDevice: string;
  downloadOtherPlatforms: string;
  mobile: string;
  mobileDesc: string;
  desktop: string;
  desktopDesc: string;
  viewChangelog: string;

  // Home page - Open Source
  openSource: string;
  openSourceDesc: string;
  viewOnGithub: string;

  // Theme Switcher
  switchToLight: string;
  switchToDark: string;

  // Home page - Community (Deprecated, kept for compatibility)
  appDownload: string;
  downloadDescription: string;

  // Platforms
  android: string;
  ios: string;
  macos: string;
  windows: string;
  linux: string;
  apk: string;
  appStore: string;
  playStore: string;
  testFlight: string;
  universal: string;
  dmg: string;
  installer: string;
  zip: string;

  // System requirements
  iosRequirement: string;
  macosRequirement: string;
  windowsRequirement: string;
  linuxRequirement: string;
  androidRequirement: string;

  // Changelog page
  changelog: string;
  changelogDescription: string;
  feature: string;
  fix: string;
  improvement: string;
  breaking: string;

  // Changelog entries
  darkModeSupport: string;
  macosUniversal: string;
  uiOptimization: string;
  windowsCrashFix: string;
  linuxSupport: string;
  windowsSupport: string;
  startupSpeedUp: string;
  iosNotificationFix: string;
  initialRelease: string;
  androidIosSupport: string;
  macosSupport: string;
}

const translations: Record<Locale, Translations> = {
  'zh-CN': {
    backToDownload: '← 返回下载页面',
    appName: 'RWKV Chat',
    appTagline: '让大模型触手可及',
    appDescription: '便携式、全平台的 RWKV 模型推理终端，基于 Flutter 与 C++ 高性能推理引擎',
    features: '✨ 核心特性',
    featureOffline: '离线运行',
    featureOfflineDesc: '权重一经下载即可离线使用，无需网络连接',
    featurePrivacy: '隐私安全',
    featurePrivacyDesc: '本地运行，数据不外传，完全保护您的隐私',
    featureCrossplatform: '全平台覆盖',
    featureCrossplatformDesc: '支持 Android、iOS、Windows、macOS、Linux',
    featureAcceleration: '设备专用加速',
    featureAccelerationDesc: '高通骁龙 NPU、Apple MLX 硬件加速',
    featureMultimodal: '多模态多功能',
    featureMultimodalDesc: '聊天、图像理解、语音输出、OCR 翻译、小说续写',
    downloadNow: '⬇️ 立即下载',
    smartDownload: '立即下载',
    downloadForYourDevice: '为您的设备下载',
    downloadOtherPlatforms: '下载其他平台',
    mobile: '📱 移动端',
    mobileDesc: '随身携带的 AI 助手，支持语音对话、图片理解和实时问答',
    desktop: '💻 桌面端',
    desktopDesc: '强大的桌面 AI 助手，处理文档、邮件、截图和屏幕上的所有内容',
    viewChangelog: '📋 查看更新日志',
    openSource: '🔓 开源项目',
    openSourceDesc: '我们坚持 Open Source First，所有代码与工程实践均已开源',
    viewOnGithub: '在 GitHub 上查看',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
    appDownload: '应用下载',
    downloadDescription: '下载适合您设备的最新版本应用',
    android: 'Android',
    ios: 'iOS',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    apk: 'APK',
    appStore: 'App Store',
    playStore: 'Play Store',
    testFlight: 'TestFlight',
    universal: 'Universal',
    dmg: 'DMG',
    installer: 'Installer',
    zip: 'Zip',
    iosRequirement: 'iOS 16+',
    macosRequirement: 'macOS 15+',
    windowsRequirement: 'Win10+ (x64)',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '更新日志',
    changelogDescription: '查看应用的版本更新记录',
    feature: '新功能',
    fix: '修复',
    improvement: '优化',
    breaking: '破坏性变更',
    darkModeSupport: '新增深色模式支持',
    macosUniversal: '支持 macOS Universal 安装包',
    uiOptimization: '优化下载页面 UI',
    windowsCrashFix: '修复 Windows 下启动闪退问题',
    linuxSupport: '新增 Linux x86_64 支持',
    windowsSupport: '新增 Windows x86_64 支持',
    startupSpeedUp: '提升应用启动速度',
    iosNotificationFix: '修复 iOS 通知推送问题',
    initialRelease: '首次发布',
    androidIosSupport: '支持 Android 和 iOS 平台',
    macosSupport: '支持 macOS 平台',
  },
  'zh-TW': {
    backToDownload: '← 返回下載頁面',
    appName: 'RWKV Chat',
    appTagline: '讓大模型觸手可及',
    appDescription: '便攜式、全平台的 RWKV 模型推理終端，基於 Flutter 與 C++ 高性能推理引擎',
    features: '✨ 核心特性',
    featureOffline: '離線運行',
    featureOfflineDesc: '權重一經下載即可離線使用，無需網路連接',
    featurePrivacy: '隱私安全',
    featurePrivacyDesc: '本地運行，數據不外傳，完全保護您的隱私',
    featureCrossplatform: '全平台覆蓋',
    featureCrossplatformDesc: '支援 Android、iOS、Windows、macOS、Linux',
    featureAcceleration: '設備專用加速',
    featureAccelerationDesc: '高通驍龍 NPU、Apple MLX 硬體加速',
    featureMultimodal: '多模態多功能',
    featureMultimodalDesc: '聊天、圖像理解、語音輸出、OCR 翻譯、小說續寫',
    downloadNow: '⬇️ 立即下載',
    smartDownload: '立即下載',
    downloadForYourDevice: '為您的裝置下載',
    downloadOtherPlatforms: '下載其他平台',
    mobile: '📱 行動裝置',
    mobileDesc: '隨身攜帶的 AI 助手，支援語音對話、圖片理解和即時問答',
    desktop: '💻 桌面端',
    desktopDesc: '強大的桌面 AI 助手，處理文件、郵件、截圖和螢幕上的所有內容',
    viewChangelog: '📋 查看更新日誌',
    openSource: '🔓 開源項目',
    openSourceDesc: '我們堅持 Open Source First，所有代碼與工程實踐均已開源',
    viewOnGithub: '在 GitHub 上查看',
    switchToLight: '切換到淺色模式',
    switchToDark: '切換到深色模式',
    appDownload: '應用下載',
    downloadDescription: '下載適合您裝置的最新版本應用',
    android: 'Android',
    ios: 'iOS',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    apk: 'APK',
    appStore: 'App Store',
    playStore: 'Play Store',
    testFlight: 'TestFlight',
    universal: 'Universal',
    dmg: 'DMG',
    installer: 'Installer',
    zip: 'Zip',
    iosRequirement: 'iOS 16+',
    macosRequirement: 'macOS 15+',
    windowsRequirement: 'Win10+ (x64)',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '更新日誌',
    changelogDescription: '查看應用的版本更新記錄',
    feature: '新功能',
    fix: '修復',
    improvement: '優化',
    breaking: '破壞性變更',
    darkModeSupport: '新增深色模式支援',
    macosUniversal: '支援 macOS Universal 安裝包',
    uiOptimization: '優化下載頁面 UI',
    windowsCrashFix: '修復 Windows 下啟動閃退問題',
    linuxSupport: '新增 Linux x86_64 支援',
    windowsSupport: '新增 Windows x86_64 支援',
    startupSpeedUp: '提升應用啟動速度',
    iosNotificationFix: '修復 iOS 通知推送問題',
    initialRelease: '首次發布',
    androidIosSupport: '支援 Android 和 iOS 平台',
    macosSupport: '支援 macOS 平台',
  },
  ja: {
    backToDownload: '← ダウンロードページに戻る',
    appName: 'RWKV Chat',
    appTagline: 'AIをもっと身近に',
    appDescription: 'Flutter と C++ 高性能推論エンジンを融合したポータブルなRWKVモデル推論端末',
    features: '✨ 主な機能',
    featureOffline: 'オフライン実行',
    featureOfflineDesc: 'モデルをダウンロード後、オフラインで利用可能',
    featurePrivacy: 'プライバシー保護',
    featurePrivacyDesc: 'ローカル実行、データは外部に送信されません',
    featureCrossplatform: 'クロスプラットフォーム',
    featureCrossplatformDesc: 'Android、iOS、Windows、macOS、Linux対応',
    featureAcceleration: 'ハードウェア加速',
    featureAccelerationDesc: 'Qualcomm Snapdragon NPU、Apple MLX対応',
    featureMultimodal: 'マルチモーダル',
    featureMultimodalDesc: 'チャット、画像理解、音声出力、OCR翻訳、小説続き書き',
    downloadNow: '⬇️ 今すぐダウンロード',
    smartDownload: '今すぐダウンロード',
    downloadForYourDevice: 'お使いのデバイス用にダウンロード',
    downloadOtherPlatforms: '他のプラットフォームをダウンロード',
    mobile: '📱 モバイル',
    mobileDesc: '持ち運べる AI アシスタント、音声対話、画像理解、リアルタイム質問対応',
    desktop: '💻 デスクトップ',
    desktopDesc:
      '強力なデスクトップ AI アシスタント、文書、メール、スクリーンショット、画面のあらゆる内容を処理',
    viewChangelog: '📋 更新履歴を見る',
    openSource: '🔓 オープンソース',
    openSourceDesc: 'Open Source First を貫き、すべてのコードを公開しています',
    viewOnGithub: 'GitHub で見る',
    switchToLight: 'ライトモードに切り替え',
    switchToDark: 'ダークモードに切り替え',
    appDownload: 'アプリダウンロード',
    downloadDescription: 'お使いのデバイスに最新バージョンをダウンロード',
    android: 'Android',
    ios: 'iOS',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    apk: 'APK',
    appStore: 'App Store',
    playStore: 'Play Store',
    testFlight: 'TestFlight',
    universal: 'Universal',
    dmg: 'DMG',
    installer: 'Installer',
    zip: 'Zip',
    iosRequirement: 'iOS 16+',
    macosRequirement: 'macOS 15+',
    windowsRequirement: 'Win10+ (x64)',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '更新履歴',
    changelogDescription: 'アプリのバージョン更新履歴',
    feature: '新機能',
    fix: '修正',
    improvement: '改善',
    breaking: '破壊的変更',
    darkModeSupport: 'ダークモードに対応',
    macosUniversal: 'macOS Universal パッケージに対応',
    uiOptimization: 'ダウンロードページのUI最適化',
    windowsCrashFix: 'Windows起動時のクラッシュを修正',
    linuxSupport: 'Linux x86_64 に対応',
    windowsSupport: 'Windows x86_64 に対応',
    startupSpeedUp: '起動速度の向上',
    iosNotificationFix: 'iOS通知の問題を修正',
    initialRelease: '初回リリース',
    androidIosSupport: 'Android・iOSプラットフォームに対応',
    macosSupport: 'macOSプラットフォームに対応',
  },
  ko: {
    backToDownload: '← 다운로드 페이지로 돌아가기',
    appName: 'RWKV Chat',
    appTagline: 'AI를 더 가까이',
    appDescription: 'Flutter와 C++ 고성능 추론 엔진을 결합한 휴대용 RWKV 모델 추론 터미널',
    features: '✨ 주요 기능',
    featureOffline: '오프라인 실행',
    featureOfflineDesc: '모델 다운로드 후 오프라인으로 사용 가능',
    featurePrivacy: '개인정보 보호',
    featurePrivacyDesc: '로컬 실행, 데이터가 외부로 전송되지 않음',
    featureCrossplatform: '크로스 플랫폼',
    featureCrossplatformDesc: 'Android, iOS, Windows, macOS, Linux 지원',
    featureAcceleration: '하드웨어 가속',
    featureAccelerationDesc: 'Qualcomm Snapdragon NPU, Apple MLX 지원',
    featureMultimodal: '멀티모달',
    featureMultimodalDesc: '채팅, 이미지 이해, 음성 출력, OCR 번역, 소설 이어쓰기',
    downloadNow: '⬇️ 지금 다운로드',
    smartDownload: '지금 다운로드',
    downloadForYourDevice: '기기에 맞게 다운로드',
    downloadOtherPlatforms: '다른 플랫폼 다운로드',
    mobile: '📱 모바일',
    mobileDesc: '휴대용 AI 어시스턴트, 음성 대화, 이미지 이해, 실시간 질문 응답',
    desktop: '💻 데스크톱',
    desktopDesc: '강력한 데스크톱 AI 어시스턴트, 문서, 이메일, 스크린샷 및 화면의 모든 내용 처리',
    viewChangelog: '📋 업데이트 내역 보기',
    openSource: '🔓 오픈소스',
    openSourceDesc: 'Open Source First를 지향하며 모든 코드를 공개합니다',
    viewOnGithub: 'GitHub에서 보기',
    switchToLight: '라이트 모드로 전환',
    switchToDark: '다크 모드로 전환',
    appDownload: '앱 다운로드',
    downloadDescription: '기기에 맞는 최신 버전을 다운로드하세요',
    android: 'Android',
    ios: 'iOS',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    apk: 'APK',
    appStore: 'App Store',
    playStore: 'Play Store',
    testFlight: 'TestFlight',
    universal: 'Universal',
    dmg: 'DMG',
    installer: 'Installer',
    zip: 'Zip',
    iosRequirement: 'iOS 16+',
    macosRequirement: 'macOS 15+',
    windowsRequirement: 'Win10+ (x64)',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '업데이트 내역',
    changelogDescription: '앱 버전 업데이트 기록',
    feature: '새 기능',
    fix: '수정',
    improvement: '개선',
    breaking: '주요 변경',
    darkModeSupport: '다크 모드 지원 추가',
    macosUniversal: 'macOS Universal 패키지 지원',
    uiOptimization: '다운로드 페이지 UI 최적화',
    windowsCrashFix: 'Windows 시작 시 충돌 문제 수정',
    linuxSupport: 'Linux x86_64 지원 추가',
    windowsSupport: 'Windows x86_64 지원 추가',
    startupSpeedUp: '앱 시작 속도 향상',
    iosNotificationFix: 'iOS 알림 문제 수정',
    initialRelease: '첫 출시',
    androidIosSupport: 'Android 및 iOS 플랫폼 지원',
    macosSupport: 'macOS 플랫폼 지원',
  },
  en: {
    backToDownload: '← Back to Download',
    appName: 'RWKV Chat',
    appTagline: 'AI at Your Fingertips',
    appDescription:
      'Portable, cross-platform RWKV model inference terminal powered by Flutter and C++ high-performance engine',
    features: '✨ Key Features',
    featureOffline: 'Offline Ready',
    featureOfflineDesc: 'Works offline once the model is downloaded',
    featurePrivacy: 'Privacy First',
    featurePrivacyDesc: 'Runs locally, your data never leaves your device',
    featureCrossplatform: 'Cross-Platform',
    featureCrossplatformDesc: 'Android, iOS, Windows, macOS, Linux supported',
    featureAcceleration: 'Hardware Acceleration',
    featureAccelerationDesc: 'Qualcomm Snapdragon NPU, Apple MLX support',
    featureMultimodal: 'Multimodal',
    featureMultimodalDesc: 'Chat, image understanding, TTS, OCR translation, novel continuation',
    downloadNow: '⬇️ Download Now',
    smartDownload: 'Download',
    downloadForYourDevice: 'Download for your device',
    downloadOtherPlatforms: 'Download for other platforms',
    mobile: '📱 Mobile',
    mobileDesc:
      'Your portable AI assistant with voice conversations, image understanding, and real-time Q&A',
    desktop: '💻 Desktop',
    desktopDesc:
      'Powerful desktop AI assistant that handles documents, emails, screenshots, and everything on your screen',
    viewChangelog: '📋 View Changelog',
    openSource: '🔓 Open Source',
    openSourceDesc:
      'We embrace Open Source First, all code and engineering practices are open source',
    viewOnGithub: 'View on GitHub',
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
    appDownload: 'App Download',
    downloadDescription: 'Download the latest version for your device',
    android: 'Android',
    ios: 'iOS',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    apk: 'APK',
    appStore: 'App Store',
    playStore: 'Play Store',
    testFlight: 'TestFlight',
    universal: 'Universal',
    dmg: 'DMG',
    installer: 'Installer',
    zip: 'Zip',
    iosRequirement: 'iOS 16+',
    macosRequirement: 'macOS 15+',
    windowsRequirement: 'Win10+ (x64)',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: 'Changelog',
    changelogDescription: 'View app version update history',
    feature: 'Feature',
    fix: 'Fix',
    improvement: 'Improvement',
    breaking: 'Breaking',
    darkModeSupport: 'Added dark mode support',
    macosUniversal: 'Support for macOS Universal package',
    uiOptimization: 'Optimized download page UI',
    windowsCrashFix: 'Fixed Windows startup crash',
    linuxSupport: 'Added Linux x86_64 support',
    windowsSupport: 'Added Windows x86_64 support',
    startupSpeedUp: 'Improved app startup speed',
    iosNotificationFix: 'Fixed iOS push notification issue',
    initialRelease: 'Initial release',
    androidIosSupport: 'Support for Android and iOS platforms',
    macosSupport: 'Support for macOS platform',
  },
  ru: {
    backToDownload: '← Вернуться к загрузке',
    appName: 'RWKV Chat',
    appTagline: 'ИИ под рукой',
    appDescription:
      'Портативный кроссплатформенный терминал для вывода моделей RWKV на базе Flutter и C++',
    features: '✨ Ключевые функции',
    featureOffline: 'Работа офлайн',
    featureOfflineDesc: 'Работает офлайн после загрузки модели',
    featurePrivacy: 'Приватность',
    featurePrivacyDesc: 'Локальный запуск, данные не покидают устройство',
    featureCrossplatform: 'Кроссплатформенность',
    featureCrossplatformDesc: 'Android, iOS, Windows, macOS, Linux',
    featureAcceleration: 'Аппаратное ускорение',
    featureAccelerationDesc: 'Qualcomm Snapdragon NPU, Apple MLX',
    featureMultimodal: 'Мультимодальность',
    featureMultimodalDesc: 'Чат, понимание изображений, TTS, OCR, продолжение романов',
    downloadNow: '⬇️ Скачать сейчас',
    smartDownload: 'Скачать',
    downloadForYourDevice: 'Скачать для вашего устройства',
    downloadOtherPlatforms: 'Скачать для других платформ',
    mobile: '📱 Мобильные',
    mobileDesc:
      'Портативный AI-ассистент с голосовыми диалогами, пониманием изображений и ответами в реальном времени',
    desktop: '💻 Десктоп',
    desktopDesc:
      'Мощный настольный AI-ассистент для работы с документами, письмами, скриншотами и всем содержимым экрана',
    viewChangelog: '📋 История изменений',
    openSource: '🔓 Открытый код',
    openSourceDesc: 'Мы придерживаемся принципа Open Source First',
    viewOnGithub: 'Смотреть на GitHub',
    switchToLight: 'Переключить на светлую тему',
    switchToDark: 'Переключить на тёмную тему',
    appDownload: 'Скачать приложение',
    downloadDescription: 'Скачайте последнюю версию для вашего устройства',
    android: 'Android',
    ios: 'iOS',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    apk: 'APK',
    appStore: 'App Store',
    playStore: 'Play Store',
    testFlight: 'TestFlight',
    universal: 'Universal',
    dmg: 'DMG',
    installer: 'Installer',
    zip: 'Zip',
    iosRequirement: 'iOS 16+',
    macosRequirement: 'macOS 15+',
    windowsRequirement: 'Win10+ (x64)',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: 'История изменений',
    changelogDescription: 'История обновлений версий приложения',
    feature: 'Новое',
    fix: 'Исправление',
    improvement: 'Улучшение',
    breaking: 'Критическое',
    darkModeSupport: 'Добавлена поддержка тёмной темы',
    macosUniversal: 'Поддержка macOS Universal пакета',
    uiOptimization: 'Оптимизирован UI страницы загрузки',
    windowsCrashFix: 'Исправлен сбой при запуске в Windows',
    linuxSupport: 'Добавлена поддержка Linux x86_64',
    windowsSupport: 'Добавлена поддержка Windows x86_64',
    startupSpeedUp: 'Улучшена скорость запуска',
    iosNotificationFix: 'Исправлена проблема с уведомлениями iOS',
    initialRelease: 'Первый релиз',
    androidIosSupport: 'Поддержка платформ Android и iOS',
    macosSupport: 'Поддержка платформы macOS',
  },
};

export function getTranslations(locale: Locale): Translations {
  return translations[locale] || translations.en;
}

export default translations;
