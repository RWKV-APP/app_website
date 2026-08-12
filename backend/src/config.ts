function getEnvValue(key: string, fallback = ''): string {
  const value = process.env[key]?.trim();
  return value ? value : fallback;
}

export const Config = {
  huggingface: {
    repoId: getEnvValue('HF_DATASETS_ID', 'HaloWang/rwkv-chat'),
    token: getEnvValue('HF_TOKEN'),
    endpoint: getEnvValue('HF_ENDPOINT', 'https://huggingface.co'),
  },
  modelscope: {
    endpoint: getEnvValue('MODELSCOPE_ENDPOINT', 'https://modelscope.cn'),
    repoId: getEnvValue('MODELSCOPE_REPO_ID', 'HaloWang1991/rwkv-chat'),
    revision: getEnvValue('MODELSCOPE_REVISION', 'master'),
    token: getEnvValue('MODELSCOPE_API_TOKEN'),
  },
  github: {
    repo: getEnvValue('GITHUB_REPO', 'RWKV-APP/RWKV_APP'),
    token: getEnvValue('GITHUB_TOKEN'),
    webhookSecret: getEnvValue('GITHUB_WEBHOOK_SECRET'),
  },
  pgyer: {
    apiKey: getEnvValue('PGYER_API_KEY'),
    appKey: getEnvValue('PGYER_APP_KEY', 'rwkvchat'),
  },
};
