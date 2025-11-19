/**
 * Backward compatibility entry for GatrixSDK
 *
 * This file exists so that imports like "../src/GatrixSDK" (used in tests
 * and possibly by external code) continue to work after the main SDK class
 * was renamed to GatrixServerSDK.
 */

export { GatrixServerSDK as GatrixSDK } from './GatrixServerSDK';

