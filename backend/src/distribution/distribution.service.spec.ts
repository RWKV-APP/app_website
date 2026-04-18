import { DistributionService } from './distribution.service';

describe('DistributionService store build metadata', () => {
  const createService = () => {
    const prisma = {
      distribution: {
        findMany: jest.fn(),
      },
    };

    const releaseNotesService = {
      getExactReleaseNoteMetadata: jest.fn(),
      getLatestReleaseNoteMetadata: jest.fn(),
    };

    const service = new DistributionService(prisma as any, releaseNotesService as any);

    return {
      service,
      prisma,
      releaseNotesService,
    };
  };

  it('maps an exact semantic store version to the highest known build', async () => {
    const { service, prisma, releaseNotesService } = createService();
    prisma.distribution.findMany.mockResolvedValue([{ build: 712 }]);
    releaseNotesService.getExactReleaseNoteMetadata.mockResolvedValue(null);

    const result = await (service as any).resolveStoreBuildMetadata('4.3.11');

    expect(result).toEqual({ version: '4.3.11', build: 712 });
    expect(prisma.distribution.findMany).toHaveBeenCalledTimes(1);
    expect(releaseNotesService.getExactReleaseNoteMetadata).not.toHaveBeenCalled();
    expect(releaseNotesService.getLatestReleaseNoteMetadata).not.toHaveBeenCalled();
  });

  it('falls back to release note metadata only for an exact semantic version match', async () => {
    const { service, prisma, releaseNotesService } = createService();
    prisma.distribution.findMany.mockResolvedValue([]);
    releaseNotesService.getExactReleaseNoteMetadata.mockResolvedValue({
      version: '4.3.10',
      build: 711,
    });

    const result = await (service as any).resolveStoreBuildMetadata('4.3.10');

    expect(result).toEqual({ version: '4.3.10', build: 711 });
    expect(releaseNotesService.getExactReleaseNoteMetadata).toHaveBeenCalledWith({
      version: '4.3.10',
    });
    expect(releaseNotesService.getLatestReleaseNoteMetadata).not.toHaveBeenCalled();
  });

  it('does not advertise the latest release build when the store version is unknown', async () => {
    const { service, prisma, releaseNotesService } = createService();
    prisma.distribution.findMany.mockResolvedValue([]);
    releaseNotesService.getExactReleaseNoteMetadata.mockResolvedValue(null);
    releaseNotesService.getLatestReleaseNoteMetadata.mockResolvedValue({
      version: '4.3.11',
      build: 712,
    });

    const result = await (service as any).resolveStoreBuildMetadata('latest');

    expect(result).toEqual({ version: 'latest', build: null });
    expect(prisma.distribution.findMany).not.toHaveBeenCalled();
    expect(releaseNotesService.getExactReleaseNoteMetadata).not.toHaveBeenCalled();
    expect(releaseNotesService.getLatestReleaseNoteMetadata).not.toHaveBeenCalled();
  });

  it('does not advertise the latest release build when a semantic store version cannot be mapped', async () => {
    const { service, prisma, releaseNotesService } = createService();
    prisma.distribution.findMany.mockResolvedValue([]);
    releaseNotesService.getExactReleaseNoteMetadata.mockResolvedValue(null);
    releaseNotesService.getLatestReleaseNoteMetadata.mockResolvedValue({
      version: '4.3.11',
      build: 712,
    });

    const result = await (service as any).resolveStoreBuildMetadata('4.3.12');

    expect(result).toEqual({ version: '4.3.12', build: null });
    expect(prisma.distribution.findMany).toHaveBeenCalledTimes(1);
    expect(releaseNotesService.getExactReleaseNoteMetadata).toHaveBeenCalledWith({
      version: '4.3.12',
    });
    expect(releaseNotesService.getLatestReleaseNoteMetadata).not.toHaveBeenCalled();
  });
});
