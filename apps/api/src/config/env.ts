import dotenv from 'dotenv';
import { execFileSync } from 'node:child_process';

dotenv.config();

export interface EnvLookupResult {
  value?: string;
  source?: string;
}

function readWindowsRegistryEnv(name: string): EnvLookupResult | undefined {
  if (process.platform !== 'win32') return undefined;

  const locations = [
    { root: 'HKCU\\Environment', source: `${name} (Windows user env)` },
    {
      root: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
      source: `${name} (Windows machine env)`
    }
  ];

  for (const location of locations) {
    try {
      const output = execFileSync('reg', ['query', location.root, '/v', name], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const line = output
        .split(/\r?\n/)
        .map((item) => item.trim())
        .find((item) => item.startsWith(name));
      const match = line?.match(new RegExp(`^${name}\\s+REG_\\w+\\s+(.+)$`));
      const value = match?.[1]?.trim();
      if (value) return { value, source: location.source };
    } catch {
      continue;
    }
  }

  return undefined;
}

export function readEnvValue(names: string[]): EnvLookupResult {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { value, source: `${name} (process env)` };
  }

  for (const name of names) {
    const registryValue = readWindowsRegistryEnv(name);
    if (registryValue) return registryValue;
  }

  return {};
}

const isTestRuntime = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
const deepseekApiKey = isTestRuntime ? {} : readEnvValue(['DEEPSEEK_API_KET', 'DEEPSEEK_API_KEY']);

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://policy_user:policy_password@localhost:5432/policy_match',
  port: Number(process.env.API_PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  deepseekApiKey: deepseekApiKey.value,
  deepseekApiKeySource: deepseekApiKey.source,
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
};
