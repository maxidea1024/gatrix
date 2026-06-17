const fs = require('fs');
const file = 'packages/frontend/src/pages/argus/ArgusAnalyticsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace conflict 1 (ArrowUpIcon styling) with the HEAD version
const conflict1Regex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n[\s\S]*?>>>>>>> 2e9051edb[^\r\n]*\r?\n/m;
content = content.replace(conflict1Regex, '$1');

// Replace conflict 2 (Layout vs Inline content) with the incoming version (2e9051edb), but use formatted DateRangeSelector
const conflict2Regex = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> 2e9051edb[^\r\n]*\r?\n/m;
content = content.replace(conflict2Regex, (match, headPart, theirsPart) => {
  // Format the DateRangeSelector in theirsPart
  let modifiedTheirs = theirsPart.replace(
    /<DateRangeSelector value={dateRange} onChange={handleDateRangeChange} compact \/>/,
    '<DateRangeSelector\n            value={dateRange}\n            onChange={handleDateRangeChange}\n            compact\n          />'
  );
  return modifiedTheirs;
});

fs.writeFileSync(file, content);
