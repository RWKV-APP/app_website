#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const releaseNotesRoot = path.join(projectRoot, 'backend/data/release-notes');
const sourceLocale = 'zh-Hans';
const targetLocales = ['zh-Hant', 'en', 'ja', 'ko', 'ru'];

const manualTranslations = {
  'zh-Hant': {
    '- [新增] 新增 RWKV7-G1i 模型支持，可在 Android、iOS、macOS、Windows 和 Linux 上使用兼容模型':
      '- [新增] 新增 RWKV7-G1i 模型支援，可在 Android、iOS、macOS、Windows 和 Linux 上使用相容模型',
    '- [新增] 新增 primitive-bench 测试页面': '- [新增] 新增 primitive-bench 測試頁面',
    '- [优化] 优化 G1h 及更新模型的快速思考模式兼容性':
      '- [優化] 優化 G1h 及更新模型的快速思考模式相容性',
    '- [修复] 修复分享会话长图时顶部图标偶发缺失的问题':
      '- [修復] 修復分享會話長圖時頂部圖示偶爾缺失的問題',
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [新增] 在 Android 設備上新增了對 MediaTek Dimensity 9500 晶片的支援',
    '- [新增] 我们为 APP 添加了最新的权重': '- [新增] 我們為 APP 新增了最新的模型權重',
    '- [修复] 修复了推理过程中代码渲染失效的问题':
      '- [修復] 修復了推理過程中程式碼渲染失效的問題',
    '- [优化] 优化了 RWKV VL 模型的使用方式': '- [優化] 優化了 RWKV VL 模型的使用方式',
    '- [优化] 我们现在可以实时绘制表单内容了':
      '- [優化] 我們現在可以即時繪製表單內容了',
    '- [修复] 修复了部分特殊情况下，RWKV 回答渲染异常的问题':
      '- [修復] 修復了在部分特殊情況下 RWKV 回覆渲染異常的問題',
  },
  en: {
    '- [新增] 新增 RWKV7-G1i 模型支持，可在 Android、iOS、macOS、Windows 和 Linux 上使用兼容模型':
      '- [New] Added RWKV7-G1i model support, with compatible models available on Android, iOS, macOS, Windows, and Linux',
    '- [新增] 新增 primitive-bench 测试页面': '- [New] Added the primitive-bench test page',
    '- [优化] 优化 G1h 及更新模型的快速思考模式兼容性':
      '- [Improved] Improved fast-thinking mode compatibility for G1h and newer models',
    '- [修复] 修复分享会话长图时顶部图标偶发缺失的问题':
      '- [Fix] Fixed an issue where the top icon could occasionally be missing when sharing conversations as long images',
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [New] Added support for the MediaTek Dimensity 9500 chip on Android devices',
    '- [新增] 我们为 APP 添加了最新的权重': '- [New] Added the latest model weights to the app',
    '- [修复] 修复了推理过程中代码渲染失效的问题':
      '- [Fix] Fixed code rendering failures during inference',
    '- [优化] 优化了 RWKV VL 模型的使用方式':
      '- [Improved] Improved how RWKV VL models are used',
    '- [优化] 我们现在可以实时绘制表单内容了':
      '- [Improved] Forms can now be rendered in real time',
    '- [修复] 修复了部分特殊情况下，RWKV 回答渲染异常的问题':
      '- [Fix] Fixed RWKV response rendering issues in certain edge cases',
  },
  ja: {
    '- [新增] 新增 RWKV7-G1i 模型支持，可在 Android、iOS、macOS、Windows 和 Linux 上使用兼容模型':
      '- [新規] RWKV7-G1i モデルに対応し、Android、iOS、macOS、Windows、Linux で互換モデルを利用できるようになりました',
    '- [新增] 新增 primitive-bench 测试页面':
      '- [新規] primitive-bench テストページを追加しました',
    '- [优化] 优化 G1h 及更新模型的快速思考模式兼容性':
      '- [改善] G1h 以降のモデルにおける高速思考モードの互換性を改善しました',
    '- [修复] 修复分享会话长图时顶部图标偶发缺失的问题':
      '- [修正] 会話を長い画像として共有する際に上部のアイコンが表示されないことがある問題を修正しました',
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [新規] Android デバイスで MediaTek Dimensity 9500 チップに対応しました',
    '- [新增] 我们为 APP 添加了最新的权重':
      '- [新規] アプリに最新のモデルウェイトを追加しました',
    '- [修复] 修复了推理过程中代码渲染失效的问题':
      '- [修正] 推論中にコードが正しくレンダリングされない問題を修正しました',
    '- [优化] 优化了 RWKV VL 模型的使用方式':
      '- [改善] RWKV VL モデルの使用方法を改善しました',
    '- [优化] 我们现在可以实时绘制表单内容了':
      '- [改善] フォームの内容をリアルタイムで描画できるようになりました',
    '- [修复] 修复了部分特殊情况下，RWKV 回答渲染异常的问题':
      '- [修正] 一部の特殊な状況で RWKV の応答が正しくレンダリングされない問題を修正しました',
  },
  ko: {
    '- [新增] 新增 RWKV7-G1i 模型支持，可在 Android、iOS、macOS、Windows 和 Linux 上使用兼容模型':
      '- [신규] RWKV7-G1i 모델 지원을 추가하여 Android, iOS, macOS, Windows 및 Linux에서 호환 모델을 사용할 수 있습니다',
    '- [新增] 新增 primitive-bench 测试页面':
      '- [신규] primitive-bench 테스트 페이지를 추가했습니다',
    '- [优化] 优化 G1h 及更新模型的快速思考模式兼容性':
      '- [개선] G1h 및 이후 모델의 빠른 사고 모드 호환성을 개선했습니다',
    '- [修复] 修复分享会话长图时顶部图标偶发缺失的问题':
      '- [수정] 대화를 긴 이미지로 공유할 때 상단 아이콘이 간헐적으로 누락되는 문제를 수정했습니다',
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [신규] Android 기기에서 MediaTek Dimensity 9500 칩 지원을 추가했습니다',
    '- [新增] 我们为 APP 添加了最新的权重': '- [신규] 앱에 최신 모델 가중치를 추가했습니다',
    '- [修复] 修复了推理过程中代码渲染失效的问题':
      '- [수정] 추론 중 코드가 올바르게 렌더링되지 않는 문제를 수정했습니다',
    '- [优化] 优化了 RWKV VL 模型的使用方式':
      '- [개선] RWKV VL 모델 사용 방식을 개선했습니다',
    '- [优化] 我们现在可以实时绘制表单内容了':
      '- [개선] 이제 폼 내용을 실시간으로 렌더링할 수 있습니다',
    '- [修复] 修复了部分特殊情况下，RWKV 回答渲染异常的问题':
      '- [수정] 일부 특수한 상황에서 RWKV 응답이 비정상적으로 렌더링되는 문제를 수정했습니다',
  },
  ru: {
    '- [新增] 新增 RWKV7-G1i 模型支持，可在 Android、iOS、macOS、Windows 和 Linux 上使用兼容模型':
      '- [Новое] Добавлена поддержка моделей RWKV7-G1i: совместимые модели доступны на Android, iOS, macOS, Windows и Linux',
    '- [新增] 新增 primitive-bench 测试页面':
      '- [Новое] Добавлена тестовая страница primitive-bench',
    '- [优化] 优化 G1h 及更新模型的快速思考模式兼容性':
      '- [Улучшено] Улучшена совместимость режима быстрого мышления с G1h и более новыми моделями',
    '- [修复] 修复分享会话长图时顶部图标偶发缺失的问题':
      '- [Исправлено] Исправлена проблема, из-за которой при публикации диалога в виде длинного изображения иногда отсутствовал верхний значок',
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [Новое] Добавлена поддержка чипа MediaTek Dimensity 9500 на Android-устройствах',
    '- [新增] 我们为 APP 添加了最新的权重':
      '- [Новое] В приложение добавлены новейшие веса модели',
    '- [修复] 修复了推理过程中代码渲染失效的问题':
      '- [Исправлено] Исправлена ошибка отображения кода во время инференса',
    '- [优化] 优化了 RWKV VL 模型的使用方式':
      '- [Улучшено] Улучшен способ использования модели RWKV VL',
    '- [优化] 我们现在可以实时绘制表单内容了':
      '- [Улучшено] Добавлено отображение содержимого форм в реальном времени',
    '- [修复] 修复了部分特殊情况下，RWKV 回答渲染异常的问题':
      '- [Исправлено] Исправлено некорректное отображение ответов RWKV в некоторых особых случаях',
  },
};

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const printSource = args.has('--print-source');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function getReleaseFiles(locale) {
  const localeDir = path.join(releaseNotesRoot, locale);
  return fs
    .readdirSync(localeDir)
    .filter((name) => /^\d+-.+\.md$/.test(name))
    .sort((a, b) => {
      const buildA = Number(a.split('-', 1)[0]);
      const buildB = Number(b.split('-', 1)[0]);
      return buildA - buildB || a.localeCompare(b);
    });
}

