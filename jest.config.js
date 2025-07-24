const { createDefaultPreset } = require('ts-jest');

const tsJestPreset = createDefaultPreset();

/** @type {import('jest').Config} */
module.exports = {
  transform: {
    ...tsJestPreset.transform,
  },
  testEnvironment: 'node',
};
