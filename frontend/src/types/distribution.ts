export { DistributionType } from '@app/contracts';

export interface DistributionRecord {
  id: number;
  type: string;
  url: string;
  version: string;
  build: number | null;
  createdAt: string;
  updatedAt: string;
}

export type LatestDistributionsResponse = Partial<
  Record<import('@app/contracts').DistributionType, DistributionRecord | null>
>;
