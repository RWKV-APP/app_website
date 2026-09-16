const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const path = require('node:path')
const { gunzipSync } = require('node:zlib')
const backendRequire = createRequire(
  path.join(__dirname, '../backend/package.json')
)
backendRequire('ts-node').register({
  project: path.join(__dirname, '../backend/tsconfig.json'),
  transpileOnly: true
})
const { TelemetryService } = backendRequire('./src/telemetry/telemetry.service')
const { TelemetryController } = backendRequire(
  './src/telemetry/telemetry.controller'
)

// Use an isolated real SQLite database and the generated Prisma client, including
// historical NULL modes. Filtering, raw result types and pagination all execute.
const sqlite3 = backendRequire('sqlite3')
const { PrismaClient } = backendRequire('@prisma/client')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const databases = []
async function telemetryDatabase(rows, onRead = () => {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'telemetry-check-'))
  const file = path.join(directory, 'telemetry.db')
  const database = new sqlite3.Database(file)
  const query = (sql, values = []) =>
    new Promise((resolve, reject) => {
      database.all(sql, values, (error, result) =>
        error ? reject(error) : resolve(result)
      )
    })
  const numeric = [
    'id',
    'modelSizeB',
    'batchCount',
    'prefillSpeed',
    'decodeSpeed',
    'totalMemoryMb',
    'totalVramMb',
    'schemaVersion'
  ]
  const columns = [
    ...new Set([
      ...Object.keys(rows[0]),
      'osVersion',
      'cpuName',
      'gpuName',
      'totalMemoryMb',
      'totalVramMb',
      'appBuild',
      'clientTimestamp',
      'createdAt',
      'schemaVersion'
    ])
  ]
  const type = (key) =>
    key === 'isBatch'
      ? 'BOOLEAN'
      : key.endsWith('Timestamp') || key === 'createdAt'
        ? 'DATETIME'
        : numeric.includes(key)
          ? ['modelSizeB', 'prefillSpeed', 'decodeSpeed'].includes(key)
            ? 'REAL'
            : 'INTEGER'
          : 'TEXT'
  await query(
    `CREATE TABLE TelemetryPerf (${columns.map((key) => `"${key}" ${type(key)}`).join(',')})`
  )
  for (const row of rows) {
    const defaults = {
      appBuild: '749',
      clientTimestamp: Date.now(),
      createdAt: Date.now()
    }
    await query(
      `INSERT INTO TelemetryPerf (${columns.map((key) => `"${key}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
      columns.map((key) => row[key] ?? defaults[key] ?? null)
    )
  }
  await new Promise((resolve, reject) =>
    database.close((error) => (error ? reject(error) : resolve()))
  )
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${file}` } }
  })
  databases.push({ prisma, directory })
  return {
    storedVersions: async () => {
      const rows =
        await prisma.$queryRaw`SELECT id, appVersion, buildMode FROM TelemetryPerf ORDER BY id`
      return rows.map((row) => ({ ...row, id: Number(row.id) }))
    },
    $queryRaw: async (statement) => {
      onRead()
      assert(
        !statement.sql.includes('installIdHash'),
        'raw SQL must preserve the public column allowlist'
      )
      return prisma.$queryRaw(statement)
    },
    telemetryPerf: {
      findMany: async (options) => {
        onRead()
        assert.equal(options.select.installIdHash, undefined)
        return prisma.telemetryPerf.findMany(options)
      },
      count: (options) => prisma.telemetryPerf.count(options),
      groupBy: (options) => prisma.telemetryPerf.groupBy(options)
    }
  }
}

async function main() {
  let reads = 0
  let fail = false
  const rows = [10, 20, 30].map((speed, index) => ({
    id: index + 1,
    os: 'android',
    socName: 'sm7435',
    socBrand: 'qualcomm',
    deviceModel: 'test',
    modelName: 'RWKV 0.1B',
    modelFileName: 'rwkv-0.1b.bin',
    modelSha256: 'model-hash',
    modelSizeB: 0.1,
    quantization: 'q8',
    backend: 'qnn',
    isBatch: false,
    batchCount: 1,
    decodeSpeed: speed,
    prefillSpeed: speed * 2,
    appVersion: '4.8.0',
    buildMode: 'release',
    installIdHash: 'MUST_NOT_BE_PUBLIC'
  }))
  const prisma = await telemetryDatabase(rows, () => {
    reads++
    if (fail) throw new Error('temporary database failure')
  })
  const service = new TelemetryService(prisma)
  const [first, concurrent] = await Promise.all([
    service.leaderboard({ limit: '5000' }),
    service.leaderboard({ limit: '5000' })
  ])
  assert.equal(reads, 1, 'identical in-flight queries must share a read')
  assert.deepEqual(first, concurrent)
  assert.equal(first.length, 1)
  assert.equal(first[0].socName, 'Snapdragon 7s Gen 2')
  assert.equal(first[0].sampleCount, 3)
  assert.equal(first[0].decodeSpeed.avg, 20)
  await service.leaderboard({ limit: '5000' })
  assert.equal(reads, 1, 'warm query must reuse snapshot')
  const realNow = Date.now
  try {
    Date.now = () => realNow() + 31_000
    await service.leaderboard({ limit: '5000' })
    assert.equal(reads, 2, 'expired data must refresh')
  } finally {
    Date.now = realNow
  }
  fail = true
  await assert.rejects(service.leaderboard({ os: 'ios' }))
  fail = false
  await service.leaderboard({ os: 'ios' })
  assert.equal(reads, 4, 'failed requests must be retryable')
  const browse = await service.publicRecords({ page: '1', limit: '2' })
  assert.equal(browse.items.length, 2)
  assert.equal(browse.total, 3)
  assert(!JSON.stringify(browse).includes('MUST_NOT_BE_PUBLIC'))
  assert.equal(
    (
      await service.records({
        socName: 'Snapdragon 7s Gen 2',
        modelSha256: 'model-hash',
        backend: 'qnn',
        limit: '-1'
      })
    ).length,
    1
  )

  // Historical aliases, stale vendor tags and invalid identifiers use the same
  // normalization in aggregates, facets and record drilldown without rewriting rows.
  const canonicalCases = [
    ['sm7435', 'Snapdragon 7s Gen 2', 'snapdragon 7s gen 2', 'qualcomm'],
    ['pixel6', 'Google Tensor', 'google tensor', 'google'],
    ['pixel7', 'Google Tensor G2', 'google tensor g2', 'google'],
    ['SM7125', 'Snapdragon 720G', 'snapdragon 720g', 'qualcomm']
  ]
  const historicalRows = canonicalCases.flatMap(
    ([alias, canonical, lower, brand]) =>
      [alias, canonical, lower].map((socName, index) => ({
        ...rows[index],
        socName,
        socBrand: brand
      }))
  )
  for (const socName of ['kirin9000', 'kirin9010', 'kirin9020', 'kirin9030']) {
    for (const socBrand of ['snapdragon', 'huawei']) {
      historicalRows.push({ ...rows[0], socName, socBrand })
    }
  }
  historicalRows.push(
    {
      ...rows[0],
      os: 'linux',
      socName: 'ubuntu 22.04.5 lts',
      socBrand: 'unknown',
      backend: 'llamacpp'
    },
    {
      ...rows[0],
      os: 'windows',
      socName: 'windows 11 home china',
      socBrand: 'unknown',
      backend: 'llamacpp'
    },
    {
      ...rows[0],
      os: 'windows',
      socName: 'OrayIddDriver Device',
      socBrand: 'intel',
      cpuName: '12th Gen Intel(R) Core(TM) i7-12700',
      gpuName: 'OrayIddDriver Device',
      backend: 'webrwkv'
    },
    {
      ...rows[0],
      os: 'windows',
      socName: 'Intel Core i7-12700',
      socBrand: 'nvidia',
      cpuName: 'Intel Core i7-12700',
      gpuName: 'NVIDIA GeForce RTX 4090',
      backend: 'llamacpp'
    }
  )
  for (const [index, socName] of [
    'NVIDIA GeForce RTX 4090',
    'nvidia geforce rtx 4090'
  ].entries()) {
    historicalRows.push({
      ...rows[0],
      socName,
      socBrand: 'nvidia',
      modelSha256: `gpu-model-${index}`
    })
  }
  const originalRows = structuredClone(historicalRows)
  const normalizedService = new TelemetryService(
    await telemetryDatabase(historicalRows)
  )
  const normalized = await normalizedService.leaderboard({ limit: '5000' })
  for (const [alias, canonical] of canonicalCases) {
    const entry = normalized.find((row) => row.socName === canonical)
    assert.equal(
      entry.sampleCount,
      3,
      `${canonical} aliases must share statistics`
    )
    assert.equal(entry.decodeSpeed.avg, 20)
    for (const socName of [alias, canonical, canonical.toLowerCase()]) {
      const records = await normalizedService.records({
        socName,
        modelSha256: 'model-hash',
        backend: 'qnn'
      })
      assert.equal(
        records.length,
        3,
        `${socName} drilldown must retain every alias`
      )
      assert(records.every((row) => row.socName === canonical))
    }
  }
  const kirin = normalized.filter((row) => row.socName.startsWith('Kirin'))
  assert.equal(kirin.length, 4)
  assert(
    kirin.every((row) => row.socBrand === 'huawei' && row.sampleCount === 2)
  )
  assert(
    kirin.every((row) => JSON.stringify(row.hardwareBrands) === '["huawei"]')
  )
  const qualcomm = await normalizedService.publicRecords({
    socBrand: 'qualcomm'
  })
  assert.equal(qualcomm.total, 6, 'Kirin must not match the Qualcomm filter')
  const unknown = normalized.filter((row) => row.socName === 'Unknown')
  assert.equal(
    unknown.length,
    3,
    'OS and virtual driver samples must remain visible as unknown'
  )
  assert(unknown.every((row) => row.socBrand === 'unknown'))
  const driver = unknown.find((row) => row.backend === 'webrwkv')
  assert.deepEqual(
    driver.hardwareBrands,
    ['intel'],
    'retain the separately reported real CPU'
  )
  assert(
    unknown
      .filter((row) => row.backend !== 'webrwkv')
      .every((row) => row.hardwareBrands.length === 0)
  )
  const desktop = normalized.find(
    (row) => row.socName === 'Intel Core i7-12700'
  )
  assert.deepEqual(
    new Set(desktop.hardwareBrands),
    new Set(['intel', 'nvidia'])
  )
  const gpus = normalized.filter((row) =>
    row.modelSha256.startsWith('gpu-model-')
  )
  assert.equal(
    new Set(gpus.map((row) => row.socName)).size,
    1,
    'case variants across model groups must share a facet label'
  )
  const unknownRecords = await normalizedService.records({
    socName: 'Unknown',
    modelSha256: 'model-hash',
    backend: 'webrwkv',
    os: 'windows'
  })
  assert.equal(
    unknownRecords.length,
    1,
    'unknown chip samples must remain reachable by drilldown'
  )
  assert.equal(unknownRecords[0].gpuName, 'OrayIddDriver Device')
  const facets = await normalizedService.publicFilters()
  assert.equal(
    facets.socs.filter((name) => name.toLowerCase() === 'snapdragon 7s gen 2')
      .length,
    1
  )
  assert(facets.socs.includes('Unknown'))
  assert(
    !facets.socs.some((name) => /ubuntu|orayidddriver|windows/i.test(name))
  )
  assert.deepEqual(
    historicalRows,
    originalRows,
    'normalization must leave stored records untouched'
  )

  const { normalizeTelemetrySocName, TELEMETRY_SOC_ALIASES } =
    backendRequire('@app/contracts')
  for (const [canonical, aliases] of Object.entries(TELEMETRY_SOC_ALIASES)) {
    for (const alias of [canonical, ...aliases]) {
      assert.equal(normalizeTelemetrySocName(alias), canonical)
      assert.equal(normalizeTelemetrySocName(alias.toLowerCase()), canonical)
    }
  }
  const sharedCodes = [
    'mt6771',
    'mt6895',
    'mt6893',
    'mt6765',
    'mt6853',
    'mt6878',
    'sm7635',
    'sm7325',
    'sm8250',
    'sm8150',
    'sm8953'
  ]
  for (const code of sharedCodes) {
    assert(
      normalizeTelemetrySocName(code).endsWith(code.toUpperCase()),
      `${code} must retain its code`
    )
  }
  assert.notEqual(
    normalizeTelemetrySocName('sm7435'),
    normalizeTelemetrySocName('sm7450')
  )
  assert.notEqual(
    normalizeTelemetrySocName('sm8650'),
    normalizeTelemetrySocName('sm8650-AC')
  )

  // Unequal alias populations must aggregate the individual measurements, and
  // generic device reports must split by known hardware, never by vendor alone.
  const socRows = [10, 20, 30, 40].map((speed, index) => ({
    ...rows[0],
    id: index + 1,
    socName: index === 0 ? 'sm8650' : '8 gen 3',
    decodeSpeed: speed,
    prefillSpeed: speed * 10
  }))
  socRows.push(
    ...[
      ['snapdragon_soc', 'Pixel 8', 'Google Tensor G3'],
      ['snapdragon_soc', 'Pixel 9 Pro XL', 'Google Tensor G4'],
      ['tensor_soc', 'Pixel 10', 'Google Tensor G5'],
      ['snapdragon_soc', 'Pixel 10a', 'Google Tensor G4']
    ].map(([socName, deviceModel], index) => ({
      ...rows[0],
      id: index + 5,
      socName,
      deviceModel
    }))
  )
  socRows.push(
    { ...rows[0], id: 9, socName: 'mt6771', deviceModel: 'unknown' },
    { ...rows[0], id: 10, socName: 'Helio P60' },
    { ...rows[0], id: 11, socName: 'Helio P70' }
  )
  const socService = new TelemetryService(await telemetryDatabase(socRows))
  const socBoard = await socService.leaderboard({ limit: '5000' })
  assert.equal(
    socBoard.reduce((total, row) => total + row.sampleCount, 0),
    11
  )
  const gen3 = socBoard.find((row) => row.socName === 'Snapdragon 8 Gen 3')
  assert.equal(gen3.sampleCount, 4)
  assert.equal(gen3.decodeSpeed.avg, 25)
  assert.equal(gen3.decodeSpeed.max, 40)
  assert.equal(gen3.decodeSpeed.top10, 40)
  for (const socName of ['SM8650', '8 gen 3', 'Snapdragon 8 Gen 3']) {
    assert.equal(
      (
        await socService.records({
          socName,
          modelSha256: 'model-hash',
          backend: 'qnn'
        })
      ).length,
      4
    )
    assert.equal((await socService.publicRecords({ socName })).total, 4)
  }
  assert.equal(
    socBoard.find((row) => row.socName === 'Google Tensor G4').sampleCount,
    2
  )
  assert(
    socBoard
      .filter((row) => row.socName.startsWith('Google Tensor'))
      .every((row) => row.socBrand === 'google')
  )
  for (const socName of [
    'MediaTek MT6771',
    'MediaTek Helio P60',
    'MediaTek Helio P70'
  ]) {
    assert.equal(socBoard.find((row) => row.socName === socName).sampleCount, 1)
  }

  const gpuRows = ['4060', '4070'].map((gpu, index) => ({
    ...rows[0],
    id: index + 1,
    os: 'windows',
    backend: 'webrwkv',
    socName: 'AMD Ryzen 7 7840HS with Radeon 780M Graphics',
    cpuName: 'AMD Ryzen 7 7840HS with Radeon 780M Graphics',
    socBrand: 'amd',
    gpuName: `NVIDIA GeForce RTX ${gpu} Laptop GPU`,
    decodeSpeed: 10 + index * 10
  }))
  const gpuBoard = await new TelemetryService(
    await telemetryDatabase(gpuRows)
  ).leaderboard({})
  assert.equal(
    gpuBoard.length,
    2,
    'desktop GPU results must not merge through a CPU alias'
  )
  assert(
    gpuBoard.every(
      (row) =>
        row.socName.startsWith('NVIDIA GeForce RTX') && row.sampleCount === 1
    )
  )
  for (const [code, model, canonical] of [
    ['mt6779', 'BV8900', 'MediaTek Helio P90'],
    ['mt6983', 'CPH2493', 'MediaTek Dimensity 9000']
  ]) {
    const service = new TelemetryService(
      await telemetryDatabase([
        { ...rows[0], socName: code, deviceModel: model }
      ])
    )
    const board = await service.leaderboard({ socName: code })
    assert.equal(board[0].socName, canonical)
    assert.deepEqual(board[0].reportedSocNames, [code])
    for (const socName of [code, canonical]) {
      assert.equal(
        (
          await service.records({
            socName,
            modelSha256: 'model-hash',
            backend: 'qnn'
          })
        ).length,
        1
      )
      assert.equal((await service.publicRecords({ socName })).total, 1)
    }
  }

  const { normalizeTelemetryAppVersion, normalizeTelemetryAppDimensions } =
    backendRequire('@app/contracts')
  assert.equal(normalizeTelemetryAppVersion('4.6.7-debug'), '4.6.7')
  for (const version of [
    '4.6.7-rc.1',
    '4.6.7-rc.1-debug',
    '4.6.7-beta',
    '4.6.7.1-debug',
    '4..6.7-debug',
    'preview-debug'
  ]) {
    assert.equal(normalizeTelemetryAppVersion(version), version)
  }
  assert.deepEqual(
    normalizeTelemetryAppDimensions('4.6.7-debug', ' RELEASE '),
    { appVersion: '4.6.7', buildMode: 'release' }
  )
  const versionCases = [
    ['4.6.7', 'debug'],
    ['4.6.7-debug', 'unknown'],
    ['4.6.7-debug', null],
    ['4.6.7-debug', 'release'],
    ['4.6.7-profile', 'unknown'],
    ['4.6.7-release', ''],
    ['4.6.7', 'unknown'],
    ['4.6.7', null],
    ['4.6.8-debug', 'unknown'],
    ['4.6.7-rc.1-debug', 'unknown'],
    ['4.6.7-beta', 'release'],
    ['4.6.7', 'profile'],
    ['4.6.7-debug', 'invalid'],
    ['4.6.7', 'release'],
    ['4.6.7.1-debug', 'unknown'],
    ['4.6.7-unknown', 'unknown'],
    ['4.x.7-debug', 'unknown'],
    ['4..6.7-debug', 'unknown'],
    ['4.6.7-debug', 'profile'],
    ['4.6.7-Debug', 'unknown'],
    ['4.6.7-RELEASE', null]
  ]
  const versionRows = versionCases.map(([appVersion, buildMode], index) => ({
    ...rows[0],
    id: index + 1,
    appVersion,
    buildMode
  }))
  const originalVersionRows = structuredClone(versionRows)
  const versionDatabase = await telemetryDatabase(versionRows)
  const versionService = new TelemetryService(versionDatabase)
  const queryCases = [
    [{ appVersion: '4.6.7' }, [1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14, 19, 20, 21]],
    [{ appVersion: '4.6.7', buildMode: 'debug' }, [1, 2, 3, 13, 20]],
    [{ appVersion: '4.6.7', buildMode: 'profile' }, [5, 12, 19]],
    [{ appVersion: '4.6.7', buildMode: 'release' }, [4, 6, 14, 21]],
    [{ appVersion: '4.6.7', buildMode: 'unknown' }, [7, 8]],
    [
      { appVersion: '4.6.7', buildMode: 'debug,release' },
      [1, 2, 3, 4, 6, 13, 14, 20, 21]
    ],
    [{ appVersion: '4.6.7,4.6.8', buildMode: 'debug' }, [1, 2, 3, 9, 13, 20]],
    [{ appVersion: '4.6.7-Debug' }, [20]],
    [{ appVersion: "4.6.7') OR 1=1 --" }, []],
    [{ appVersion: '4.6.7-debug' }, [2, 3, 4, 13, 19]],
    [{ appVersion: '4.6.7-debug', buildMode: 'release' }, [4]],
    [{ appVersion: '4.6.7-rc.1-debug', buildMode: 'unknown' }, [10]],
    [{ appVersion: '4.6.7-beta', buildMode: 'release' }, [11]],
    [{ buildMode: 'unknown' }, [7, 8, 10, 15, 16, 17, 18]],
    [{ appVersion: '4.6.7', buildMode: 'debug', os: 'ios' }, []]
  ]
  const sortedIds = (items) => items.map((row) => row.id).sort((a, b) => a - b)
  for (const [query, ids] of queryCases) {
    const records = await versionService.records({
      socName: 'Snapdragon 7s Gen 2',
      modelSha256: 'model-hash',
      backend: 'qnn',
      ...query
    })
    assert.deepEqual(
      sortedIds(records),
      ids,
      `record SQL: ${JSON.stringify(query)}`
    )
    assert(
      records.every(
        (record) =>
          record.clientTimestamp instanceof Date &&
          record.createdAt instanceof Date
      )
    )
    const browse = await versionService.publicRecords(query)
    const admin = await versionService.adminRecords(query)
    assert.deepEqual(
      sortedIds(browse.items),
      ids,
      `public browse SQL: ${JSON.stringify(query)}`
    )
    assert.deepEqual(
      sortedIds(admin.items),
      ids,
      `admin browse SQL: ${JSON.stringify(query)}`
    )
    assert.equal(browse.total, ids.length)
    assert.equal(admin.total, ids.length)
    const leaderboard = await versionService.leaderboard(query)
    assert.equal(
      leaderboard.reduce((sum, row) => sum + row.sampleCount, 0),
      ids.length,
      `leaderboard SQL: ${JSON.stringify(query)}`
    )
    for (const record of [...records, ...browse.items, ...admin.items]) {
      const original = versionRows.find((row) => row.id === record.id)
      const expected = normalizeTelemetryAppDimensions(
        original.appVersion,
        original.buildMode
      )
      assert.equal(typeof record.id, 'number')
      assert.equal(typeof record.isBatch, 'boolean')
      assert.equal(record.appVersion, expected.appVersion)
      assert.equal(record.buildMode, expected.buildMode)
    }
  }
  const paginated = await versionService.adminRecords({
    appVersion: '4.6.7',
    buildMode: 'debug',
    page: '2',
    limit: '2'
  })
  assert.equal(paginated.total, 5)
  assert.equal(paginated.totalPages, 3)
  assert.deepEqual(sortedIds(paginated.items), [2, 3])
  const derived = await versionService.publicRecords({
    appVersion: '4.6.7',
    buildMode: 'debug',
    socBrand: 'qualcomm',
    page: '2',
    limit: '2'
  })
  assert.equal(derived.total, 5)
  assert.deepEqual(sortedIds(derived.items), [2, 3])
  for (const facets of [
    await versionService.filters(),
    await versionService.publicFilters(),
    await versionService.adminFilters()
  ]) {
    assert.equal(
      facets.appVersions.filter((version) => version === '4.6.7').length,
      1
    )
    assert(!facets.appVersions.includes('4.6.7-debug'))
    assert(facets.appVersions.includes('4.6.7-rc.1-debug'))
    assert(facets.appVersions.includes('4.6.7-beta'))
    assert.deepEqual(facets.buildModes, [
      'debug',
      'profile',
      'release',
      'unknown'
    ])
  }
  let inserted
  const ingestService = new TelemetryService({
    telemetryPerf: {
      create: async ({ data }) => {
        inserted = data
      }
    }
  })
  for (const [appVersion, buildMode] of [
    ['4.6.7-Debug', undefined],
    ['4.6.7-profile', 'unknown'],
    ['4.6.7-debug', 'release'],
    ['4.6.7-rc.1', undefined]
  ]) {
    const accepted = await ingestService.ingest(
      {
        schemaVersion: 1,
        installId: 'test-only-install',
        device: {
          socName: 'Snapdragon 7s Gen 2',
          socBrand: 'qualcomm',
          os: 'android'
        },
        app: { version: appVersion, build: '749', buildMode },
        model: {
          name: 'test',
          fileName: 'test.bin',
          sha256: 'test',
          backend: 'qnn'
        },
        perf: { prefillSpeed: 20, decodeSpeed: 10 },
        clientTimestamp: Date.now()
      },
      null
    )
    assert.equal(accepted.accepted, true)
    assert.deepEqual(
      { appVersion: inserted.appVersion, buildMode: inserted.buildMode },
      normalizeTelemetryAppDimensions(appVersion, buildMode)
    )
  }
  assert.deepEqual(
    versionRows,
    originalVersionRows,
    'historical version/mode records must not be rewritten'
  )

  assert.deepEqual(
    await versionDatabase.storedVersions(),
    originalVersionRows.map(({ id, appVersion, buildMode }) => ({
      id,
      appVersion,
      buildMode
    })),
    'database history must retain original versions and modes'
  )

  // Exercise the actual HTTP handler, including content negotiation and decode parity.
  const express = backendRequire('express')
  const app = express()
  const payload = Array.from({ length: 30 }, () => first[0])
  const controller = new TelemetryController({
    leaderboard: async () => payload
  })
  app.get('/', (req, res, next) => controller.leaderboard(req, res).catch(next))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const http = require('node:http')
    const request = (encoding) =>
      new Promise((resolve, reject) => {
        http
          .get(
            {
              hostname: '127.0.0.1',
              port: server.address().port,
              path: '/',
              headers: { 'accept-encoding': encoding }
            },
            (res) => {
              const chunks = []
              res.on('data', (chunk) => chunks.push(chunk))
              res.on('end', () =>
                resolve({ headers: res.headers, body: Buffer.concat(chunks) })
              )
            }
          )
          .on('error', reject)
      })
    const packed = await request('gzip')
    assert.equal(packed.headers['content-encoding'], 'gzip')
    assert.match(packed.headers.vary, /Accept-Encoding/)
    assert.equal(packed.headers['cache-control'], 'public, max-age=15')
    assert.deepEqual(JSON.parse(gunzipSync(packed.body)), payload)
    const plain = await request('gzip;q=0, identity')
    assert.equal(plain.headers['content-encoding'], undefined)
    assert.deepEqual(JSON.parse(plain.body), payload)
  } finally {
    server.close()
  }
  console.log(
    'telemetry: SQLite version/mode filters, ingestion, normalization, vendor filters, drilldown, cache, privacy, pagination and gzip passed'
  )
}
main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    for (const { prisma, directory } of databases) {
      await prisma.$disconnect()
      rmSync(directory, { recursive: true, force: true })
    }
  })
