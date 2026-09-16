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
  getHardwareBrandKeys,
  telemetrySocKey
} = frontendRequire('./src/features/telemetry/telemetryRules')
const {
  defaultTelemetryFilters,
  parseTelemetryFilterState,
  telemetryQueryKey
} = frontendRequire('./src/features/telemetry/telemetryFilterState')

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
assert.deepEqual(caseOptions.selectedSoc, ['nvidia geforce rtx 4090'])
assert.deepEqual(savedSocSelection.selectedSoc, [' NVIDIA GeForce RTX 4090 '])
assert.equal(
  filterLeaderboardData(versionRows, {
    ...savedSocSelection,
    selectedBackend: ['CUDA']
  }).length,
  0,
  'case-insensitive matching is limited to SoC identity'
)

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
  'telemetry filters: disjunctive facets, OR/AND, empty recovery, ordering, unknown sizes, SoC identity, persisted state and query identity passed'
)
