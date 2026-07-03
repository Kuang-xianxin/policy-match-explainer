import { describe, expect, it } from 'vitest';
import { readEnvValue } from './env.js';

describe('env lookup', () => {
  it('supports the DEEPSEEK_API_KET alias before the standard key name', () => {
    process.env.TEST_DEEPSEEK_API_KET = 'ket-value';
    process.env.TEST_DEEPSEEK_API_KEY = 'key-value';

    const result = readEnvValue(['TEST_DEEPSEEK_API_KET', 'TEST_DEEPSEEK_API_KEY']);

    expect(result.value).toBe('ket-value');
    expect(result.source).toBe('TEST_DEEPSEEK_API_KET (process env)');

    delete process.env.TEST_DEEPSEEK_API_KET;
    delete process.env.TEST_DEEPSEEK_API_KEY;
  });
});
