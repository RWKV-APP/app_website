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
