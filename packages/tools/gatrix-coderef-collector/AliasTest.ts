
const FLAG_NAMES = {
    SOUND: 'slot-sound',
    SPEED: 'slot-spin-speed'
};

function test() {
    const sound = gatrix.boolVariation(FLAG_NAMES.SOUND, true);
    const speed = gatrix.numberVariation(FLAG_NAMES.SPEED, 1);
}