function getLatestSourceFile() {
  const latest = getReleaseFiles(sourceLocale).at(-1);
  if (!latest) {
    throw new Error(`No release notes found in ${sourceLocale}`);
  }
  return latest;
}

function normalize(content) {
  return content.replace(/\r\n/g, '\n').replace(/\s+$/u, '') + '\n';
}

function extractBulletLines(content) {
  return normalize(content)
    .split('\n')
    .filter((line) => /^- \[[^\]]+\] .+/.test(line));
}

function buildTranslationMemory(locale) {
  const memory = new Map();
  for (const fileName of getReleaseFiles(sourceLocale)) {
    const sourcePath = path.join(releaseNotesRoot, sourceLocale, fileName);
    const targetPath = path.join(releaseNotesRoot, locale, fileName);
    if (!fs.existsSync(targetPath)) {
      continue;
    }

    const sourceBullets = extractBulletLines(readText(sourcePath));
    const targetBullets = extractBulletLines(readText(targetPath));
    const count = Math.min(sourceBullets.length, targetBullets.length);
    for (let index = 0; index < count; index += 1) {
      memory.set(sourceBullets[index], targetBullets[index]);
    }
  }

  for (const [sourceLine, targetLine] of Object.entries(manualTranslations[locale] || {})) {
    memory.set(sourceLine, targetLine);
  }

  return memory;
}

