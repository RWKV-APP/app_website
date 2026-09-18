import { TELEMETRY_CHIP_REGISTRY } from './telemetry-chip-registry'

// Derived compatibility/search view: chip facts are maintained only in the registry.
export const TELEMETRY_SOC_ALIASES: Record<string, readonly string[]> =
  Object.fromEntries(
    TELEMETRY_CHIP_REGISTRY.map((chip) => [chip.name, chip.aliases ?? []])
  )

function aliasKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}

function platformKey(value: string): string {
  return aliasKey(value).replace(
    /^(?:qualcomm|mediatek)(?=(?:sm|sdm|qcm|mt)\d{4})/,
    ''
  )
}

const aliases = new Map<string, string>()
const devices = new Map<string, string>()
for (const chip of TELEMETRY_CHIP_REGISTRY) {
  for (const value of [chip.name, ...(chip.aliases ?? [])]) {
    aliases.set(platformKey(value), chip.name)
  }
  for (const rule of chip.devices ?? []) {
    for (const model of rule.models) {
      for (const platform of rule.platforms) {
        devices.set(`${platformKey(platform)}:${aliasKey(model)}`, chip.name)
      }
    }
  }
}

/** A registered consumer identity, as opposed to a readable but unresolved code. */
export function resolveRegisteredTelemetrySocName(
  value?: string | null
): string | null {
  return value ? (aliases.get(platformKey(value)) ?? null) : null
}

/** Exact platform + exact device. Never infer from a numeric prefix or a similar model. */
export function resolveTelemetryDeviceSoc(
  socName?: string | null,
  deviceModel?: string | null
): string | null {
  if (!socName || !deviceModel) return null
  return devices.get(`${platformKey(socName)}:${aliasKey(deviceModel)}`) ?? null
}

export function resolveTelemetrySocName(value?: string | null): string | null {
  if (!value) return null
  const name = value.trim().replace(/\s+/g, ' ')
  const key = aliasKey(name)
  const mapped = resolveRegisteredTelemetrySocName(name)
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
