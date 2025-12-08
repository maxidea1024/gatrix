const fs = require('fs');

const loctab = JSON.parse(fs.readFileSync('packages/backend/src/contents/cms/loctab.json', 'utf8'));
const char = JSON.parse(fs.readFileSync('packages/backend/cms/Character.json', 'utf8'));

// Get character 21100451
const c = char.Character['21100451'];

console.log('Character 21100451:');
console.log('  firstName:', JSON.stringify(c.firstName));
console.log('  particle:', JSON.stringify(c.particle));
console.log('  familyName:', JSON.stringify(c.familyName));

// Simulate makeCharacterDisplayNameCn
let firstName = c.firstName || '';
let familyName = c.familyName || '';
let particle = c.particle || '';

let firstNameOriginal = firstName;
let familyNameOriginal = familyName;
let particleOriginal = particle;

// Handle @ separator
if (firstName.includes('@')) {
  const arr = firstName.split('@');
  firstNameOriginal = arr[0].trim();
  firstName = arr[arr.length - 1].trim();
}

if (familyName.includes('@')) {
  const arr = familyName.split('@');
  familyNameOriginal = arr[0].trim();
  familyName = arr[arr.length - 1].trim();
}

if (particle.includes('@')) {
  const arr = particle.split('@');
  particleOriginal = arr[0].trim();
  particle = arr[arr.length - 1].trim();
}

console.log('\nAfter @ processing:');
console.log('  firstName:', JSON.stringify(firstName), '  original:', JSON.stringify(firstNameOriginal));
console.log('  particle:', JSON.stringify(particle), '  original:', JSON.stringify(particleOriginal));
console.log('  familyName:', JSON.stringify(familyName), '  original:', JSON.stringify(familyNameOriginal));

// Translate
const firstNameCn = firstName ? (loctab[firstNameOriginal] || loctab[firstName] || firstName) : '';
const familyNameCn = familyName ? (loctab[familyNameOriginal] || loctab[familyName] || familyName) : '';
const particleCn = particle ? (loctab[particleOriginal] || loctab[particle] || particle) : '';

console.log('\nTranslations:');
console.log('  firstNameCn:', JSON.stringify(firstNameCn));
console.log('  particleCn:', JSON.stringify(particleCn));
console.log('  familyNameCn:', JSON.stringify(familyNameCn));

// Build name
let mateNameCn = firstNameCn;
if (particleCn) {
  mateNameCn += particleCn;
}
if (familyNameCn) {
  mateNameCn += (mateNameCn ? ' ' : '') + familyNameCn;
}

console.log('\nFinal name:', mateNameCn);

