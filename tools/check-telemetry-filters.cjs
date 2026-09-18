const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const path = require('node:path')
const backendRequire = createRequire(
  path.join(__dirname, '../backend/package.json')
)
const frontendRequire = createRequire(
  path.join(__dirname, '../frontend/package.json')
)
backendRequire('ts-node').register({
  project: path.join(__dirname, '../frontend/tsconfig.json'),
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node' }
})
const { getTelemetryFilterOptions } = frontendRequire(
  './src/features/telemetry/telemetryFilters'
)
const {
  deriveWeightLabel,
  filterLeaderboardData,
  formatBackendLabel,
  getBackendFamily,
  getHardwareBrandKeys,
  telemetrySocKey,
  telemetrySocFilterLabels
} = frontendRequire('./src/features/telemetry/telemetryRules')
const {
  defaultTelemetryFilters,
  parseTelemetryFilterState,
  telemetryQueryKey
} = frontendRequire('./src/features/telemetry/telemetryFilterState')
const { telemetrySocSearchText } = frontendRequire('@app/contracts')
const {
  formatConsumerSocName,
  normalizeAppleDeviceIdentifier,
  resolveAndroidSocName,
  simplifySnapdragonXEliteCpuName
} = frontendRequire('./src/utils/appleDeviceInfo')

const defaults = {
  selectedPlatforms: [],
  selectedBackend: [],
  selectedBatch: [],
  selectedSize: [],
  selectedModelTag: [],
  selectedBrand: [],
  selectedSoc: []
}
const entry = (values) => ({
  os: 'macos',
  socName: 'Apple M4',
  socBrand: 'apple',
  hardwareBrands: ['apple'],
  backend: 'web-rwkv',
  batchCount: 1,
  modelName: 'RWKV 0.1B',
  modelFileName: 'rwkv-0.1B.pth',
  modelSizeB: 0.1,
  sampleCount: 1,
  ...values
})
const data = [
  entry({ sampleCount: 5 }),
  entry({
    socName: 'Apple M3',
    backend: 'llama.cpp',
    modelSizeB: 2.9,
    batchCount: 2,
    sampleCount: 3
  }),
  entry({
    os: 'android',
    socName: 'Kirin 990',
    socBrand: 'huawei',
    hardwareBrands: ['huawei'],
    backend: 'ncnn',
    modelSizeB: 2.9,
    sampleCount: 20
  }),
  entry({
    os: 'android',
    socName: 'Snapdragon 8 Gen 3',
    socBrand: 'qualcomm',
    hardwareBrands: ['qualcomm'],
    backend: 'qnn',
    modelSizeB: 7.2,
    sampleCount: 10
  }),
  entry({
    os: 'windows',
    socName: 'NVIDIA RTX 4090',
    socBrand: 'nvidia',
    hardwareBrands: ['nvidia', 'intel'],
    backend: 'cuda',
    modelName: 'RWKV-VL',
    modelFileName: 'vision-model.bin',
    modelSizeB: null,
    batchCount: 16,
    sampleCount: 30
  })
]

const macFilters = { ...defaults, selectedPlatforms: ['macos'] }
const macOptions = getTelemetryFilterOptions(data, macFilters)
assert.deepEqual(macOptions.selectedSoc, ['Apple M4', 'Apple M3'])
assert.deepEqual(macOptions.selectedBackend, ['web-rwkv', 'llama.cpp'])
assert.deepEqual(macOptions.selectedBrand, ['apple'])
assert.deepEqual(macOptions.selectedSize, ['0.1B', '2.9B'])
assert.deepEqual(macOptions.selectedPlatforms, ['macos', 'android', 'windows'])

const multiFilters = {
  ...defaults,
  selectedPlatforms: ['macos', 'android'],
  selectedSize: ['2.9B', '7.2B'],
  selectedBackend: ['llama.cpp', 'ncnn']
}
assert.deepEqual(
  filterLeaderboardData(data, multiFilters).map((row) => row.socName),
  ['Apple M3', 'Kirin 990'],
  'values within a group use OR, while different groups use AND'
)
assert.deepEqual(
  getTelemetryFilterOptions(data, multiFilters).selectedBackend,
  ['ncnn', 'qnn', 'llama.cpp']
)

