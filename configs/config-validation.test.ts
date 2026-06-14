import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validateSafeAreaConfig } from '@quacktrack/layout';
import { validateModuleRegistryConfig } from '@quacktrack/registry';
import { validateSponsorConfig } from '@quacktrack/sponsor-policy';

const configDirectory = dirname(fileURLToPath(import.meta.url));

function readConfig(filename: string): unknown {
  return JSON.parse(readFileSync(join(configDirectory, filename), 'utf8'));
}

describe('config validation', () => {
  it('validates module-registry.json against registry schemas', () => {
    expect(validateModuleRegistryConfig(readConfig('module-registry.json'))).toMatchObject({
      success: true
    });
  });

  it('validates sponsor-config.json against sponsor-policy schemas', () => {
    expect(validateSponsorConfig(readConfig('sponsor-config.json'))).toMatchObject({
      success: true
    });
  });

  it('validates safe-area-config.json against layout schemas', () => {
    expect(validateSafeAreaConfig(readConfig('safe-area-config.json'))).toMatchObject({
      success: true
    });
  });

  it('fails invalid config fixtures', () => {
    expect(
      validateModuleRegistryConfig({
        registryVersion: '0.1.0',
        entries: [
          {
            moduleStatus: 'production'
          }
        ]
      })
    ).toMatchObject({ success: false });

    expect(
      validateSponsorConfig({
        configVersion: '0.1.0',
        campaigns: []
      })
    ).toMatchObject({ success: false });

    expect(
      validateSafeAreaConfig({
        configVersion: '0.1.0',
        outputResolution: {
          width: 0,
          height: 1080
        },
        safeAreas: []
      })
    ).toMatchObject({ success: false });
  });
});
