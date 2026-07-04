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

  it('prefers the standard Ark key before the legacy Doubao key alias', () => {
    process.env.TEST_ARK_API_KEY = 'ark-value';
    process.env.TEST_DOUBAO_API_KEY = 'doubao-value';

    const result = readEnvValue(['TEST_ARK_API_KEY', 'TEST_DOUBAO_API_KEY']);

    expect(result.value).toBe('ark-value');
    expect(result.source).toBe('TEST_ARK_API_KEY (process env)');

    delete process.env.TEST_ARK_API_KEY;
    delete process.env.TEST_DOUBAO_API_KEY;
  });
});