const conflict = { ...macFilters, selectedSoc: ['Kirin 990'] }
const frozenSelection = JSON.stringify(conflict)
assert.equal(filterLeaderboardData(data, conflict).length, 0)
const recoveryOptions = getTelemetryFilterOptions(data, conflict)
assert.deepEqual(recoveryOptions.selectedPlatforms, ['android'])
assert.deepEqual(recoveryOptions.selectedSoc, ['Apple M4', 'Apple M3'])
assert.deepEqual(recoveryOptions.selectedBackend, [])
assert.equal(
  JSON.stringify(conflict),
  frozenSelection,
  'faceting never clears selected values'
)
assert.equal(
  filterLeaderboardData(data, { ...conflict, selectedSoc: [] }).length,
  2
)

const unavailable = { ...macFilters, selectedSoc: ['Unavailable model'] }
assert.equal(filterLeaderboardData(data, unavailable).length, 0)
assert.deepEqual(getTelemetryFilterOptions(data, unavailable).selectedSoc, [
  'Apple M4',
  'Apple M3'
])
assert.deepEqual(getTelemetryFilterOptions([], unavailable), defaults)
assert.equal(
  filterLeaderboardData(data, { ...defaults, selectedBatch: ['1-invalid'] })
    .length,
  0,
  'an unavailable batch selection must not turn into a valid numeric prefix'
)

const allOptions = getTelemetryFilterOptions(data, defaults)
assert.deepEqual(allOptions.selectedBatch, ['1', '2', '16'])
assert.deepEqual(allOptions.selectedSize, ['0.1B', '2.9B', '7.2B', '大小未知'])
assert.deepEqual(allOptions.selectedModelTag, ['Chat', 'VL'])
assert.deepEqual(allOptions.selectedBrand, [
  'apple',
  'qualcomm',
  'huawei',
  'nvidia',
  'intel'
])
assert.deepEqual(allOptions.selectedSoc, [
  'NVIDIA RTX 4090',
  'Kirin 990',
  'Snapdragon 8 Gen 3',
  'Apple M4',
  'Apple M3'
])
assert.equal(deriveWeightLabel(data[4]), '大小未知')
assert.equal(
  deriveWeightLabel(
    entry({ modelSizeB: null, modelFileName: 'rwkv-13.3B-Q4.gguf' })
  ),
  '13.3B'
)
assert.deepEqual(getHardwareBrandKeys(entry({ hardwareBrands: [] })), [])
assert.deepEqual(getHardwareBrandKeys(entry({ hardwareBrands: undefined })), [
  'apple'
])

// The page passes search-filtered rows; facets must stay within that supplied universe.
assert.deepEqual(getTelemetryFilterOptions([data[2]], defaults).selectedSoc, [
  'Kirin 990'
])

// A different server query may choose different casing for the same SoC.
const versionRows = [
  entry({
    os: 'windows',
    socName: 'nvidia geforce rtx 4090',
    backend: 'cuda',
    socBrand: 'nvidia',
    hardwareBrands: ['nvidia']
  })
]
const savedSocSelection = {
  ...defaults,
  selectedSoc: [' NVIDIA GeForce RTX 4090 ']
}
assert.equal(
  telemetrySocKey(savedSocSelection.selectedSoc[0]),
  'nvidia geforce rtx 4090'
)
assert.deepEqual(
  filterLeaderboardData(versionRows, savedSocSelection),
  versionRows
)
const caseOptions = getTelemetryFilterOptions(versionRows, savedSocSelection)
assert.deepEqual(caseOptions.selectedPlatforms, ['windows'])
assert.deepEqual(caseOptions.selectedBackend, ['cuda'])
assert.deepEqual(caseOptions.selectedSoc, ['NVIDIA GeForce RTX 4090'])
assert.deepEqual(savedSocSelection.selectedSoc, [' NVIDIA GeForce RTX 4090 '])
assert.equal(
  filterLeaderboardData(versionRows, {
    ...savedSocSelection,
    selectedBackend: ['CUDA']
  }).length,
  0,
  'case-insensitive matching is limited to SoC identity'
)

