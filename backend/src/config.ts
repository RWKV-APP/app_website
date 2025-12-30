export const Config = {
  huggingface: {
    repoId: process.env.HF_DATASETS_ID || process.env.HF_DATASETS_ID || '',
    token: process.env.HF_TOKEN || '',
    endpoint: process.env.HF_ENDPOINT || 'https://huggingface.co',
  },
  github: {
    repo: process.env.GITHUB_REPO || 'RWKV-APP/RWKV_APP',
    token: process.env.GITHUB_TOKEN || '',
  },
  pgyer: {
    apiKey: process.env.PGYER_API_KEY || '',
    appKey: process.env.PGYER_APP_KEY || 'rwkvchat',
  },
};
