export const REMOTE_CONFIG_TYPES = {
  appConfig: 'app_config',
  suggestions: 'suggestions'
} as const

export const REMOTE_CONFIG_ACTIONS = {
  login: 'login',
  logout: 'logout',
  upload: 'upload',
  publish: 'publish',
  rollback: 'rollback',
  download: 'download',
  downloadArchive: 'download_archive'
} as const

export const APP_CONFIG_SECTIONS = [
  'chat',
  'albatross',
  'roleplay',
  'world',
  'tts',
  'othello',
  'sudoku'
] as const

export type RemoteConfigType =
  (typeof REMOTE_CONFIG_TYPES)[keyof typeof REMOTE_CONFIG_TYPES]

export type RemoteConfigAction =
  (typeof REMOTE_CONFIG_ACTIONS)[keyof typeof REMOTE_CONFIG_ACTIONS]

export type AppConfigSection = (typeof APP_CONFIG_SECTIONS)[number]