// Saved part numbers and current public names must select the same observations.
const aliasRows = ['SM7435', 'Snapdragon 7s Gen 2', 'SM7450', 'SM7635'].map(
  (socName) => entry({ os: 'android', socName, backend: 'qnn' })
)
for (const selection of ['SM7435', 'Snapdragon 7s Gen 2']) {
  const filters = { ...defaults, selectedSoc: [selection] }
  assert.deepEqual(
    filterLeaderboardData(aliasRows, filters),
    aliasRows.slice(0, 2)
  )
  assert.deepEqual(
    getTelemetryFilterOptions(aliasRows, filters).selectedPlatforms,
    ['android']
  )
}
const deviceMappedRows = [
  entry({
    os: 'android',
    socName: 'MediaTek Helio P90',
    reportedSocNames: ['mt6779'],
    hardwareBrands: ['mediatek'],
    backend: 'llamacpp'
  })
]
const deviceMappedFilters = parseTelemetryFilterState(
  JSON.stringify({
    selectedSoc: ['MT6779']
  })
)
assert.deepEqual(
  filterLeaderboardData(deviceMappedRows, deviceMappedFilters),
  deviceMappedRows
)
const deviceMappedOptions = getTelemetryFilterOptions(
  deviceMappedRows,
  deviceMappedFilters
)
assert.deepEqual(
  deviceMappedOptions,
  {
    selectedPlatforms: ['android'],
    selectedBackend: ['llamacpp'],
    selectedBatch: ['1'],
    selectedSize: ['0.1B'],
    selectedModelTag: ['Chat'],
    selectedBrand: ['mediatek'],
    selectedSoc: ['MediaTek Helio P90']
  },
  'saved raw codes match every facet while SoC options display the public name'
)
assert.deepEqual(
  parseTelemetryFilterState(
    JSON.stringify({
      selectedSoc: ['SM7435', ' Snapdragon 7s Gen 2 ', 'sm7435', 'SM7635', ' ']
    })
  ).selectedSoc,
  ['Snapdragon 7s Gen 2', 'Qualcomm SM7635'],
  'persisted aliases canonicalize and deduplicate without inventing a retail model'
)
assert.notEqual(telemetrySocKey('SM7435'), telemetrySocKey('SM7450'))
assert.equal(telemetrySocKey('SM7635'), 'qualcomm sm7635')
assert.notEqual(
  telemetrySocKey('SM7635'),
  telemetrySocKey('Snapdragon 7s Gen 3')
)
assert.notEqual(telemetrySocKey('8gen1'), telemetrySocKey('8+gen1'))
assert.notEqual(telemetrySocKey('8gen3'), telemetrySocKey('8sgen3'))
assert.equal(telemetrySocKey('8+gen1'), telemetrySocKey('Snapdragon 8+ Gen 1'))
assert.equal(telemetrySocKey('8sgen3'), telemetrySocKey('Snapdragon 8s Gen 3'))
assert.ok(
  telemetrySocSearchText('Snapdragon 7s Gen 2').toLowerCase().includes('sm7435')
)
assert.ok(telemetrySocSearchText('SM7435').includes('Snapdragon 7s Gen 2'))
for (const [name, query] of [
  ['Snapdragon 8 Gen 3', '8gen3'],
  ['SM8650', '8gen3'],
  ['Snapdragon 8s Gen 3', '8sgen3'],
  ['Snapdragon 7+ Gen 2', '7+gen2']
]) {
  assert.ok(
    telemetrySocSearchText(name).toLowerCase().includes(query),
    `${name} supports ${query} search`
  )
}
assert.ok(
  !telemetrySocSearchText('Snapdragon 8s Gen 3').toLowerCase().includes('8gen3')
)
assert.ok(
  !telemetrySocSearchText('Snapdragon 8 Gen 3').toLowerCase().includes('8sgen3')
)
assert.equal(resolveAndroidSocName('SM7435'), 'Snapdragon 7s Gen 2')
assert.equal(resolveAndroidSocName('SM7635'), 'Qualcomm SM7635')
assert.equal(resolveAndroidSocName('xelite'), 'Snapdragon X Elite')
assert.equal(
  simplifySnapdragonXEliteCpuName(
    'Snapdragon(R) X - X1E80100 - Qualcomm(R) Oryon(TM) CPU'
  ),
  'Snapdragon(R) X - X1E80100'
)
assert.equal(normalizeAppleDeviceIdentifier('iphone15,2'), 'iPhone15,2')

