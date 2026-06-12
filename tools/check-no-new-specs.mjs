import { execFileSync } from 'node:child_process'

function gitLines(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const addedSpecFiles = new Set([
  ...gitLines(['diff', '--name-only', '--diff-filter=A', '--', '*.spec.ts']),
  ...gitLines([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=A',
    '--',
    '*.spec.ts'
  ]),
  ...gitLines(['ls-files', '--others', '--exclude-standard', '--', '*.spec.ts'])
])

if (addedSpecFiles.size > 0) {
  console.error('New *.spec.ts files are not allowed in this repository:')
  for (const filePath of [...addedSpecFiles].sort()) {
    console.error(`- ${filePath}`)
  }
  process.exit(1)
}
