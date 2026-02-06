/**
 * SDK Version - Injected at build time from package.json
 */

// These values are replaced by @rollup/plugin-replace during build
declare const __SDK_VERSION__: string;
declare const __SDK_NAME__: string;

export const SDK_VERSION: string =
  typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : '0.0.0-dev';
export const SDK_NAME: string =
  typeof __SDK_NAME__ !== 'undefined' ? __SDK_NAME__ : '@gatrix/js-client-sdk';
