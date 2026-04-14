import iosDevices, { isIOSDeviceString } from '@naverpay/device-info/ios';

export interface AppleDevicePresentation {
  identifier: string | null;
  modelName: string | null;
  socName: string | null;
}

const APPLE_SOC_BY_MODEL_NAME: Record<string, string> = {
  'iPhone 15': 'A16 Bionic',
  'iPhone 15 Plus': 'A16 Bionic',
  'iPhone 15 Pro': 'A17 Pro',
  'iPhone 15 Pro Max': 'A17 Pro',
  'iPhone 16': 'A18',
  'iPhone 16 Plus': 'A18',
  'iPhone 16 Pro': 'A18 Pro',
  'iPhone 16 Pro Max': 'A18 Pro',
  'iPhone 16e': 'A18',
  'iPhone 17': 'A19',
  'iPhone 17 Pro': 'A19 Pro',
  'iPhone 17 Pro Max': 'A19 Pro',
  'iPhone Air': 'A19 Pro',
};

const QUALCOMM_SOC_BY_PART_NUMBER: Record<string, string> = {
  SM7125: 'Snapdragon 720G',
  SM7635: 'Snapdragon 7s Gen 3',
  SM7750: 'Snapdragon 7 Gen 4',
};

function cleanOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeAppleDeviceIdentifier(value: string | null | undefined): string | null {
  const normalized = cleanOptionalString(value);
  if (!normalized) return null;

  const match = normalized.match(/^(iphone|ipad|ipod)(\d+,\d+)$/i);
  if (!match) return null;

  const prefix = match[1].toLowerCase();
  const canonicalPrefix = prefix === 'iphone' ? 'iPhone' : prefix === 'ipad' ? 'iPad' : 'iPod';
  return `${canonicalPrefix}${match[2]}`;
}

function resolveAppleMarketingName(value: string | null | undefined): string | null {
  const normalizedIdentifier = normalizeAppleDeviceIdentifier(value);
  if (normalizedIdentifier && isIOSDeviceString(normalizedIdentifier)) {
    return iosDevices[normalizedIdentifier];
  }

  const normalized = cleanOptionalString(value);
  if (!normalized) return null;
  if (/\b(iPhone|iPad|iPod)\b/i.test(normalized)) return normalized;
  return null;
}

function normalizeAndroidSocIdentifier(value: string | null | undefined): string | null {
  const normalized = cleanOptionalString(value);
  if (!normalized) return null;
  return normalized.toUpperCase().replace(/\s+/g, '');
}

export function summarizeHeaderDeviceModels(input: {
  deviceLabels?: Array<string | null | undefined> | null;
  fallbackDeviceModels?: Array<string | null | undefined> | null;
  limit?: number;
}): string | null {
  const values = (input.deviceLabels?.length ? input.deviceLabels : input.fallbackDeviceModels) ?? [];
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const label = cleanOptionalString(value);
    if (!label) continue;
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    labels.push(label);
  }

  if (labels.length === 0) return null;

  const limit = input.limit ?? 2;
  if (labels.length <= limit) return labels.join(' / ');
  return `${labels.slice(0, limit).join(' / ')} +${labels.length - limit}`;
}

export function resolveAndroidSocName(value: string | null | undefined): string | null {
  const normalizedIdentifier = normalizeAndroidSocIdentifier(value);
  if (!normalizedIdentifier) return null;
  const mappedPartNumber = QUALCOMM_SOC_BY_PART_NUMBER[normalizedIdentifier];
  if (mappedPartNumber) return mappedPartNumber;

  const compact = normalizedIdentifier.toLowerCase();
  const plusGenMatch = compact.match(/^(\d+)\+gen(\d+)$/);
  if (plusGenMatch) {
    return `Snapdragon ${plusGenMatch[1]}+ Gen ${plusGenMatch[2]}`;
  }

  const sGenMatch = compact.match(/^(\d+)sgen(\d+)$/);
  if (sGenMatch) {
    return `Snapdragon ${sGenMatch[1]}s Gen ${sGenMatch[2]}`;
  }

  const genMatch = compact.match(/^(\d+)gen(\d+)$/);
  if (genMatch) {
    return `Snapdragon ${genMatch[1]} Gen ${genMatch[2]}`;
  }

  const eliteMatch = compact.match(/^(\d+)elite(?:gen(\d+))?$/);
  if (eliteMatch) {
    return eliteMatch[2]
      ? `Snapdragon ${eliteMatch[1]} Elite Gen ${eliteMatch[2]}`
      : `Snapdragon ${eliteMatch[1]} Elite`;
  }

  if (compact === 'xelite') return 'Snapdragon X Elite';
  return null;
}

function normalizeSocLabel(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^apple\s+/i, 'Apple ')
    .replace(/^a(\d+)/i, 'A$1')
    .replace(/^m(\d+)/i, 'M$1')
    .replace(/\bbionic\b/gi, 'Bionic')
    .replace(/\bpro\b/gi, 'Pro')
    .replace(/\bmax\b/gi, 'Max')
    .replace(/\bultra\b/gi, 'Ultra');
}

function resolveAppleSocName(modelName: string | null): string | null {
  if (!modelName) return null;

  const embeddedSocMatch = modelName.match(
    /\(((?:A|M)\d+(?:\s+(?:Bionic|Pro|Max|Ultra))?)\)/i,
  );
  if (embeddedSocMatch) {
    return normalizeSocLabel(embeddedSocMatch[1]);
  }

  const mappedSocName =
    APPLE_SOC_BY_MODEL_NAME[modelName] ??
    Object.entries(APPLE_SOC_BY_MODEL_NAME).find(
      ([candidateModelName]) => candidateModelName.toLowerCase() === modelName.toLowerCase(),
    )?.[1];
  return mappedSocName ? normalizeSocLabel(mappedSocName) : null;
}

export function resolveAppleDevicePresentation(input: {
  socName?: string | null;
  deviceModel?: string | null;
}): AppleDevicePresentation | null {
  const candidates = [input.deviceModel, input.socName];

  let identifier: string | null = null;
  let modelName: string | null = null;

  for (const candidate of candidates) {
    const candidateIdentifier = normalizeAppleDeviceIdentifier(candidate);
    if (!identifier && candidateIdentifier) {
      identifier = candidateIdentifier;
    }

    const candidateModelName = resolveAppleMarketingName(candidate);
    if (candidateModelName) {
      modelName = candidateModelName;
      if (candidateIdentifier) {
        identifier = candidateIdentifier;
      }
      break;
    }
  }

  if (!identifier && !modelName) return null;

  return {
    identifier,
    modelName,
    socName: resolveAppleSocName(modelName),
  };
}
