# SDK Cleanup Plan

## Current SDK folder names
| Folder | Type | Needs rename? |
|--------|------|---------------|
| gatrix-js-client-sdk | Web/JS | ✅ Already has "client" |
| gatrix-react-sdk | Web/React | ❓ → gatrix-react-client-sdk |
| gatrix-vue-sdk | Web/Vue | ❓ → gatrix-vue-client-sdk |
| gatrix-svelte-sdk | Web/Svelte | ❓ → gatrix-svelte-client-sdk |
| gatrix-flutter-sdk | Mobile | ❓ → gatrix-flutter-client-sdk |
| gatrix-python-sdk | Server/General | ❓ → gatrix-python-client-sdk |
| gatrix-unity-sdk | Game engine | ✅ No change |
| gatrix-unreal-sdk | Game engine | ✅ No change |
| gatrix-godot-sdk | Game engine | ✅ No change |
| gatrix-cocos2dx-sdk | Game engine | ✅ No change |

## Tasks
1. Remove `getFlag` from all client SDKs
2. Remove `getFlag` from code-refs tool tracking
3. Rename non-game-engine SDK folders to include "client"
