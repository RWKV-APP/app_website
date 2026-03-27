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
  chinaDownloadRecommendation: string;
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

  // Release Notes page
  releaseNotes: string;
  releaseNotesDescription: string;

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

  // Eval page
  evalBrowserTitle: string;
  evalBackToDownload: string;
  evalUploadAdmin: string;
  evalSelectEvaluation: string;
  evalCurrentEvaluation: string;
  evalResponseModel: string;
  evalJudgeModel: string;
  evalAvgScore: string;
  evalTotalQuestions: string;
  evalSort: string;
  evalSortDescending: string;
  evalSortAscending: string;
  evalThreshold: string;
  evalLoading: string;
  evalLoadingEvaluation: string;
  evalLoadingSamples: string;
  evalNoSamples: string;
  evalBelowNotRecommended: string;
  evalAboveNotRecommended: string;
  evalWeighted: string;
  evalRelevance: string;
  evalQuality: string;
  evalFluency: string;
  evalSatisfaction: string;
  evalResponse: string;
  evalChars: string;
  evalTitleHint: string;
  evalScoringFormula: string;
  evalNoResponse: string;
  evalDistributionChart: string;
  evalLoadingResponses: string;
  evalRecommended: string;
  evalNotRecommended: string;
  evalChartThresholdLine: string;
}

