const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  RemoteConfigService
} = require('./backend/dist/remote-config/remote-config.service')

const SHA256 = 'a'.repeat(64)
const LOCATION = {
  fileName: 'latest.json',
  sectionName: 'chat',
  modelIndex: 0
}

function createService() {
  return new RemoteConfigService({})
}

function testRepositoryMappings() {
  const service = createService()
  const formalTarget = service.parseHuggingFaceResolveUrl(
    'HaloWang/rwkv-weights/resolve/main/artifacts/rwkv7/chat/1.5b/qnn/model.rmpack'
  )
  assert.deepEqual(service.resolveModelScopeTarget(formalTarget, LOCATION), {
    repoId: 'HaloWang1991/rwkv-weights',
    revision: 'master',
    filePath: 'artifacts/rwkv7/chat/1.5b/qnn/model.rmpack'
  })

  const legacyTarget = service.parseHuggingFaceResolveUrl(
    'mollysama/rwkv-mobile-models/resolve/main/legacy/model.bin'
  )
  assert.deepEqual(service.resolveModelScopeTarget(legacyTarget, LOCATION), {
    repoId: 'RWKV/rwkv-mobile-models',
    revision: 'master',
    filePath: 'legacy/model.bin'
  })

  assert.throws(
    () =>
      service.resolveModelScopeTarget(
        { repoId: 'unmapped/repo', revision: 'main', filePath: 'model.bin' },
        LOCATION
      ),
    /no approved ModelScope mirror/
  )
}

async function testParallelValidationAndSync() {
  const service = createService()
  let huggingFaceStarted = false
  let modelScopeStarted = false
  let releaseHuggingFace
  let releaseModelScope

  service.getHuggingFaceFileMetadata = () => {
    huggingFaceStarted = true
    return new Promise((resolve) => {
      releaseHuggingFace = resolve
    })
  }
  service.getModelScopeFileMetadata = () => {
    modelScopeStarted = true
    return new Promise((resolve) => {
      releaseModelScope = resolve
    })
  }

  const model = {
    url: 'HaloWang/rwkv-weights/resolve/main/artifacts/rwkv7/chat/1.5b/qnn/model.rmpack',
    fileSize: 1,
    date: 1,
    sha256: SHA256
  }
  const validation = service.syncAppConfigRepositoryMetadata(
    { chat: { model_config: [model] } },
    'latest.json'
  )

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(
    huggingFaceStarted,
    true,
    'Hugging Face validation did not start'
  )
  assert.equal(
    modelScopeStarted,
    true,
    'ModelScope validation did not start in parallel'
  )

  releaseHuggingFace({ size: 42, timestamp: 123, sha256: SHA256 })
  releaseModelScope({ size: 42, timestamp: 456, sha256: SHA256 })
  const warnings = await validation

  assert.equal(model.fileSize, 42)
  assert.equal(model.date, 123)
  assert.match(warnings.join('\n'), /dual-source-verified/)
}

async function testMirrorMismatchBlocksUpload() {
  const service = createService()
  service.getHuggingFaceFileMetadata = async () => ({
    size: 42,
    timestamp: 123,
    sha256: SHA256
  })
  service.getModelScopeFileMetadata = async () => ({
    size: 42,
    timestamp: 456,
    sha256: 'b'.repeat(64)
  })

  await assert.rejects(
    service.syncAppConfigRepositoryMetadata(
      {
        chat: {
          model_config: [
            {
              url: 'HaloWang/rwkv-weights/resolve/main/model.rmpack',
              sha256: SHA256
            }
          ]
        }
      },
      'latest.json'
    ),
    /different SHA-256 digests/
  )
}

async function testMissingMirrorFileBlocksUpload() {
  const service = createService()
  service.getHuggingFaceFileMetadata = async () => ({
    size: 42,
    timestamp: 123,
    sha256: SHA256
  })
  service.getModelScopeFileMetadata = async () => {
    throw new Error('non-existent ModelScope file')
  }

  await assert.rejects(
    service.syncAppConfigRepositoryMetadata(
      {
        chat: {
          model_config: [
            {
              url: 'HaloWang/rwkv-weights/resolve/main/missing.rmpack',
              sha256: SHA256
            }
          ]
        }
      },
      'latest.json'
    ),
    /Upload blocked: concurrent Hugging Face and ModelScope validation could not complete/
  )
}

async function runLiveCheck(catalogPath, validateAllRows) {
  if (!catalogPath) {
    return null
  }

  const absoluteCatalogPath = path.resolve(catalogPath)
  const catalog = JSON.parse(fs.readFileSync(absoluteCatalogPath, 'utf8'))
  const models = catalog.chat?.model_config || []
  const formal = models.find((model) =>
    model.url?.startsWith('HaloWang/rwkv-weights/resolve/main/')
  )
  const legacy = models.find((model) =>
    model.url?.startsWith('mollysama/rwkv-mobile-models/resolve/main/')
  )
  assert.ok(
    formal,
    'No formal HaloWang/rwkv-weights row found in the live-check catalog'
  )
  assert.ok(
    legacy,
    'No legacy mollysama/rwkv-mobile-models row found in the live-check catalog'
  )

  const service = createService()
  const selectedModels = validateAllRows ? models : [formal, legacy]
  const result = await service.parseUpload({
    fileName: 'latest.json',
    content: JSON.stringify(
      validateAllRows ? catalog : { chat: { model_config: selectedModels } }
    )
  })
  if (validateAllRows) {
    const validatedModels = Object.values(result.parsed).flatMap((section) =>
      Array.isArray(section?.model_config) ? section.model_config : []
    )
    return {
      mode: 'all-catalog-rows',
      modelCount: validatedModels.length,
      formalRepositoryRows: validatedModels.filter((model) =>
        model.url?.startsWith('HaloWang/rwkv-weights/resolve/main/')
      ).length,
      legacyRepositoryRows: validatedModels.filter((model) =>
        model.url?.startsWith('mollysama/rwkv-mobile-models/resolve/main/')
      ).length
    }
  }

  const validatedModels = result.parsed.chat.model_config
  return {
    mode: 'representative-formal-and-legacy',
    rows: validatedModels.map((model) => ({
      url: model.url,
      fileSize: model.fileSize,
      date: model.date,
      sha256: model.sha256 || null
    }))
  }
}

async function run() {
  testRepositoryMappings()
  await testParallelValidationAndSync()
  await testMirrorMismatchBlocksUpload()
  await testMissingMirrorFileBlocksUpload()
  const args = process.argv.slice(2)
  const catalogPath = args.find((argument) => argument !== '--all')
  const liveRows = await runLiveCheck(catalogPath, args.includes('--all'))

  console.log(
    JSON.stringify(
      {
        repositoryMappings: 'passed',
        parallelValidation: 'passed',
        mismatchBlocking: 'passed',
        missingFileBlocking: 'passed',
        liveRows
      },
      null,
      2
    )
  )
}

run().catch((error) => {
  console.error('Remote-config repository validation failed:', error.message)
  process.exitCode = 1
})
