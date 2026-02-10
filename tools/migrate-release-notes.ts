import * as fs from 'fs/promises'
import * as path from 'path'

interface MigrationResult {
  sourceFile: string
  buildNumber: number | null
  version: string | null
  targetFile: string
  success: boolean
  error?: string
}

/**
 * Parse version and build number from the first line of a markdown file
 */
function parseVersionAndBuild(firstLine: string): {
  version: string | null
  buildNumber: number | null
} {
  // Pattern 1: RWKV Chat 3.5.0(build 631) 版本已发布
  // Pattern 2: RWKV Chat 1.7.0(430) 版本已发布 (no "build" keyword)
  // Pattern 3: 🚀 RWKV Chat 1.6.1(411) 版本已发布 (with emoji)

  const patterns = [
    /RWKV Chat (\d+\.\d+\.\d+)(?:\(build (\d+)\)|\((\d+)\))/,
    /🚀 RWKV Chat (\d+\.\d+\.\d+)\((\d+)\)/
  ]

  for (const pattern of patterns) {
    const match = firstLine.match(pattern)
    if (match) {
      const version = match[1]
      // match[2] is build number with "build" keyword, match[3] is without
      const buildNumber = match[2]
        ? parseInt(match[2], 10)
        : parseInt(match[3] || match[2] || '0', 10)
      if (version && !isNaN(buildNumber) && buildNumber > 0) {
        return { version, buildNumber }
      }
    }
  }

  return { version: null, buildNumber: null }
}

/**
 * Migrate release notes files from journal directory to backend/data/release-notes
 */
async function migrateReleaseNotes() {
  const journalDirs = [
    '/Users/wangce/docs/repo/journal/2025/rwkv/chat',
    '/Users/wangce/docs/repo/journal/2026/rwkv'
  ]

  const targetDir = path.join(__dirname, '../backend/data/release-notes')

  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true })

  const results: MigrationResult[] = []
  const buildNumberMap = new Map<number, string[]>() // Track duplicate build numbers

  console.log('Starting migration...\n')

  // Process all journal directories
  for (const journalDir of journalDirs) {
    try {
      const files = await fs.readdir(journalDir)
      const mdFiles = files.filter(
        (f) => f.endsWith('.md') && !f.includes('copy')
      )

      console.log(`Processing ${mdFiles.length} files from ${journalDir}`)

      for (const file of mdFiles) {
        const sourcePath = path.join(journalDir, file)
        const result: MigrationResult = {
          sourceFile: sourcePath,
          buildNumber: null,
          version: null,
          targetFile: '',
          success: false
        }

        try {
          // Read first line to parse version and build number
          const content = await fs.readFile(sourcePath, 'utf-8')
          const firstLine = content.split('\n')[0]

          const { version, buildNumber } = parseVersionAndBuild(firstLine)

          if (!version || !buildNumber) {
            result.error = `Failed to parse version or build number from: ${firstLine}`
            results.push(result)
            console.log(`⚠️  Skipping ${file}: ${result.error}`)
            continue
          }

          // Check for duplicate build numbers
          if (buildNumberMap.has(buildNumber)) {
            const existingVersions = buildNumberMap.get(buildNumber)!
            existingVersions.push(version)
            result.error = `Duplicate build number ${buildNumber} found. Existing versions: ${existingVersions.join(', ')}`
            console.log(`⚠️  ${file}: ${result.error}`)
          } else {
            buildNumberMap.set(buildNumber, [version])
          }

          // Create target filename: {buildNumber}-{version}.md
          const targetFileName = `${buildNumber}-${version}.md`
          const targetPath = path.join(targetDir, targetFileName)

          // Check if target file already exists
          try {
            await fs.access(targetPath)
            result.error = `Target file already exists: ${targetFileName}`
            console.log(`⚠️  ${file}: ${result.error}`)
          } catch {
            // File doesn't exist, proceed with copy
            await fs.copyFile(sourcePath, targetPath)

            result.buildNumber = buildNumber
            result.version = version
            result.targetFile = targetPath
            result.success = true

            console.log(
              `✅ ${file} -> ${targetFileName} (build ${buildNumber}, version ${version})`
            )
          }

          results.push(result)
        } catch (error: unknown) {
          result.error =
            error instanceof Error ? error.message : 'Unknown error'
          results.push(result)
          console.log(`❌ Error processing ${file}: ${result.error}`)
        }
      }
    } catch (error: unknown) {
      console.error(`Error reading directory ${journalDir}:`, error)
    }
  }

  // Generate migration report
  console.log('\n' + '='.repeat(60))
  console.log('Migration Report')
  console.log('='.repeat(60))

  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)
  const duplicates = results.filter((r) => r.error?.includes('Duplicate'))

  console.log(`\nTotal files processed: ${results.length}`)
  console.log(`✅ Successfully migrated: ${successful.length}`)
  console.log(`❌ Failed: ${failed.length}`)
  console.log(`⚠️  Duplicates: ${duplicates.length}`)

  if (duplicates.length > 0) {
    console.log('\nDuplicate build numbers:')
    for (const dup of duplicates) {
      console.log(`  - ${dup.sourceFile}: ${dup.error}`)
    }
  }

  if (failed.length > 0 && failed.length !== duplicates.length) {
    console.log('\nFailed migrations:')
    for (const fail of failed.filter((r) => !r.error?.includes('Duplicate'))) {
      console.log(`  - ${fail.sourceFile}: ${fail.error}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Migration completed!')
  console.log('='.repeat(60))
}

// Run migration
migrateReleaseNotes().catch(console.error)
