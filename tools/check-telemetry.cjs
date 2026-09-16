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

async function main() {
  let reads = 0
  let fail = false
  const rows = [10, 20, 30].map((speed, index) => ({
    id: index + 1,
    os: 'android',
    socName: 'sm8250',
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
  const prisma = {
    telemetryPerf: {
      findMany: async ({ select, skip = 0, take = rows.length }) => {
        reads++
        if (fail) throw new Error('temporary database failure')
        assert.equal(select.installIdHash, undefined)
        return rows
          .slice(skip, skip + take)
          .map((row) =>
            Object.fromEntries(
              Object.keys(select).map((key) => [key, row[key] ?? null])
            )
          )
      },
      count: async () => rows.length
    }
  }
  const service = new TelemetryService(prisma)
  const [first, concurrent] = await Promise.all([
    service.leaderboard({ limit: '5000' }),
    service.leaderboard({ limit: '5000' })
  ])
  assert.equal(reads, 1, 'identical in-flight queries must share a read')
  assert.deepEqual(first, concurrent)
  assert.equal(first.length, 1)
  assert.equal(first[0].socName, 'Snapdragon 865')
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
        socName: 'Snapdragon 865',
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
    ['sm8250', 'Snapdragon 865', 'snapdragon 865', 'qualcomm'],
    ['tensor_soc', 'Google Tensor', 'google tensor', 'google'],
    ['pixel7', 'Google Tensor G2', 'google tensor g2', 'google'],
    ['mt6765', 'MediaTek Helio P35', 'mediatek helio p35', 'mediatek']
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
  const normalizedService = new TelemetryService({
    telemetryPerf: {
      findMany: async ({ select, where = {} }) =>
        historicalRows
          .filter((row) =>
            Object.entries(where).every(([key, value]) =>
              typeof value === 'object'
                ? value.in.includes(row[key])
                : row[key] === value
            )
          )
          .map((row) =>
            Object.fromEntries(
              Object.keys(select).map((key) => [key, row[key] ?? null])
            )
          )
    }
  })
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
  const kirin = normalized.filter((row) => row.socName.startsWith('kirin'))
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
  assert.equal(qualcomm.total, 3, 'Kirin must not match the Qualcomm filter')
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
    facets.socs.filter((name) => name.toLowerCase() === 'snapdragon 865')
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
    'telemetry: normalization, vendor filters, drilldown, cache, public field allowlist, limits and gzip passed'
  )
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
