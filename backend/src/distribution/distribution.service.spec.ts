import { DistributionService } from './distribution.service';

describe('DistributionService', () => {
  let prisma: {
    distribution: {
      findMany: jest.Mock;
    };
  };
  let releaseNotesService: {
    getExactReleaseNoteMetadata: jest.Mock;
    getLatestReleaseNoteMetadata: jest.Mock;
  };
  let service: DistributionService;

  beforeEach(() => {
    prisma = {
      distribution: {
        findMany: jest.fn(),
      },
    };
    releaseNotesService = {
      getExactReleaseNoteMetadata: jest.fn(),
      getLatestReleaseNoteMetadata: jest.fn(),
    };

    service = new DistributionService(prisma as any, releaseNotesService as any);
  });

  it('ignores misleading Play Store OS version snippets', () => {
    const html = `
      <script>
        AF_initDataCallback({
          key: 'ds:5',
          data: [{"141":[[["4.0.7"]],[[[36]],[[[24,"7.0"]]]]]}]
        });
      </script>
    `;

    expect((service as any).parsePlayStoreVersionFromHtml(html)).toBeNull();
  });

  it('extracts the Play Store app version from JSON-LD when available', () => {
    const html = `
      <script type="application/ld+json">
        {"softwareVersion":"4.2.6"}
      </script>
    `;

    expect((service as any).parsePlayStoreVersionFromHtml(html)).toBe('4.2.6');
  });

  it('falls back to the latest release note metadata when exact build mapping is missing', async () => {
    prisma.distribution.findMany.mockResolvedValue([]);
    releaseNotesService.getExactReleaseNoteMetadata.mockResolvedValue(null);
    releaseNotesService.getLatestReleaseNoteMetadata.mockResolvedValue({
      version: '4.2.6',
      build: 698,
    });

    await expect((service as any).resolveStoreBuildMetadata('4.2.4')).resolves.toEqual({
      version: 'latest',
      build: 698,
    });
  });
});
