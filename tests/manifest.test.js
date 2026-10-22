import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Extension Manifest & Config Validation', () => {
  it('should have a valid Manifest V3 json file with required fields', () => {
    const manifestPath = join(process.cwd(), 'manifest.json');
    assert.ok(existsSync(manifestPath), 'manifest.json must exist');

    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    assert.equal(manifest.manifest_version, 3);
    assert.ok(manifest.name.includes('FB Job Hunter'));
    assert.ok(manifest.permissions.includes('storage'));
    assert.ok(manifest.action.default_popup.includes('popup.html'));
    assert.ok(manifest.background.service_worker.includes('service-worker.js'));
    assert.ok(Array.isArray(manifest.content_scripts));
  });
});
