export enum DistributionType {
  macosHF = 'macosHF',
  macosAF = 'macosAF',
  macosGR = 'macosGR',
  macosHFM = 'macosHFM',
  linuxHF = 'linuxHF',
  linuxAF = 'linuxAF',
  linuxGR = 'linuxGR',
  linuxHFM = 'linuxHFM',
  winHF = 'winHF',
  winAF = 'winAF',
  winGR = 'winGR',
  winHFM = 'winHFM',
  winZipHF = 'winZipHF',
  winZipAF = 'winZipAF',
  winZipGR = 'winZipGR',
  winZipHFM = 'winZipHFM',
  winArm64HF = 'winArm64HF',
  winArm64AF = 'winArm64AF',
  winArm64GR = 'winArm64GR',
  winArm64HFM = 'winArm64HFM',
  winArm64ZipHF = 'winArm64ZipHF',
  winArm64ZipAF = 'winArm64ZipAF',
  winArm64ZipGR = 'winArm64ZipGR',
  winArm64ZipHFM = 'winArm64ZipHFM',
  iOSTF = 'iOSTF',
  iOSAS = 'iOSAS',
  androidHF = 'androidHF',
  androidAF = 'androidAF',
  androidGR = 'androidGR',
  androidHFM = 'androidHFM',
  androidPgyerAPK = 'androidPgyerAPK',
  androidPgyer = 'androidPgyer',
  androidGooglePlay = 'androidGooglePlay',
}

export interface DistributionRecord {
  id: number;
  type: string;
  url: string;
  version: string;
  build: number | null;
  createdAt: string;
  updatedAt: string;
}

export type LatestDistributionsResponse = Partial<Record<DistributionType, DistributionRecord | null>>;

