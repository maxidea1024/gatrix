/// <reference types="vite/client" />

// Global constants injected by Vite at build time
declare const __APP_VERSION__: string;

// INI file module declaration
declare module '*.ini' {
  const content: Record<string, string>;
  export default content;
}
