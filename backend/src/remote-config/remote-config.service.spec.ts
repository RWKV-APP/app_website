import { RemoteConfig } from '@prisma/client';
import { RemoteConfigService } from './remote-config.service';

function makeRecord(
  fileName: string,
  effectiveBuild: number | null,
  createdAt = '2026-03-12T00:00:00.000Z',
): RemoteConfig {
  return {
    id: Math.floor(Math.random() * 100000),
    type: 'app_config',
    fileName,
    effectiveBuild,
    content: '{}\n',
    published: true,
    createdBy: 'test',
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

describe('RemoteConfigService.getDemoConfigForBuild', () => {
  function createService(records: RemoteConfig[]) {
    const prisma = {
      remoteConfig: {
        findMany: jest.fn().mockResolvedValue(records),
      },
      remoteConfigActivity: {
        findMany: jest.fn(),
      },
    } as any;

    return {
      prisma,
      service: new RemoteConfigService(prisma),
    };
  }

  it('returns the exact build-specific config when present', async () => {
    const records = [
      makeRecord('latest.json', null),
      makeRecord('600.json', 600),
      makeRecord('500.json', 500),
    ];
    const { service } = createService(records);

    await expect(service.getDemoConfigForBuild(600)).resolves.toMatchObject({
      fileName: '600.json',
    });
  });

  it('returns the next higher build-specific config for intermediate builds', async () => {
    const records = [
      makeRecord('latest.json', null),
      makeRecord('600.json', 600),
      makeRecord('500.json', 500),
      makeRecord('400.json', 400),
    ];
    const { service } = createService(records);

    await expect(service.getDemoConfigForBuild(450)).resolves.toMatchObject({
      fileName: '500.json',
    });
  });

  it('returns the lowest build-specific config for builds below the minimum', async () => {
    const records = [
      makeRecord('latest.json', null),
      makeRecord('300.json', 300),
      makeRecord('100.json', 100),
      makeRecord('200.json', 200),
    ];
    const { service } = createService(records);

    await expect(service.getDemoConfigForBuild(50)).resolves.toMatchObject({
      fileName: '100.json',
    });
  });

  it('returns latest.json when the build exceeds the highest build-specific config', async () => {
    const records = [
      makeRecord('latest.json', null),
      makeRecord('600.json', 600),
      makeRecord('500.json', 500),
    ];
    const { service } = createService(records);

    await expect(service.getDemoConfigForBuild(601)).resolves.toMatchObject({
      fileName: 'latest.json',
    });
  });

  it('returns latest.json when the build header is missing', async () => {
    const records = [
      makeRecord('latest.json', null),
      makeRecord('600.json', 600),
      makeRecord('500.json', 500),
    ];
    const { service } = createService(records);

    await expect(service.getDemoConfigForBuild(null)).resolves.toMatchObject({
      fileName: 'latest.json',
    });
  });
});
