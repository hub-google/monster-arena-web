const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\ET\\.gemini\\antigravity-ide\\brain\\d064db11-cfc8-4a4a-b3ff-a719741f3038\\.system_generated\\logs\\transcript.jsonl', 'utf-8').split('\n');
const firstInput = lines.find(l => l.includes('"step_index":0,'));
if (firstInput) {
  const data = JSON.parse(firstInput);
  console.log(data.content);
}
