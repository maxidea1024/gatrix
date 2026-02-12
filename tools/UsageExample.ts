
import { GatrixClient } from '@gatrix/sdk';
const client = new GatrixClient();
function checkFlags() {
    // 1. Boolean check (isEnabled)
    if (client.isEnabled('slot-auto-spin')) {
        console.log('Auto Spin ON');
    }

    // 2. Number check (numberVariation - corrected from variationNumber)
    const speed = client.numberVariation('slot-spin-speed', 1.0);

    // 3. String check (stringVariation)
    const wildSymbol = client.stringVariation('slot-wild-symbol', 'default');

    // 4. Backward compatibility check (new-feature-m514)
    if (client.isEnabled('new-feature-m514')) {
        console.log('Legacy feature check');
    }
}
