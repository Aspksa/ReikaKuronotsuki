'use strict';
// Pre-launch test runner: node tests/run.js  (exit code 0 = everything passed).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(dir, f));
console.log(`Запуск тестов: ${files.length} файл(ов)...`);
const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], { stdio: 'inherit' });
if (result.status === 0) console.log('\nВсе тесты пройдены. Запускаю Рэйку.');
else console.log('\nТЕСТЫ НЕ ПРОЙДЕНЫ — запуск остановлен.');
process.exit(result.status === null ? 1 : result.status);
