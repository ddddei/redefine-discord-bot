const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { commands } = require('../src/deploy-commands');

const DOC_PATH = path.join(__dirname, '..', 'docs', 'operator-command-guide.md');

function getCommandJson(commandName) {
  const command = commands.find((item) => item.name === commandName);
  assert.ok(command, `slash command missing: ${commandName}`);
  return command;
}

function getStringOptionChoices(commandName, optionName) {
  const command = getCommandJson(commandName);
  const option = (command.options || []).find((item) => item.name === optionName);
  assert.ok(option, `${commandName} option missing: ${optionName}`);
  return option.choices || [];
}

function assertDocsIncludeChoices(doc, commandName, optionName) {
  const choices = getStringOptionChoices(commandName, optionName);
  assert.ok(choices.length > 0, `${commandName} ${optionName} choices missing`);

  choices.forEach((choice) => {
    assert.ok(
      doc.includes(choice.name),
      `docs/operator-command-guide.md missing ${commandName} ${optionName} choice name: ${choice.name}`
    );
  });
}

function main() {
  const doc = fs.readFileSync(DOC_PATH, 'utf8');

  assertDocsIncludeChoices(doc, '운영현황', '종류');
  assertDocsIncludeChoices(doc, '운영내보내기', '종류');
  assertDocsIncludeChoices(doc, '운영내보내기', '형식');
  assertDocsIncludeChoices(doc, '미션관리', '작업');
  assertDocsIncludeChoices(doc, '상점관리', '작업');
  assertDocsIncludeChoices(doc, '상점관리', '유형');

  console.log('slash command docs consistency test passed');
}

main();
