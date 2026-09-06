const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const path = require('node:path')

const backendRequire = createRequire(
  path.join(__dirname, '../backend/package.json')
)
backendRequire('ts-node').register({
  project: path.join(__dirname, '../backend/tsconfig.json'),
  transpileOnly: true
})
const { RemoteConfigService } = backendRequire(
  './src/remote-config/remote-config.service'
)
const { RemoteConfigAdminController } = backendRequire(
  './src/remote-config/remote-config.admin.controller'
)
const { DistributionController } = backendRequire(
  './src/distribution/distribution.controller'
)
const { DistributionService } = backendRequire(
  './src/distribution/distribution.service'
)

async function main() {
  const configPath = backendRequire.resolve('./src/config')
  const cachedConfig = backendRequire.cache[configPath]
  const originalRepoId = process.env.HF_DATASETS_ID
  try {
    for (const [value, expected] of [
      [undefined, 'HaloWang/rwkv-chat'],
      ['', ''],
      ['  ', ''],
      [' HaloWang/rwkv-chat ', 'HaloWang/rwkv-chat']
    ]) {
      if (value === undefined) delete process.env.HF_DATASETS_ID
      else process.env.HF_DATASETS_ID = value
      delete backendRequire.cache[configPath]
      assert.equal(
        backendRequire('./src/config').Config.huggingface.repoId,
        expected
      )
    }
  } finally {
    if (originalRepoId === undefined) delete process.env.HF_DATASETS_ID
    else process.env.HF_DATASETS_ID = originalRepoId
    backendRequire.cache[configPath] = cachedConfig
  }

  const metadata = { size: 11, timestamp: 456, sha256: 'a'.repeat(64) }
  const distributions = Object.fromEntries(
    [
      'winMS',
      'winHF',
      'winArm64MS',
      'linuxMS',
      'androidMS',
      'androidHF',
      'macosMS',
      'iOSAS'
    ].map((type, id) => [
      type,
      {
        id,
        type,
        url: `https://example.test/${type}`,
        version: '4.7.2',
        build: 754,
        createdAt: new Date(0),
        updatedAt: new Date(0)
      }
    ])
  )
  distributions.androidGooglePlay = {
    ...distributions.androidMS,
    type: 'androidGooglePlay',
    version: 'latest',
    build: null
  }
  distributions.macosGR = null
  const distributionRecords = Object.values(distributions).filter(Boolean)
  for (const type of ['winMS', 'linuxMS', 'androidMS', 'winArm64MS', 'macosGR']) {
    distributionRecords.unshift({
      ...distributions.androidMS,
      type,
      url: `https://example.test/${type}/4.8.0`,
      version: '4.8.0',
      build: 755
    })
  }
  const distributionService = new DistributionService({
    distribution: { findMany: async () => distributionRecords }
  }, {})
  const distributionController = new DistributionController(distributionService)
  const appRequest = {
    headers: { 'application-build-number': '754' },
    query: {},
    url: '/distributions/latest'
  }
  const appResult =
    await distributionController.getLatestDistributions(appRequest)
  for (const type of [
    'winMS',
    'winHF',
    'linuxMS',
    'winArm64MS',
    'androidMS',
    'androidHF',
    'androidGooglePlay',
    'macosMS',
    'iOSAS'
  ]) {
    assert.equal(appResult[type].version, '4.7.2')
    assert.equal(appResult[type].build, 754)
  }
  assert.equal(appResult.macosGR, null)
  assert.equal(appResult.androidMS.url, 'https://rwkv.halowang.cloud/')
  const rawResult = await distributionController.getLatestDistributions({
    ...appRequest,
    headers: {}
  })
  assert.equal(rawResult.winHF.build, 754)
  assert.equal(rawResult.winHF.url, 'https://example.test/winHF')
  for (const type of ['winMS', 'linuxMS', 'androidMS', 'winArm64MS']) {
    assert.equal(rawResult[type].version, '4.7.2')
    assert.equal(rawResult[type].build, 754)
    assert.equal(rawResult[type].url, distributions[type].url)
  }
  assert.equal(rawResult.androidGooglePlay.version, 'latest')
  assert.equal(rawResult.macosGR, null)
  assert.equal(distributions.winHF.build, 754)
  distributionRecords.unshift({
    ...distributions.androidMS,
    version: '4.10.0',
    build: 756
  })
  await distributionService.refreshLatestSnapshotAfterSync()
  const filteredResult = await distributionController.getLatestDistributions({
    ...appRequest,
    query: {},
    url: '/distributions/latest?key%3DandroidHF%26key%3DmacosMS'
  })
  assert.deepEqual(Object.keys(filteredResult), ['androidHF', 'macosMS'])
  assert.equal(filteredResult.androidHF.version, '4.7.2')
  assert.equal(filteredResult.androidHF.build, 754)
  assert.equal(filteredResult.macosMS.build, 754)

  const records = []
  const activities = []
  const calls = []
  const service = new RemoteConfigService({
    remoteConfig: {
      create: async ({ data }) => {
        const record = {
          ...data,
          id: records.length + 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        records.push(record)
        return record
      }
    },
    remoteConfigActivity: { create: async ({ data }) => activities.push(data) }
  })
  service.getModelScopeFileMetadata = async (target) => {
    calls.push({ source: 'modelscope', target })
    return metadata
  }
  service.getHuggingFaceFileMetadata = async () => {
    calls.push({ source: 'huggingface' })
    return metadata
  }
  const controller = new RemoteConfigAdminController(service)
  const model = {
    url: `https://modelscope.cn/models/HaloWang1991/rwkv-weights/resolve/${'b'.repeat(40)}/artifacts/test.mollm`,
    availableIn: ['modelscope'],
    fileSize: metadata.size,
    sha256: metadata.sha256
  }
  const legacy = {
    url: 'https://huggingface.co/HaloWang/rwkv-weights/resolve/main/legacy.gguf',
    fileSize: 3,
    date: 123
  }
  const upload = (models, options = {}) =>
    controller.uploadConfig(
      {
        fileName: 'latest.json',
        content: JSON.stringify({ chat: { model_config: models } }),
        modelScopeOnly: true,
        ...options
      },
      { adminUser: 'test' }
    )

  for (const fileName of ['latest.json', '755.json']) {
    calls.length = 0
    const result = await upload([model, legacy], { fileName })
    assert.equal(result.success, true)
    assert.deepEqual(
      calls.map((call) => call.source),
      ['modelscope', 'modelscope']
    )
    assert.equal(calls[1].target.repoId, 'HaloWang1991/rwkv-weights')
    assert.match(
      result.warnings.join('\n'),
      /Hugging Face verification was explicitly deferred/
    )
    assert.equal(
      JSON.parse(activities.at(-1).detail).validationSource,
      'modelscope'
    )
    const saved = JSON.parse(records.at(-1).content).chat.model_config
    assert.equal(saved[0].date, metadata.timestamp)
    assert.equal(saved[1].fileSize, metadata.size)
    assert.equal(saved[1].date, legacy.date)
  }
  calls.length = 0
  const rejects = [
    { ...model, url: model.url.replace('/rwkv-weights/', '/unapproved/') },
    { ...model, url: model.url.replace('b'.repeat(40), 'master') },
    { ...model, url: model.url.replace('/artifacts/', '/other/') },
    { ...model, fileSize: 12 },
    { ...model, sha256: undefined },
    { ...model, sha256: 'c'.repeat(64) },
    { ...model, availableIn: ['modelscope', 'huggingface'] },
    { ...legacy, sha256: 'c'.repeat(64) }
  ]
  for (const badModel of rejects)
    await assert.rejects(upload([badModel]), /Upload blocked/)
  await assert.rejects(
    upload([model], { modelScopeOnly: 'true' }),
    /must be a boolean/
  )
  await assert.rejects(
    upload([model], { modelScopeOnly: false }),
    /Formal weights also require/
  )
  assert.ok(calls.every((call) => call.source === 'modelscope'))

  // Existing TMP uploads and default dual-source validation remain available.
  await upload(
    [
      {
        ...model,
        url: model.url.replace('/rwkv-weights/', '/rwkv-weights-tmp/')
      }
    ],
    { modelScopeOnly: false }
  )
  calls.length = 0
  await upload([legacy], { modelScopeOnly: false })
  assert.deepEqual(calls.map((call) => call.source).sort(), [
    'huggingface',
    'modelscope'
  ])
  service.getHuggingFaceFileMetadata = async () => ({
    ...metadata,
    sha256: 'd'.repeat(64)
  })
  await assert.rejects(
    upload([legacy], { modelScopeOnly: false }),
    /different SHA-256/
  )
  console.log(
    'ModelScope config checks passed; all provider responses were mocked, with no network or database writes.'
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