const translations: Record<Locale, Translations> = {
  'zh-CN': {
    backToDownload: '← 返回下载页面',
    appName: 'RWKV Chat',
    appTagline: '让大模型触手可及',
    appDescription: '便携式、全平台的 RWKV 模型推理终端，基于 Flutter 与 C++ 高性能推理引擎',
    features: '核心特性',
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
    downloadNow: '立即下载',
    smartDownload: '立即下载',
    downloadForYourDevice: '为您的设备下载',
    downloadOtherPlatforms: '下载其他平台',
    chinaDownloadRecommendation: '推荐中国大陆地区的用户优先使用 AI FastLab 或 HF Mirror 下载',
    mobile: '移动端',
    mobileDesc: '随身携带的 AI 助手，支持语音对话、图片理解和实时问答',
    desktop: '桌面端',
    desktopDesc: '强大的桌面 AI 助手，处理文档、邮件、截图和屏幕上的所有内容',
    viewChangelog: '查看更新日志',
    openSource: '开源项目',
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
    windowsRequirement: 'Win10+',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '更新日志',
    changelogDescription: '查看应用的版本更新记录',
    feature: '新功能',
    fix: '修复',
    improvement: '优化',
    breaking: '破坏性变更',
    releaseNotes: '版本更新',
    releaseNotesDescription: '查看所有历史版本更新信息',
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
    evalBrowserTitle: 'RWKV 评测浏览器',
    evalBackToDownload: '返回下载页',
    evalUploadAdmin: '上传后台',
    evalSelectEvaluation: '选择评测',
    evalCurrentEvaluation: '当前评测',
    evalResponseModel: '回答模型',
    evalJudgeModel: '评分模型',
    evalAvgScore: '平均分',
    evalTotalQuestions: '总题目',
    evalSort: '排序',
    evalSortDescending: '分数: 高 → 低',
    evalSortAscending: '分数: 低 → 高',
    evalThreshold: '推荐阈值',
    evalLoading: '加载中...',
    evalLoadingEvaluation: '正在加载评测...',
    evalLoadingSamples: '正在加载样本...',
    evalNoSamples: '当前没有可展示的样本数据。',
    evalBelowNotRecommended: '以下为不推荐问题',
    evalAboveNotRecommended: '以上为不推荐问题',
    evalWeighted: '加权总分',
    evalRelevance: '切题度',
    evalQuality: '内容质量',
    evalFluency: '表达流畅',
    evalSatisfaction: '用户满意',
    evalResponse: '回答',
    evalChars: '字符数',
    evalTitleHint: '* 标题仅用于界面展示，非实际提交给模型的 Prompt',
    evalScoringFormula: '总分 = 切题度 × 0.20 + 内容质量 × 0.35 + 表达流畅 × 0.15 + 用户满意 × 0.30',
    evalNoResponse: '无回答',
    evalDistributionChart: '分数分布',
    evalLoadingResponses: '正在加载回答...',
    evalRecommended: '推荐',
    evalNotRecommended: '不推荐',
    evalChartThresholdLine: '推荐分界线',
  },
  'zh-TW': {
    backToDownload: '← 返回下載頁面',
    appName: 'RWKV Chat',
    appTagline: '讓大模型觸手可及',
    appDescription: '便攜式、全平台的 RWKV 模型推理終端，基於 Flutter 與 C++ 高性能推理引擎',
    features: '核心特性',
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
    downloadNow: '立即下載',
    smartDownload: '立即下載',
    downloadForYourDevice: '為您的裝置下載',
    downloadOtherPlatforms: '下載其他平台',
    chinaDownloadRecommendation: '推薦中國大陸地區的用戶優先使用 AI FastLab 或 HF Mirror 下載',
    mobile: '行動裝置',
    mobileDesc: '隨身攜帶的 AI 助手，支援語音對話、圖片理解和即時問答',
    desktop: '桌面端',
    desktopDesc: '強大的桌面 AI 助手，處理文件、郵件、截圖和螢幕上的所有內容',
    viewChangelog: '查看更新日誌',
    openSource: '開源項目',
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
    windowsRequirement: 'Win10+',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '更新日誌',
    changelogDescription: '查看應用的版本更新記錄',
    feature: '新功能',
    fix: '修復',
    improvement: '優化',
    breaking: '破壞性變更',
    releaseNotes: '版本更新',
    releaseNotesDescription: '查看所有歷史版本更新信息',
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
    evalBrowserTitle: 'RWKV 評測瀏覽器',
    evalBackToDownload: '返回下載頁',
    evalUploadAdmin: '上傳後台',
    evalSelectEvaluation: '選擇評測',
    evalCurrentEvaluation: '當前評測',
    evalResponseModel: '回答模型',
    evalJudgeModel: '評分模型',
    evalAvgScore: '平均分',
    evalTotalQuestions: '總題目',
    evalSort: '排序',
    evalSortDescending: '分數: 高 → 低',
    evalSortAscending: '分數: 低 → 高',
    evalThreshold: '推薦閾值',
    evalLoading: '載入中...',
    evalLoadingEvaluation: '正在載入評測...',
    evalLoadingSamples: '正在載入樣本...',
    evalNoSamples: '目前沒有可展示的樣本資料。',
    evalBelowNotRecommended: '以下為不推薦問題',
    evalAboveNotRecommended: '以上為不推薦問題',
    evalWeighted: '加權總分',
    evalRelevance: '切題度',
    evalQuality: '內容品質',
    evalFluency: '表達流暢',
    evalSatisfaction: '使用者滿意',
    evalResponse: '回答',
    evalChars: '字元數',
    evalTitleHint: '* 標題僅用於介面顯示，非實際提交給模型的 Prompt',
    evalScoringFormula: '總分 = 切題度 × 0.20 + 內容品質 × 0.35 + 表達流暢 × 0.15 + 使用者滿意 × 0.30',
    evalNoResponse: '無回答',
    evalDistributionChart: '分數分佈',
    evalLoadingResponses: '正在載入回答...',
    evalRecommended: '推薦',
    evalNotRecommended: '不推薦',
    evalChartThresholdLine: '推薦分界線',
  },
  ja: {
    backToDownload: '← ダウンロードページに戻る',
    appName: 'RWKV Chat',
    appTagline: 'AIをもっと身近に',
    appDescription: 'Flutter と C++ 高性能推論エンジンを融合したポータブルなRWKVモデル推論端末',
    features: '主な機能',
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
    downloadNow: '今すぐダウンロード',
    smartDownload: '今すぐダウンロード',
    downloadForYourDevice: 'お使いのデバイス用にダウンロード',
    downloadOtherPlatforms: '他のプラットフォームをダウンロード',
    chinaDownloadRecommendation: '',
    mobile: 'モバイル',
    mobileDesc: '持ち運べる AI アシスタント、音声対話、画像理解、リアルタイム質問対応',
    desktop: 'デスクトップ',
    desktopDesc:
      '強力なデスクトップ AI アシスタント、文書、メール、スクリーンショット、画面のあらゆる内容を処理',
    viewChangelog: '更新履歴を見る',
    openSource: 'オープンソース',
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
    windowsRequirement: 'Win10+',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '更新履歴',
    changelogDescription: 'アプリのバージョン更新履歴',
    feature: '新機能',
    fix: '修正',
    improvement: '改善',
    breaking: '破壊的変更',
    releaseNotes: 'リリースノート',
    releaseNotesDescription: 'すべての履歴バージョン更新情報を表示',
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
    evalBrowserTitle: 'RWKV 評価ブラウザ',
    evalBackToDownload: 'ダウンロードページへ',
    evalUploadAdmin: 'アップロード管理',
    evalSelectEvaluation: '評価を選択',
    evalCurrentEvaluation: '現在の評価',
    evalResponseModel: '回答モデル',
    evalJudgeModel: '評価モデル',
    evalAvgScore: '平均点',
    evalTotalQuestions: '問題数',
    evalSort: '並び替え',
    evalSortDescending: 'スコア: 高 → 低',
    evalSortAscending: 'スコア: 低 → 高',
    evalThreshold: '推奨閾値',
    evalLoading: '読み込み中...',
    evalLoadingEvaluation: '評価を読み込んでいます...',
    evalLoadingSamples: 'サンプルを読み込んでいます...',
    evalNoSamples: '表示できるサンプルデータがありません。',
    evalBelowNotRecommended: '以下は非推奨の問題です',
    evalAboveNotRecommended: '以上は非推奨の問題です',
    evalWeighted: '加重合計',
    evalRelevance: '関連性',
    evalQuality: '品質',
    evalFluency: '流暢性',
    evalSatisfaction: '満足度',
    evalResponse: '回答',
    evalChars: '文字数',
    evalTitleHint: '* タイトルはUI表示用であり、モデルに送信されるプロンプトではありません',
    evalScoringFormula: '総合点 = 関連性 × 0.20 + 品質 × 0.35 + 流暢性 × 0.15 + 満足度 × 0.30',
    evalNoResponse: '回答なし',
    evalDistributionChart: 'スコア分布',
    evalLoadingResponses: '回答を読み込んでいます...',
    evalRecommended: '推奨',
    evalNotRecommended: '非推奨',
    evalChartThresholdLine: '推奨ラインを超えるか否か',
  },
  ko: {
    backToDownload: '← 다운로드 페이지로 돌아가기',
    appName: 'RWKV Chat',
    appTagline: 'AI를 더 가까이',
    appDescription: 'Flutter와 C++ 고성능 추론 엔진을 결합한 휴대용 RWKV 모델 추론 터미널',
    features: '주요 기능',
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
    downloadNow: '지금 다운로드',
    smartDownload: '지금 다운로드',
    downloadForYourDevice: '기기에 맞게 다운로드',
    downloadOtherPlatforms: '다른 플랫폼 다운로드',
    chinaDownloadRecommendation: '',
    mobile: '모바일',
    mobileDesc: '휴대용 AI 어시스턴트, 음성 대화, 이미지 이해, 실시간 질문 응답',
    desktop: '데스크톱',
    desktopDesc: '강력한 데스크톱 AI 어시스턴트, 문서, 이메일, 스크린샷 및 화면의 모든 내용 처리',
    viewChangelog: '업데이트 내역 보기',
    openSource: '오픈소스',
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
    windowsRequirement: 'Win10+',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: '업데이트 내역',
    changelogDescription: '앱 버전 업데이트 기록',
    feature: '새 기능',
    fix: '수정',
    improvement: '개선',
    breaking: '주요 변경',
    releaseNotes: '릴리스 노트',
    releaseNotesDescription: '모든 이력 버전 업데이트 정보 보기',
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
    evalBrowserTitle: 'RWKV 평가 브라우저',
    evalBackToDownload: '다운로드 페이지로',
    evalUploadAdmin: '업로드 관리',
    evalSelectEvaluation: '평가 선택',
    evalCurrentEvaluation: '현재 평가',
    evalResponseModel: '응답 모델',
    evalJudgeModel: '평가 모델',
    evalAvgScore: '평균 점수',
    evalTotalQuestions: '총 문제 수',
    evalSort: '정렬',
    evalSortDescending: '점수: 높은 순',
    evalSortAscending: '점수: 낮은 순',
    evalThreshold: '추천 임계값',
    evalLoading: '로딩 중...',
    evalLoadingEvaluation: '평가를 불러오는 중...',
    evalLoadingSamples: '샘플을 불러오는 중...',
    evalNoSamples: '표시할 샘플 데이터가 없습니다.',
    evalBelowNotRecommended: '이하는 비추천 문제입니다',
    evalAboveNotRecommended: '이상은 비추천 문제입니다',
    evalWeighted: '가중 합계',
    evalRelevance: '관련성',
    evalQuality: '품질',
    evalFluency: '유창성',
    evalSatisfaction: '만족도',
    evalResponse: '응답',
    evalChars: '글자 수',
    evalTitleHint: '* 제목은 UI 표시용이며, 모델에 전송되는 프롬프트가 아닙니다',
    evalScoringFormula: '총점 = 관련성 × 0.20 + 품질 × 0.35 + 유창성 × 0.15 + 만족도 × 0.30',
    evalNoResponse: '응답 없음',
    evalDistributionChart: '점수 분포',
    evalLoadingResponses: '응답 불러오는 중...',
    evalRecommended: '추천',
    evalNotRecommended: '비추천',
    evalChartThresholdLine: '추천 기준선',
  },
  en: {
    backToDownload: '← Back to Download',
    appName: 'RWKV Chat',
    appTagline: 'AI at Your Fingertips',
    appDescription:
      'Portable, cross-platform RWKV model inference terminal powered by Flutter and C++ high-performance engine',
    features: 'Key Features',
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
    downloadNow: 'Download Now',
    smartDownload: 'Download',
    downloadForYourDevice: 'Download for your device',
    downloadOtherPlatforms: 'Download for other platforms',
    chinaDownloadRecommendation: '',
    mobile: 'Mobile',
    mobileDesc:
      'Your portable AI assistant with voice conversations, image understanding, and real-time Q&A',
    desktop: 'Desktop',
    desktopDesc:
      'Powerful desktop AI assistant that handles documents, emails, screenshots, and everything on your screen',
    viewChangelog: 'View Changelog',
    openSource: 'Open Source',
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
    windowsRequirement: 'Win10+',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: 'Changelog',
    changelogDescription: 'View app version update history',
    feature: 'Feature',
    fix: 'Fix',
    improvement: 'Improvement',
    breaking: 'Breaking',
    releaseNotes: 'Release Notes',
    releaseNotesDescription: 'View all historical release notes',
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
    evalBrowserTitle: 'RWKV Evaluation Browser',
    evalBackToDownload: 'Back to Downloads',
    evalUploadAdmin: 'Upload Admin',
    evalSelectEvaluation: 'Select evaluation',
    evalCurrentEvaluation: 'Current evaluation',
    evalResponseModel: 'Response model',
    evalJudgeModel: 'Judge model',
    evalAvgScore: 'Avg score',
    evalTotalQuestions: 'Questions',
    evalSort: 'Sort',
    evalSortDescending: 'Score: High → Low',
    evalSortAscending: 'Score: Low → High',
    evalThreshold: 'Threshold',
    evalLoading: 'Loading...',
    evalLoadingEvaluation: 'Loading evaluation...',
    evalLoadingSamples: 'Loading samples...',
    evalNoSamples: 'No sample data available.',
    evalBelowNotRecommended: 'Below: not recommended',
    evalAboveNotRecommended: 'Above: not recommended',
    evalWeighted: 'Weighted',
    evalRelevance: 'Relevance',
    evalQuality: 'Quality',
    evalFluency: 'Fluency',
    evalSatisfaction: 'Satisfaction',
    evalResponse: 'Response',
    evalChars: 'Characters',
    evalTitleHint: '* Title is for display only — not the actual prompt sent to the model',
    evalScoringFormula: 'Score = Relevance × 0.20 + Quality × 0.35 + Fluency × 0.15 + Satisfaction × 0.30',
    evalNoResponse: 'No response',
    evalDistributionChart: 'Score Distribution',
    evalLoadingResponses: 'Loading responses...',
    evalRecommended: 'Recommended',
    evalNotRecommended: 'Not Recommended',
    evalChartThresholdLine: 'Recommendation threshold',
  },
  ru: {
    backToDownload: '← Вернуться к загрузке',
    appName: 'RWKV Chat',
    appTagline: 'ИИ под рукой',
    appDescription:
      'Портативный кроссплатформенный терминал для вывода моделей RWKV на базе Flutter и C++',
    features: 'Ключевые функции',
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
    downloadNow: 'Скачать сейчас',
    smartDownload: 'Скачать',
    downloadForYourDevice: 'Скачать для вашего устройства',
    downloadOtherPlatforms: 'Скачать для других платформ',
    chinaDownloadRecommendation: '',
    mobile: 'Мобильные',
    mobileDesc:
      'Портативный AI-ассистент с голосовыми диалогами, пониманием изображений и ответами в реальном времени',
    desktop: 'Десктоп',
    desktopDesc:
      'Мощный настольный AI-ассистент для работы с документами, письмами, скриншотами и всем содержимым экрана',
    viewChangelog: 'История изменений',
    openSource: 'Открытый код',
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
    windowsRequirement: 'Win10+',
    linuxRequirement: 'x86_64',
    androidRequirement: 'APK',
    changelog: 'История изменений',
    changelogDescription: 'История обновлений версий приложения',
    feature: 'Новое',
    fix: 'Исправление',
    improvement: 'Улучшение',
    breaking: 'Критическое',
    releaseNotes: 'Примечания к выпуску',
    releaseNotesDescription: 'Просмотр всех исторических примечаний к выпуску',
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
    evalBrowserTitle: 'Обозреватель оценок RWKV',
    evalBackToDownload: 'К загрузкам',
    evalUploadAdmin: 'Загрузка',
    evalSelectEvaluation: 'Выбрать оценку',
    evalCurrentEvaluation: 'Текущая оценка',
    evalResponseModel: 'Модель ответов',
    evalJudgeModel: 'Модель оценки',
    evalAvgScore: 'Средний балл',
    evalTotalQuestions: 'Вопросов',
    evalSort: 'Сортировка',
    evalSortDescending: 'Балл: от высокого к низкому',
    evalSortAscending: 'Балл: от низкого к высокому',
    evalThreshold: 'Порог',
    evalLoading: 'Загрузка...',
    evalLoadingEvaluation: 'Загрузка оценки...',
    evalLoadingSamples: 'Загрузка образцов...',
    evalNoSamples: 'Нет данных для отображения.',
    evalBelowNotRecommended: 'Ниже — не рекомендуется',
    evalAboveNotRecommended: 'Выше — не рекомендуется',
    evalWeighted: 'Взвешенный',
    evalRelevance: 'Релевантность',
    evalQuality: 'Качество',
    evalFluency: 'Беглость',
    evalSatisfaction: 'Удовлетворённость',
    evalResponse: 'Ответ',
    evalChars: 'Символов',
    evalTitleHint: '* Заголовок только для отображения — не является промптом, отправленным модели',
    evalScoringFormula: 'Балл = Релевантность × 0.20 + Качество × 0.35 + Беглость × 0.15 + Удовлетворённость × 0.30',
    evalNoResponse: 'Нет ответа',
    evalDistributionChart: 'Распределение баллов',
    evalLoadingResponses: 'Загрузка ответов...',
    evalRecommended: 'Рекомендуется',
    evalNotRecommended: 'Не рекомендуется',
    evalChartThresholdLine: 'Порог рекомендации',
  },
};

export function getTranslations(locale: Locale): Translations {
  return translations[locale] || translations.en;
}

export default translations;
