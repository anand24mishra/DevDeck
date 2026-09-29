import { DevDeckApi } from '../shared/types'

declare global {
  interface Window {
    api: DevDeckApi
  }
}
