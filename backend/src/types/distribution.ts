export enum DistributionType {
  macosHF = 'macosHF', // macos dmg file in huggingface
  macosAF = 'macosAF', // macos app file in aifasthub
  macosGR = 'macosGR', // macos dmg file in github release
  macosHFM = 'macosHFM', // macos dmg file in hf-mirror

  linuxHF = 'linuxHF', // linux tar.gz file in huggingface
  linuxAF = 'linuxAF', // linux tar.gz file in aifasthub
  linuxGR = 'linuxGR', // linux tar.gz file in github release
  linuxHFM = 'linuxHFM', // linux tar.gz file in hf-mirror

  winHF = 'winHF', // win installer file in huggingface
  winAF = 'winAF', // win installer file in aifasthub
  winGR = 'winGR', // win installer file in github release
  winHFM = 'winHFM', // win installer file in hf-mirror

  winZipHF = 'winZipHF', // win zip file in huggingface
  winZipAF = 'winZipAF', // win zip file in aifasthub
  winZipGR = 'winZipGR', // win zip file in github release
  winZipHFM = 'winZipHFM', // win zip file in hf-mirror

  winArm64HF = 'winArm64HF', // win arm64 installer file in huggingface
  winArm64AF = 'winArm64AF', // win arm64 installer file in aifasthub
  winArm64GR = 'winArm64GR', // win arm64 installer file in github release
  winArm64HFM = 'winArm64HFM', // win arm64 installer file in hf-mirror

  winArm64ZipHF = 'winArm64ZipHF', // win arm64 zip file in huggingface
  winArm64ZipAF = 'winArm64ZipAF', // win arm64 zip file in aifasthub
  winArm64ZipGR = 'winArm64ZipGR', // win arm64 zip file in github release
  winArm64ZipHFM = 'winArm64ZipHFM', // win arm64 zip file in hf-mirror

  iOSTF = 'iOSTF', // ios testflight link
  iOSAS = 'iOSAS', // ios app store link

  androidHF = 'androidHF', // android apk file in huggingface
  androidAF = 'androidAF', // android apk file in aifasthub
  androidGR = 'androidGR', // android apk file in github release
  androidHFM = 'androidHFM', // android apk file in hf-mirror
  androidPgyerAPK = 'androidPgyerAPK', // android apk file in pgyer
  androidPgyer = 'androidPgyer', // android apk download page link hosted on pgyer
  androidGooglePlay = 'androidGooglePlay', // android play store link
}
