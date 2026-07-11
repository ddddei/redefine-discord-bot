#!/usr/bin/env node
const { formatPrelaunchReadiness, runPrelaunchReadiness } = require('../src/prelaunchReadiness');

function main(argv = process.argv.slice(2), options = {}) {
  const result = runPrelaunchReadiness(options);
  const json = argv.includes('--json');
  const strict = argv.includes('--strict');
  const output = json ? JSON.stringify(result, null, 2) : formatPrelaunchReadiness(result);
  (options.stdout || process.stdout).write(`${output}\n`);
  return strict && !result.ok ? 1 : 0;
}

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  process.exitCode = main();
}

module.exports = { main };
