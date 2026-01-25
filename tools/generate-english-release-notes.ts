import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Script to generate English versions of Chinese release notes
 * This script reads all Chinese release notes and creates English versions
 *
 * Usage: ts-node tools/generate-english-release-notes.ts
 */

interface ReleaseNoteContent {
  title: string
  updates: string[]
  downloadSection: string
  linksSection: string
}

function parseChineseReleaseNote(content: string): ReleaseNoteContent {
  const lines = content.split('\n').filter((line) => line.trim())

  const title = lines[0] || ''
  const updates: string[] = []
  let downloadSection = ''
  let linksSection = ''

  let currentSection = ''

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.includes('最近更新') || line.includes('🔄')) {
      currentSection = 'updates'
      continue
    }

    if (line.includes('客户端下载') || line.includes('⬇️')) {
      currentSection = 'download'
      continue
    }

    if (line.includes('开源代码') || line.includes('🔗')) {
      currentSection = 'links'
      continue
    }

    if (currentSection === 'updates' && line.trim().startsWith('-')) {
      updates.push(line.trim())
    } else if (currentSection === 'download') {
      downloadSection += line + '\n'
    } else if (currentSection === 'links') {
      linksSection += line + '\n'
    }
  }

  return { title, updates, downloadSection, linksSection }
}

function translateToEnglish(
  chineseContent: ReleaseNoteContent,
  version: string
): string {
  // Extract version from title if not provided
  const versionMatch = chineseContent.title.match(/(\d+\.\d+\.\d+)/)
  const extractedVersion = versionMatch ? versionMatch[1] : version

  // Translate title
  let title = `RWKV Chat ${extractedVersion} Released`

  // Translate updates with better context understanding
  const translatedUpdates: string[] = []
  for (const update of chineseContent.updates) {
    let translated = update

    // Translate common patterns
    translated = translated.replace(/\[新增\]/g, '[New]')
    translated = translated.replace(/\[优化\]/g, '[Improved]')
    translated = translated.replace(/\[修复\]/g, '[Fixed]')

    // Translate common phrases with better context
    translated = translated.replace(
      /优化了图像问答的速度表现/g,
      'Optimized image Q&A performance'
    )
    translated = translated.replace(
      /新增古今回答模式/g,
      'Added ancient-modern answer mode'
    )
    translated = translated.replace(
      /添加了全新的 1\.5B 翻译模型/g,
      'Added new 1.5B translation model'
    )
    translated = translated.replace(
      /现在我们可以设置应用程序的字体了/g,
      'Now you can set the application font'
    )
    translated = translated.replace(
      /续写模式适配黑暗模式/g,
      'Continuation mode adapted to dark mode'
    )
    translated = translated.replace(
      /高通 NPU 加速新增 Snapdragon 8 \+ Gen 1 支持/g,
      'Qualcomm NPU acceleration: Added Snapdragon 8+ Gen 1 support'
    )
    translated = translated.replace(
      /提升了应用程序在高通骁龙芯片上的表现（模型需要重新下载）/g,
      'Improved app performance on Qualcomm Snapdragon chips (models need to be re-downloaded)'
    )
    translated = translated.replace(
      /调整了内部分用户界面的展示效果/g,
      'Adjusted internal UI display effects'
    )
    translated = translated.replace(
      /进行了若干性能优化/g,
      'Performed several performance optimizations'
    )
    translated = translated.replace(
      /修复可一个导致 batch 推理时 logits 互相污染的 bug/g,
      'Fixed a bug causing logits cross-contamination during batch inference'
    )

    // Generic translations for unmatched patterns
    translated = translated.replace(/优化了/g, 'Optimized ')
    translated = translated.replace(/新增/g, 'Added ')
    translated = translated.replace(/添加了/g, 'Added ')
    translated = translated.replace(/现在我们可以/g, 'Now you can ')
    translated = translated.replace(/适配/g, 'adapted to ')
    translated = translated.replace(/支持/g, 'support')
    translated = translated.replace(/提升了/g, 'Improved ')
    translated = translated.replace(/调整了/g, 'Adjusted ')
    translated = translated.replace(/进行了/g, 'Performed ')
    translated = translated.replace(/修复了/g, 'Fixed ')
    translated = translated.replace(/修复/g, 'Fixed ')
    translated = translated.replace(/导致/g, 'causing ')
    translated = translated.replace(/互相污染/g, 'cross-contamination')

    translatedUpdates.push(translated)
  }

  // Translate download section
  let downloadSection = chineseContent.downloadSection
    .replace(/客户端下载通道/g, 'Client Download Channels')
    .replace(/下载地址:/g, 'Download:')
    .replace(/Github Release:/g, 'GitHub Release:')

  // Translate links section
  let linksSection = chineseContent.linksSection
    .replace(/开源代码地址/g, 'Open Source Code')
    .replace(/Frontend：/g, 'Frontend: ')
    .replace(/Backend：/g, 'Backend: ')
    .replace(/Python：/g, 'Python: ')
    .replace(/权重文件地址：/g, 'Model Weights: ')
    .replace(
      /App 下载链接维护服务器与前端项目：/g,
      'App download link maintenance server and frontend project: '
    )

  // Build English content
  let englishContent = `${title}\n\n`
  englishContent += `🔄 Recent Updates\n\n`

  for (const update of translatedUpdates) {
    englishContent += `${update}\n`
  }

  englishContent += `\n⬇️ Client Download Channels\n\n`
  englishContent += downloadSection
  englishContent += `\n🔗 Open Source Code\n\n`
  englishContent += linksSection

  return englishContent.trim()
}

async function generateEnglishReleaseNotes() {
  const releaseNotesDir = path.join(__dirname, '../backend/data/release-notes')
  const files = await fs.readdir(releaseNotesDir)

  const chineseFiles = files.filter(
    (file) =>
      file.endsWith('.md') &&
      !file.includes('.en.md') &&
      !file.includes('.zh.md') &&
      file !== '.gitkeep'
  )

  console.log(`Found ${chineseFiles.length} Chinese release note files`)

  for (const file of chineseFiles) {
    const filePath = path.join(releaseNotesDir, file)
    const content = await fs.readFile(filePath, 'utf-8')

    // Extract version from filename: {build}-{version}.md
    const match = file.match(/^(\d+)-(.+)\.md$/)
    if (!match) {
      console.log(`Skipping ${file} - doesn't match expected format`)
      continue
    }

    const buildNumber = match[1]
    const version = match[2]

    // Check if English version already exists
    const englishFileName = `${buildNumber}-${version}.en.md`
    const englishFilePath = path.join(releaseNotesDir, englishFileName)

    try {
      await fs.access(englishFilePath)
      console.log(`English version already exists for ${file}, skipping...`)
      continue
    } catch {
      // File doesn't exist, proceed to create it
    }

    // Parse and translate
    const parsed = parseChineseReleaseNote(content)
    const englishContent = translateToEnglish(parsed, version)

    // Write English version
    await fs.writeFile(englishFilePath, englishContent, 'utf-8')
    console.log(`✅ Generated English version: ${englishFileName}`)
  }

  console.log('\n✅ All English release notes generated!')
}

// Run the script
generateEnglishReleaseNotes().catch(console.error)