const neuropilotRows = [
  entry({
    os: 'android',
    socName: 'MediaTek test device',
    hardwareBrands: ['mediatek'],
    modelSha256: 'same-model-digest',
    backend: 'mtkneuropilot7'
  }),
  entry({
    os: 'android',
    socName: 'MediaTek test device',
    hardwareBrands: ['mediatek'],
    modelSha256: 'same-model-digest',
    backend: 'mtkneuropilot9'
  })
]
const familyFilters = { ...defaults, selectedBackend: ['mtkneuropilot'] }
assert.deepEqual(
  getTelemetryFilterOptions(neuropilotRows, defaults).selectedBackend,
  ['mtkneuropilot'],
  'NeuroPilot variants share one backend candidate'
)
assert.deepEqual(
  getTelemetryFilterOptions(neuropilotRows, familyFilters).selectedSoc,
  ['MediaTek test device（型号待识别）'],
  'other facets match a selected NeuroPilot family'
)
const neuropilotMatches = filterLeaderboardData(neuropilotRows, familyFilters)
assert.deepEqual(neuropilotMatches, neuropilotRows)
assert.strictEqual(neuropilotMatches[0], neuropilotRows[0])
assert.strictEqual(neuropilotMatches[1], neuropilotRows[1])
assert.deepEqual(
  neuropilotMatches.map((row) => row.backend),
  ['mtkneuropilot7', 'mtkneuropilot9'],
  'family filtering preserves each raw backend and original entry'
)
for (const [backend, label] of [
  ['mtkneuropilot7', 'MTK NeuroPilot 7'],
  ['mtk_np7', 'MTK NeuroPilot 7'],
  ['mtkneuropilot9', 'MTK NeuroPilot 9'],
  ['mtk_np9', 'MTK NeuroPilot 9'],
  ['mtkneuropilot', 'MTK NeuroPilot']
]) {
  assert.equal(getBackendFamily(backend), 'mtkneuropilot')
  assert.equal(formatBackendLabel(backend), label)
}
for (const backend of ['mlx', 'qnn', 'cuda', 'mtkneuropilot10']) {
  assert.equal(getBackendFamily(backend), backend)
  assert.equal(formatBackendLabel(backend), backend)
}

const storedState = {
  selectedPlatforms: ['macos', 'android'],
  selectedBackend: ['web-rwkv', 'qnn'],
  selectedBatch: ['1', '16'],
  selectedSize: ['2.9B', '大小未知'],
  selectedModelTag: ['Chat', 'VL'],
  selectedBrand: ['apple', 'qualcomm'],
  selectedSoc: ['Apple M4', 'Unavailable model'],
  selectedVersion: ['4.8.0', '4.7.2'],
  selectedBuildMode: ['release', 'debug'],
  search: 'RWKV 2.9B'
}
assert.deepEqual(
  parseTelemetryFilterState(JSON.stringify(storedState)),
  storedState
)
for (const historicalSelection of [
  ['mtkneuropilot7'],
  ['mtkneuropilot9'],
  ['mtkneuropilot7', 'mtkneuropilot9'],
  ['mtkneuropilot', 'mtk_np7', 'mtk_np9']
]) {
  const migrated = parseTelemetryFilterState(
    JSON.stringify({ ...storedState, selectedBackend: historicalSelection })
  )
  assert.deepEqual(migrated, {
    ...storedState,
    selectedBackend: ['mtkneuropilot']
  })
  assert.deepEqual(
    filterLeaderboardData(neuropilotRows, {
      ...defaults,
      selectedBackend: migrated.selectedBackend
    }),
    neuropilotRows,
    'restored legacy variant selections consistently select the complete family'
  )
}
assert.deepEqual(
  parseTelemetryFilterState(
    JSON.stringify({
      selectedBackend: ['mlx', 'mtkneuropilot7', 'qnn', 'mtkneuropilot9']
    })
  ).selectedBackend,
  ['mlx', 'mtkneuropilot', 'qnn']
)
for (const malformed of [
  null,
  '',
  '{',
  '[]',
  'null',
  'true',
  '123',
  '"text"'
]) {
  assert.equal(parseTelemetryFilterState(malformed), null)
}
assert.deepEqual(
  parseTelemetryFilterState(
    JSON.stringify({
      selectedPlatforms: 'macos',
      selectedBackend: ['qnn', 1],
      selectedBatch: null,
      selectedSize: ['2.9B', '', '2.9B'],
      selectedModelTag: [],
      selectedVersion: {},
      selectedBuildMode: false,
      search: 42,
      ignoredKey: ['not a filter']
    })
  ),
  { ...defaultTelemetryFilters(), selectedSize: ['2.9B'], selectedModelTag: [] }
)
assert.equal(
  telemetryQueryKey(['4.8.0', '4.7.2'], ['release', 'debug']),
  telemetryQueryKey(['4.7.2', '4.8.0'], ['debug', 'release'])
)
assert.notEqual(
  telemetryQueryKey(['4.8.0'], ['release']),
  telemetryQueryKey(['4.7.2'], ['release'])
)
console.log(
  'telemetry filters: disjunctive facets, OR/AND, empty recovery, ordering, unknown sizes, SoC identity, backend families, raw backend identity, persisted state and query identity passed'
)

