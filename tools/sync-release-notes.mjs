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
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [新增] 在 Android 設備上新增了對 MediaTek Dimensity 9500 晶片的支援',
  },
  en: {
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [New] Added support for the MediaTek Dimensity 9500 chip on Android devices',
  },
  ja: {
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [新規] Android デバイスで MediaTek Dimensity 9500 チップに対応しました',
  },
  ko: {
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [신규] Android 기기에서 MediaTek Dimensity 9500 칩 지원을 추가했습니다',
  },
  ru: {
    '- [新增] 在安卓设备上添加了对 mediatek dimensity 9500 芯片的支持':
      '- [Новое] Добавлена поддержка чипа MediaTek Dimensity 9500 на Android-устройствах',
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