function renderLocale(sourceContent, locale) {
  const memory = buildTranslationMemory(locale);
  const missing = [];
  const rendered = normalize(sourceContent)
    .split('\n')
    .map((line) => {
      if (!/^- \[[^\]]+\] .+/.test(line)) {
        return line;
      }
      const translated = memory.get(line);
      if (!translated) {
        missing.push(line);
        return line;
      }
      return translated;
    })
    .join('\n');

  if (missing.length > 0) {
    const details = missing.map((line) => `  ${locale}: ${line}`).join('\n');
    throw new Error(`Missing release-note translations:\n${details}`);
  }

  return normalize(rendered);
}

function main() {
  const sourceFileName = getLatestSourceFile();
  if (printSource) {
    process.stdout.write(`${sourceFileName}\n`);
    return;
  }

  const sourcePath = path.join(releaseNotesRoot, sourceLocale, sourceFileName);
  const sourceContent = readText(sourcePath);
  const changed = [];

  for (const locale of targetLocales) {
    const targetPath = path.join(releaseNotesRoot, locale, sourceFileName);
    const rendered = renderLocale(sourceContent, locale);
    const current = fs.existsSync(targetPath) ? readText(targetPath) : '';
    if (normalize(current) !== rendered) {
      changed.push(path.relative(projectRoot, targetPath));
      if (!checkOnly) {
        writeText(targetPath, rendered);
      }
    }
  }

  if (checkOnly && changed.length > 0) {
    throw new Error(`Release notes are not synchronized:\n${changed.join('\n')}`);
  }

  console.log(`source=${path.relative(projectRoot, sourcePath)}`);
  if (changed.length > 0) {
    console.log(`${checkOnly ? 'out_of_sync' : 'updated'}=${changed.join(',')}`);
  } else {
    console.log('updated=');
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
