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
    'telemetry: cache coalescing, freshness, retry, public field allowlist, limits and gzip negotiation passed'
  )
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
