/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Public URL of the backend API, e.g. https://hms-api.vercel.app/api (optional in local dev).
  // Only non-secret values may use the VITE_ prefix: they are embedded in the browser bundle.
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
