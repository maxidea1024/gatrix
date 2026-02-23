import gatrix from '@gatrix/sdk';

// Correct usage
const isNewShop = gatrix.boolVariation('new_shop_ui', false);
const rate = gatrix.numberVariation('discount_rate', 0);
const msg = gatrix.stringVariation('welcome_message', 'hello');

// Archived flag usage (should warn)
const legacy = gatrix.boolVariation('legacy_checkout', false);

// Undefined flag (should error)
const unknown = gatrix.boolVariation('nonexistent_flag', false);

// Type mismatch (should error)
const wrongType = gatrix.stringVariation('discount_rate', 'default');

// Dynamic flag usage (should warn)
const flagKey = getFlagName();
const dynamic = gatrix.boolVariation(flagKey, false);

// Possible typo (should warn)
const typo = gatrix.boolVariation('new_shop_u', false);

// Commented out code (should be ignored)
// gatrix.boolVariation('should_be_ignored', false);
/* gatrix.numberVariation('also_ignored', 0); */

function getFlagName(): string {
    return 'some_flag';
}

console.log(isNewShop, rate, msg, legacy, unknown, wrongType, dynamic, typo);
