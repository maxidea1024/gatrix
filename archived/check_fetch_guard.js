const fs = require('fs');
const path = require('path');

const base = 'c:/work/uwo/gatrix/packages/sdks/client-sdks';
const sdks = [
  ['JS', 'gatrix-js-client-sdk/src/features-client.ts'],
  ['Unity', 'gatrix-unity-client-sdk/src/Assets/Plugins/Gatrix/Runtime/FeaturesClient.Fetch.cs'],
  ['Flutter', 'gatrix-flutter-client-sdk/lib/src/features_client.dart'],
  ['Python', 'gatrix-python-client-sdk/gatrix/features_client.py'],
  ['Cocos2dx', 'gatrix-cocos2dx-client-sdk/src/GatrixFeaturesClient.cpp'],
  ['Godot', 'gatrix-godot-client-sdk/addons/gatrix_sdk/gatrix_features_client.gd'],
  ['Unreal', 'gatrix-unreal-client-sdk/Source/GatrixClientSDK/Private/GatrixFeaturesClient.cpp'],
];

const results = [];
for (const [name, f] of sdks) {
  const fullPath = path.join(base, f);
  try {
    const c = fs.readFileSync(fullPath, 'utf-8');
    results.push({
      name,
      partialFetch: /partial.*fetch|fetchPartial|fetch_partial|FetchPartial/i.test(c),
      fetchGuard: /isFetchingFlags|_isFetchingFlags|_is_fetching/i.test(c),
      pendingInvalidation: /pendingInvalidation|pending_invalidation|PendingInvalidation/i.test(c),
    });
  } catch (e) {
    results.push({ name, error: e.message });
  }
}
console.log(JSON.stringify(results, null, 2));
