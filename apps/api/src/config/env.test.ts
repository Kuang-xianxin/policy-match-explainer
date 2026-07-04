import { describe, expect, it } from 'vitest';
import { DEFAULT_DOUBAO_MODEL, normalizeDoubaoModel, readEnvValue } from './env.js';

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

  it('defaults Doubao web search to the enabled Seed 2.0 mini model id', () => {
    expect(DEFAULT_DOUBAO_MODEL).toBe('doubao-seed-2-0-mini-260428');
  });

  it('normalizes Doubao display names to Ark model ids', () => {
    expect(normalizeDoubaoModel('Doubao-Seed-2.0-mini')).toBe(DEFAULT_DOUBAO_MODEL);
    expect(normalizeDoubaoModel(' doubao-seed-2-0-mini-260428 ')).toBe(DEFAULT_DOUBAO_MODEL);
    expect(normalizeDoubaoModel('custom-ark-endpoint-id')).toBe('custom-ark-endpoint-id');
    expect(normalizeDoubaoModel(undefined)).toBe(DEFAULT_DOUBAO_MODEL);
  });
});
