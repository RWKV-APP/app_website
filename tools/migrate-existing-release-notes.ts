import * as fs from 'fs/promises';
import * as path from 'path';

interface MigrationResult {
  sourceFile: string;
  buildNumber: number | null;
  version: string | null;
  targetFile: string;
  success: boolean;
  error?: string;
}

/**
 * Parse version and build number from the first line of a markdown file
 */
function parseVersionAndBuild(firstLine: string): {
  version: string | null;
  buildNumber: number | null;
} {
  // Pattern 1: RWKV Chat 3.5.0(build 631) 版本已发布
  // Pattern 2: RWKV Chat 1.7.0(430) 版本已发布 (no "build" keyword)
  // Pattern 3: 🚀 RWKV Chat 1.6.1(411) 版本已发布 (with emoji)
  
  const patterns = [
    /RWKV Chat (\d+\.\d+\.\d+)(?:\(build (\d+)\)|\((\d+)\))/,
    /🚀 RWKV Chat (\d+\.\d+\.\d+)\((\d+)\)/,
    // Handle cases like "RWKV Chat 2.3.0(517 520)" - use the first number
    /RWKV Chat (\d+\.\d+\.\d+)\((\d+)\s+\d+\)/,
  ];

  for (const pattern of patterns) {
    const match = firstLine.match(pattern);
    if (match) {
      const version = match[1];
      // match[2] is build number with "build" keyword, match[3] is without
      const buildNumber = match[2] ? parseInt(match[2], 10) : parseInt(match[3] || match[2] || '0', 10);
      if (version && !isNaN(buildNumber) && buildNumber > 0) {
        return { version, buildNumber };
      }
    }
  }

  return { version: null, buildNumber: null };
}

/**
 * Migrate existing release notes files in backend/data/release-notes to new format
 */
async function migrateExistingReleaseNotes() {
  // Get the project root (assuming script is in tools/ directory)
  const projectRoot = path.resolve(process.cwd());
  const sourceDir = path.join(projectRoot, 'backend/data/release-notes');
  
  const results: MigrationResult[] = [];
  const buildNumberMap = new Map<number, string[]>(); // Track duplicate build numbers
  
  console.log('Starting migration of existing release notes...\n');
  console.log(`Source directory: ${sourceDir}\n`);
  
  try {
    const files = await fs.readdir(sourceDir);
    // Filter out .gitkeep and files that are already in new format (buildNumber-version.md)
    const oldFormatFiles = files.filter(f => {
      if (f === '.gitkeep') return false;
      // Check if file is already in new format
      const newFormatMatch = f.match(/^\d+-\d+\.\d+\.\d+\.md$/);
      return !newFormatMatch;
    });
    
    console.log(`Found ${oldFormatFiles.length} files to migrate\n`);
    
    for (const file of oldFormatFiles) {
      const sourcePath = path.join(sourceDir, file);
      const result: MigrationResult = {
        sourceFile: sourcePath,
        buildNumber: null,
        version: null,
        targetFile: '',
        success: false,
      };
      
      try {
        // Read content and find the line with version info
        const content = await fs.readFile(sourcePath, 'utf-8');
        const lines = content.split('\n');
        
        // Try to find the line with version info (skip empty lines and non-version lines)
        let versionLine = '';
        for (const line of lines) {
          if (line.includes('RWKV Chat') || line.includes('版本已发布')) {
            versionLine = line;
            break;
          }
        }
        
        // If no version line found, try first non-empty line
        if (!versionLine) {
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('大家好') && !trimmed.startsWith('Z大家好')) {
              versionLine = line;
              break;
            }
          }
        }
        
        const { version, buildNumber } = parseVersionAndBuild(versionLine);
        
        if (!version || !buildNumber) {
          result.error = `Failed to parse version or build number from: ${versionLine || 'empty file'}`;
          results.push(result);
          console.log(`⚠️  Skipping ${file}: ${result.error}`);
          continue;
        }
        
        // Check for duplicate build numbers
        if (buildNumberMap.has(buildNumber)) {
          const existingVersions = buildNumberMap.get(buildNumber)!;
          existingVersions.push(version);
          result.error = `Duplicate build number ${buildNumber} found. Existing versions: ${existingVersions.join(', ')}`;
          console.log(`⚠️  ${file}: ${result.error}`);
        } else {
          buildNumberMap.set(buildNumber, [version]);
        }
        
        // Create target filename: {buildNumber}-{version}.md
        const targetFileName = `${buildNumber}-${version}.md`;
        const targetPath = path.join(sourceDir, targetFileName);
        
        // Check if target file already exists
        try {
          await fs.access(targetPath);
          result.error = `Target file already exists: ${targetFileName}`;
          console.log(`⚠️  ${file}: ${result.error}`);
        } catch {
          // File doesn't exist, proceed with rename
          await fs.rename(sourcePath, targetPath);
          
          result.buildNumber = buildNumber;
          result.version = version;
          result.targetFile = targetPath;
          result.success = true;
          
          console.log(`✅ ${file} -> ${targetFileName} (build ${buildNumber}, version ${version})`);
        }
        
        results.push(result);
      } catch (error: unknown) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        results.push(result);
        console.log(`❌ Error processing ${file}: ${result.error}`);
      }
    }
  } catch (error: unknown) {
    console.error(`Error reading directory ${sourceDir}:`, error);
  }
  
  // Generate migration report
  console.log('\n' + '='.repeat(60));
  console.log('Migration Report');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const duplicates = results.filter(r => r.error?.includes('Duplicate'));
  
  console.log(`\nTotal files processed: ${results.length}`);
  console.log(`✅ Successfully migrated: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⚠️  Duplicates: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log('\nDuplicate build numbers:');
    for (const dup of duplicates) {
      console.log(`  - ${dup.sourceFile}: ${dup.error}`);
    }
  }
  
  if (failed.length > 0 && failed.length !== duplicates.length) {
    console.log('\nFailed migrations:');
    for (const fail of failed.filter(r => !r.error?.includes('Duplicate'))) {
      console.log(`  - ${fail.sourceFile}: ${fail.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Migration completed!');
  console.log('='.repeat(60));
}

// Run migration
migrateExistingReleaseNotes().catch(console.error);