const legacyDebugVersion = parseTelemetryFilterState(
  JSON.stringify({ selectedVersion: ['4.6.7-debug'] })
)
assert.deepEqual(legacyDebugVersion.selectedVersion, ['4.6.7'])
assert.deepEqual(legacyDebugVersion.selectedBuildMode, ['debug'])
const explicitModeVersion = parseTelemetryFilterState(
  JSON.stringify({
    selectedVersion: ['4.6.7-debug'],
    selectedBuildMode: ['release']
  })
)
assert.deepEqual(explicitModeVersion.selectedVersion, ['4.6.7'])
assert.deepEqual(explicitModeVersion.selectedBuildMode, ['release'])
const mixedVersions = parseTelemetryFilterState(
  JSON.stringify({ selectedVersion: ['4.6.7-debug', '4.6.7', '4.6.8-rc.1'] })
)
assert.deepEqual(mixedVersions.selectedVersion, ['4.6.7', '4.6.8-rc.1'])
assert.deepEqual(mixedVersions.selectedBuildMode, [])

// Known chips use consumer names; unidentified chips retain exact identifiers.
// Display grouping must preserve record identities and unresolved suffixes.
for (const [raw, label] of [
  ['Qualcomm SM6225', 'Qualcomm SM6225（型号待识别）'],
  ['MT6771', 'MediaTek MT6771（型号待识别）'],
  ['SM7635-AC', 'Snapdragon 7s Gen 4'],
  ['MT6893Z/CZA', 'MT6893Z/CZA（型号待识别）'],
  ['Unknown', '芯片型号待识别'],
  ['SM7435', 'Snapdragon 7s Gen 2'],
  ['SM7450', 'Snapdragon 7 Gen 1'],
  ['SDM670', 'Snapdragon 670'],
  ['Snapdragon(R) X - X126100', 'Snapdragon X'],
  [
    'snapdragon(r) x elite - x1e78100 - qualcomm(r) oryon(tm) cpu',
    'Snapdragon X Elite'
  ],
  ['Qualcomm Dragonwing QCM6490', 'Qualcomm Dragonwing'],
  ['iphone16,1', 'A17 Pro'],
  ['amd ryzen 7 9800x3d 8-core processor', 'AMD Ryzen 7 9800X3D'],
  [
    'NVIDIA Corporation GB203 [GeForce RTX 5070 Ti] (rev a1)',
    'GeForce RTX 5070 Ti'
  ],
  [
    'genuine intel(r) cpu 0000 @ 3.00ghz',
    'genuine intel(r) cpu 0000 @ 3.00ghz（型号待识别）'
  ]
]) {
  assert.equal(formatConsumerSocName(raw), label)
  assert.equal(
    formatConsumerSocName(label),
    label,
    'public labels are idempotent'
  )
  if (!label.includes('型号待识别')) {
    assert(
      !/\b(?:SM|SDM|MT|QCM)\d|_soc|X126100|X1E78100|iphone\d+,/i.test(label)
    )
  }
}
const publicGroupingRows = [
  entry({ socName: 'Qualcomm SM6225', reportedSocNames: ['SM6225'] }),
  entry({ socName: 'Qualcomm SM7635', reportedSocNames: ['SM7635'] }),
  entry({ socName: 'MediaTek MT6771', reportedSocNames: ['MT6771'] }),
  entry({ socName: 'MediaTek Helio P90', reportedSocNames: ['MT6779'] })
]
const publicBefore = JSON.stringify(publicGroupingRows)
assert.deepEqual(
  getTelemetryFilterOptions(publicGroupingRows, defaults).selectedSoc.sort(),
  [
    'Qualcomm SM6225（型号待识别）',
    'Qualcomm SM7635（型号待识别）',
    'MediaTek MT6771（型号待识别）',
    'MediaTek Helio P90'
  ].sort()
)
assert.equal(
  filterLeaderboardData(publicGroupingRows, {
    ...defaults,
    selectedSoc: ['Qualcomm 芯片（型号待识别）']
  }).length,
  2
)
assert.equal(
  filterLeaderboardData(publicGroupingRows, {
    ...defaults,
    selectedSoc: ['MediaTek 芯片（型号待识别）']
  }).length,
  1
)
assert.deepEqual(telemetrySocFilterLabels(publicGroupingRows, ['MT6779']), [
  'MediaTek Helio P90'
])
assert.equal(
  JSON.stringify(publicGroupingRows),
  publicBefore,
  'public labels must not mutate statistical identities'
)
console.log('Consumer SoC labels and grouped filter identity checks passed')
const xFamilyRows = [
  entry({ socName: 'Snapdragon X Elite', reportedSocNames: ['x elite'] }),
  entry({ socName: 'Snapdragon(R) X - X126100', reportedSocNames: ['x elite'] })
]
assert.deepEqual(
  filterLeaderboardData(xFamilyRows, {
    ...defaults,
    selectedSoc: ['Snapdragon X Elite']
  }),
  [xFamilyRows[0]]
)

