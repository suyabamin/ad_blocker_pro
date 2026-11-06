// src/background/migrations.ts
// Schema migrations framework (05_Schema §6)

import { browser } from '../shared/browser.js';
import {
  getStoredSchemaVersion,
  setStoredSchemaVersion,
} from '../shared/storage.js';
import { SCHEMA_VERSION } from '../shared/constants.js';

export type MigrationFn = () => Promise<void>;

// Ordered array of migrations. Index 0 corresponds to v1 -> v2, etc.
export const migrations: MigrationFn[] = [
  // Example future migration:
  // async () => { ... }
];

export async function runMigrations(): Promise<number> {
  const currentVersion = await getStoredSchemaVersion();
  if (currentVersion >= SCHEMA_VERSION) {
    return currentVersion;
  }

  // Backup current state before running any migrations
  const allData = await browser.storage.local.get(null);
  await browser.storage.local.set({
    [`backup_v${currentVersion}`]: {
      backedUpAt: Date.now(),
      data: allData,
    },
  });

  let version = currentVersion;
  for (let i = currentVersion; i < SCHEMA_VERSION; i++) {
    const migration = migrations[i - 1];
    if (migration) {
      await migration();
    }
    version = i + 1;
    await setStoredSchemaVersion(version);
  }

  await setStoredSchemaVersion(SCHEMA_VERSION);
  return SCHEMA_VERSION;
}
