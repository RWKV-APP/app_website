// Identity aliases are shared by aggregation, drilldown and saved UI filters.
// Only unambiguous part numbers belong here; see docs/telemetry-soc-names.md.
export const TELEMETRY_SOC_ALIASES: Record<string, readonly string[]> = {
  'Snapdragon 4 Gen 1': ['SM4375'],
  'Snapdragon 6 Gen 3': ['SM6475', 'SM6475-AB'],
  'Snapdragon 710': ['SDM710'],
  'Snapdragon 670': ['SDM670'],
  'Snapdragon 7 Gen 3': ['SM7550', 'SM7550-AB'],
  'Snapdragon 6 Gen 1': ['SM6450'],
  'Snapdragon 7+ Gen 2': ['SM7475', 'SM7475-AB'],
  'Snapdragon 720G': ['SM7125'],
  'Snapdragon 7 Gen 4': ['SM7750', 'SM7750-AB'],
  'Snapdragon 460': ['SM4250', 'SM4250-AA'],
  'Snapdragon 8 Gen 3': ['SM8650'],
  'Snapdragon 4s Gen 2': ['SM4635'],
  'Snapdragon 7+ Gen 3': ['SM7675', 'SM7675-AB'],
  'Snapdragon 845': ['SDM845'],
  'Snapdragon 7 Gen 1': ['SM7450'],
  'Snapdragon 7s Gen 2': ['SM7435', 'SM7435-AB'],
  'Snapdragon 750G 5G': ['SM7225'],
  'Qualcomm Dragonwing QCM6490': ['QCM6490'],
  'Snapdragon 888': ['888'],
  'MediaTek Dimensity 800': ['MT6873', 'MediaTek Dimensity 800 5G'],
  'MediaTek Helio G96': ['MT6781'],
  'Google Tensor': ['pixel6', 'pixel6a', 'pixel6pro'],
  'Google Tensor G2': ['pixel7', 'pixel7a', 'pixel7pro', 'pixelseven'],
  'Google Tensor G3': ['pixel8', 'pixel8a', 'pixel8pro'],
  'Google Tensor G4': [
    'pixel9',
    'pixel9a',
    'pixel9pro',
    'pixel9proxl',
    'pixel10a'
  ],
  'Google Tensor G5': ['pixel10', 'pixel10pro', 'pixel10proxl'],
  'AMD Ryzen 7 7840HS w/ Radeon 780M Graphics': [
    'amd ryzen 7 7840hs with radeon 780m graphics'
  ]
}

function aliasKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}

const aliases = new Map(
  Object.entries(TELEMETRY_SOC_ALIASES).flatMap(([name, values]) =>
    [name, ...values].map((value) => [aliasKey(value), name] as const)
  )
)

export function resolveTelemetrySocName(value?: string | null): string | null {
  if (!value) return null
  const name = value.trim().replace(/\s+/g, ' ')
  const key = aliasKey(name)
  const mapped =
    aliases.get(key) ??
    aliases.get(
      key.replace(/^(?:qualcomm|mediatek)(?=(?:sm|sdm|qcm|mt)\d{4})/, '')
    )
  if (mapped) return mapped

  // Expand spelling only: s, +, Elite and generation remain distinct identities.
  const snapdragon = key.replace(/^(?:qualcomm)?snapdragon/, '')
  if (snapdragon === 'xelite') return 'Snapdragon X Elite'
  if (snapdragon === 'x2eliteextreme') return 'Snapdragon X2 Elite Extreme'
  let match = snapdragon.match(/^(\d+)(s|\+)?gen(\d+)$/)
  if (match) return `Snapdragon ${match[1]}${match[2] ?? ''} Gen ${match[3]}`
  match = snapdragon.match(/^(\d+)elite(?:gen(\d+))?$/)
  if (match)
    return `Snapdragon ${match[1]} Elite${match[2] ? ` Gen ${match[2]}` : ''}`
  match = key.match(/^(?:qualcomm)?snapdragon(\d+[g+]?)(?:$)/)
  if (match) return `Snapdragon ${match[1].toUpperCase()}`
  match = key.match(
    /^(?:mediatek)?(dimensity|helio)([a-z]?\d+)(\+|ultra|ultimate|energy)?$/
  )
  if (match) {
    const family = match[1] === 'dimensity' ? 'Dimensity' : 'Helio'
    const suffix =
      match[3] === '+'
        ? '+'
        : match[3]
          ? ` ${match[3][0].toUpperCase()}${match[3].slice(1)}`
          : ''
    return `MediaTek ${family} ${match[2].toUpperCase()}${suffix}`
  }
  match = key.match(/^(?:huawei)?kirin(\d+[a-z]?)(5g)?$/)
  if (match) return `Kirin ${match[1].toUpperCase()}${match[2] ? ' 5G' : ''}`
  match = key.match(/^(?:samsung)?exynos(\d+)$/)
  if (match) return `Exynos ${match[1]}`
  match = key.match(/^(?:google)?tensor(g\d+)?$/)
  if (match)
    return `Google Tensor${match[1] ? ` ${match[1].toUpperCase()}` : ''}`
  match = key.match(/^apple(m\d+)(pro|max|ultra)?$/)
  if (match)
    return `Apple ${match[1].toUpperCase()}${match[2] ? ` ${match[2][0].toUpperCase()}${match[2].slice(1)}` : ''}`

  // Unknown/shared part numbers retain the complete code and a readable vendor.
  // Never strip a revision or infer one of several retail chips from its base part.
  match = name.match(/^(?:Qualcomm\s+)?((?:SM|SDM|QCM)\d{4}(?:-[A-Z0-9]+)*)$/i)
  if (match) return `Qualcomm ${match[1].toUpperCase()}`
  match = name.match(/^(?:MediaTek\s+)?(MT\d{4}(?:[A-Z]|-[A-Z0-9]+)*)$/i)
  if (match) return `MediaTek ${match[1].toUpperCase()}`
  return null
}

export function normalizeTelemetrySocName(value: string): string {
  return resolveTelemetrySocName(value) ?? value.trim()
}

export function telemetrySocSearchText(value: string): string {
  const canonical = normalizeTelemetrySocName(value)
  return [
    value,
    canonical,
    aliasKey(canonical),
    ...(TELEMETRY_SOC_ALIASES[canonical] ?? [])
  ].join(' ')
}

// Device-specific evidence can disambiguate a generic *_soc report, but never
// turns that generic report into a global alias for one chip generation.
export function resolveTelemetryPixelSoc(
  deviceModel?: string | null
): string | null {
  const key = aliasKey(deviceModel ?? '').replace(/^google/, '')
  return key.startsWith('pixel') ? (aliases.get(key) ?? null) : null
}
