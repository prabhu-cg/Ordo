/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to turn on privacy-first page-view counting for this deployment. Leave unset for none. */
  readonly VITE_ANALYTICS_DOMAIN?: string
  /** Where the counting script is loaded from. Defaults to Plausible's. Must be https. */
  readonly VITE_ANALYTICS_SRC?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
