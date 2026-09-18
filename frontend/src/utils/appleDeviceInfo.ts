import iosDevices, { isIOSDeviceString } from '@naverpay/device-info/ios';
import { resolveTelemetrySocName, resolveRegisteredTelemetrySocName } from '@app/contracts';

export interface AppleDevicePresentation {
  identifier: string | null;
  modelName: string | null;
  socName: string | null;
}

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

export function summarizeHeaderDeviceModels(input: {
  deviceLabels?: Array<string | null | undefined> | null;
  fallbackDeviceModels?: Array<string | null | undefined> | null;
  limit?: number;
}): string | null {
  const values =
    (input.deviceLabels?.length ? input.deviceLabels : input.fallbackDeviceModels) ?? [];
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
  return resolveTelemetrySocName(value) ?? simplifySnapdragonXEliteCpuName(value);
}

/** Public labels only. Never use these labels as aggregation or record-query identities. */
export function formatConsumerSocName(value: string): string {
  const raw = value.trim();
  if (raw.endsWith('（型号待识别）') || raw === '芯片型号待识别') return raw;
  if (!raw || /^(?:unknown|n\/a|未识别|未知)$/i.test(raw)) return '芯片型号待识别';
  const registered = resolveRegisteredTelemetrySocName(raw);
  if (registered && /^(?:MediaTek MT|UNISOC |Xiaomi XRING)/.test(registered)) return registered;
  const apple = resolveAppleDevicePresentation({ socName: raw });
  if (apple) return apple.socName ?? apple.modelName ?? `${raw}（型号待识别）`;

  const name = (resolveTelemetrySocName(raw) ?? raw)
    .replace(/\((?:r|tm)\)|[®™]/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^Intel Corporation /i, 'Intel ')
    .replace(/RadeonT\b/g, 'Radeon')
    .trim();
  // Windows CPU strings include SKU and CPU implementation details after the retail family.
  const snapdragonX = name.match(/^snapdragon\s+(x2?)(?:\s+(elite(?:\s+extreme)?|plus))?\b/i);
  if (snapdragonX) {
    return `Snapdragon ${snapdragonX[1].toUpperCase()}${snapdragonX[2] ? ` ${snapdragonX[2].replace(/\b\w/g, (letter) => letter.toUpperCase())}` : ''}`;
  }
  if (/^(?:qualcomm\s+)?dragonwing\b/i.test(name)) return 'Qualcomm Dragonwing';
  if (/\badreno\b/i.test(name)) return 'Qualcomm Adreno GPU';
  if (/^Snapdragon\s+(?:\d|X)/.test(name)) return name;
  if (/^(?:MediaTek (?:Dimensity|Helio)|Kirin |Exynos |Google Tensor|Apple M\d)/.test(name))
    return name;
  if (/^(?:Apple )?[AM]\d+(?:\s+(?:Bionic|Pro|Max|Ultra))*$/i.test(name))
    return normalizeSocLabel(name);

  // Prefer the retail GPU name already supplied in PCI descriptions, discarding board/revision codes.
  const gpu = name.match(/\[((?:GeForce|Tesla|Radeon|Iris|UHD)[^\]]+)\]/i);
  if (gpu) return formatConsumerSocName(gpu[1]);
  const intelCpu = name.match(
    /\b(?:intel\s+)?(core\s+(?:(?:ultra\s+)?[3579]\s+|i[3579]-)[\w+-]+(?:\s+plus)?|xeon\s+(?:cpu\s+)?[\w-]+(?:\s+v\d+)?)/i,
  );
  if (intelCpu)
    return `Intel ${intelCpu[1]
      .replace(/\bcpu\s+/i, '')
      .replace(
        /\b(?:core|ultra|xeon|plus)\b/gi,
        (word) => word[0].toUpperCase() + word.slice(1).toLowerCase(),
      )
      .replace(/\b(\d[\da-z]*[a-z][\da-z]*)\b/gi, (model) => model.toUpperCase())}`;
  const amdCpu = name.match(
    /\b(?:ryzen\s+(?:(?:ai\s+)?[3579]\s+(?:(?:hx|pro)\s+)?|ai\s+max\+?\s+)[\w+]+|athlon\s+(?:silver|gold)\s+[\w+]+)/i,
  );
  if (amdCpu)
    return `AMD ${amdCpu[0]
      .replace(
        /\b(?:ryzen|athlon|silver|gold|max)\b/gi,
        (word) => word[0].toUpperCase() + word.slice(1).toLowerCase(),
      )
      .replace(/\b(?:ai|hx|pro)\b/gi, (word) => word.toUpperCase())
      .replace(/\b(\d[\da-z]*[a-z][\da-z]*)\b/gi, (model) => model.toUpperCase())}`;
  if (/^(?:NVIDIA\s+)?(?:GeForce|Tesla|Quadro|TITAN|RTX|GTX)\b/i.test(name))
    return name
      .replace(/^nvidia\s+/i, 'NVIDIA ')
      .replace(/\bgeforce\b/gi, 'GeForce')
      .replace(/\bquadro\b/gi, 'Quadro')
      .replace(/\btesla\b/gi, 'Tesla')
      .replace(/\b(?:rtx|gtx|titan|super)\b/gi, (word) => word.toUpperCase())
      .replace(/\s*\(rev.*$/i, '');
  if (/^(?:(?:AMD|Intel)\s+)?(?:Radeon|FirePro|Arc|Iris|UHD|HD Graphics|Graphics)\b/i.test(name))
    return name.replace(/\s*\(rev.*$/i, '');

  // Preserve the full identifier, including revisions, when its retail name is unresolved.
  return `${resolveTelemetrySocName(raw) ?? raw}（型号待识别）`;
}

export function simplifySnapdragonXEliteCpuName(value: string | null | undefined): string | null {
  const normalized = cleanOptionalString(value);
  if (!normalized) return null;
  if (/^x\s*elite$/i.test(normalized)) return 'Snapdragon X Elite';
  const match = normalized.match(/^(Snapdragon\(R\)\s+X\s*-\s*[^-]+)(?:\s*-.*)?$/i);
  return match?.[1]?.trim() ?? null;
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

  const embeddedSocMatch = modelName.match(/\(((?:A|M)\d+(?:\s+(?:Bionic|Pro|Max|Ultra))?)\)/i);
  if (embeddedSocMatch) {
    return normalizeSocLabel(embeddedSocMatch[1]);
  }

  const mappedSocName = resolveRegisteredTelemetrySocName(modelName);
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
