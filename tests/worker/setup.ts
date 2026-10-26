/// <reference path="../../worker-configuration.d.ts" />
/// <reference path="../../node_modules/@cloudflare/vitest-plugin/types/cloudflare-test.d.ts" />

import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  const testEnv = env as unknown as {
    DB: D1Database;
    TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
  };
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});