assert.deepEqual(
  filterLeaderboardData(publicGroupingRows, {
    ...defaults,
    selectedSoc: ['Qualcomm SM6225（型号待识别）']
  }),
  [publicGroupingRows[0]]
)
assert.deepEqual(
  filterLeaderboardData(publicGroupingRows, {
    ...defaults,
    selectedSoc: ['Qualcomm SM7635（型号待识别）']
  }),
  [publicGroupingRows[1]]
)
const suffixRows = ['SM7635', 'SM7635-AC'].map((socName) => entry({ socName }))
assert.equal(
  getTelemetryFilterOptions(suffixRows, defaults).selectedSoc.length,
  2
)
assert.deepEqual(
  filterLeaderboardData(suffixRows, {
    ...defaults,
    selectedSoc: ['Qualcomm SM7635-AC（型号待识别）']
  }),
  [suffixRows[1]]
)

// Newly identified consumer names and migration of previous unresolved selections.
for (const name of [
  'UNISOC T606',
  'UNISOC T7250',
  'Xiaomi XRING O1',
  'MediaTek MT8788',
  'Exynos 2400e',
  'MediaTek Dimensity 8350 Apex'
]) {
  assert.equal(formatConsumerSocName(name), name)
}
const newlyIdentified = [
  entry({ socName: 'Snapdragon 685', reportedSocNames: ['SM6225'] })
]
assert.deepEqual(
  telemetrySocFilterLabels(newlyIdentified, ['Qualcomm SM6225（型号待识别）']),
  ['Snapdragon 685']
)
assert.deepEqual(
  telemetrySocFilterLabels(
    [...newlyIdentified, entry({ socName: 'Qualcomm SM6225' })],
    ['Qualcomm SM6225（型号待识别）']
  ),
  ['Qualcomm SM6225（型号待识别）']
)
assert.deepEqual(
  getHardwareBrandKeys(
    entry({
      socName: 'Xiaomi XRING O1',
      socBrand: 'xiaomi',
      hardwareBrands: ['xiaomi']
    })
  ),
  ['xiaomi']
)
assert.deepEqual(
  getHardwareBrandKeys(
    entry({
      socName: 'UNISOC T606',
      socBrand: 'unisoc',
      hardwareBrands: ['unisoc']
    })
  ),
  ['unisoc']
)
