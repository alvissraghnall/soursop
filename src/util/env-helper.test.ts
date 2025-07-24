import { getRequiredEnv, getOptionalEnv } from './env-helper';

describe('Environment Utilities', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('getRequiredEnv', () => {
    it('returns the value if the environment variable is set', () => {
      process.env.MY_VAR = 'test-value';
      const result = getRequiredEnv('MY_VAR');
      expect(result).toBe('test-value');
    });

    it('throws an error if the environment variable is not set', () => {
      delete process.env.MY_VAR;
      expect(() => getRequiredEnv('MY_VAR')).toThrow(
        'Environment variable MY_VAR is required but not set'
      );
    });

    it('throws an error if the environment variable is an empty string', () => {
      process.env.MY_VAR = '';
      expect(() => getRequiredEnv('MY_VAR')).toThrow(
        'Environment variable MY_VAR is required but not set'
      );
    });
  });

  describe('getOptionalEnv', () => {
    it('returns the environment variable value if set', () => {
      process.env.MY_OPTIONAL_VAR = 'optional-value';
      const result = getOptionalEnv('MY_OPTIONAL_VAR', 'default-value');
      expect(result).toBe('optional-value');
    });

    it('returns the default value if the environment variable is not set', () => {
      delete process.env.MY_OPTIONAL_VAR;
      const result = getOptionalEnv('MY_OPTIONAL_VAR', 'default-value');
      expect(result).toBe('default-value');
    });

    it('returns an empty string if the environment variable is explicitly set to an empty string', () => {
      process.env.MY_OPTIONAL_VAR = '';
      const result = getOptionalEnv('MY_OPTIONAL_VAR', 'default-value');
      expect(result).toBe('');
    });
  });
});
