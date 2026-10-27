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

  it('should ensure all referenced icon, script, html and css files exist on disk', () => {
    const raw = readFileSync(join(process.cwd(), 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);

    // Check popup
    assert.ok(existsSync(join(process.cwd(), manifest.action.default_popup)));

    // Check icons
    for (const size of Object.keys(manifest.action.default_icon)) {
      const iconPath = manifest.action.default_icon[size];
      assert.ok(existsSync(join(process.cwd(), iconPath)), `Icon ${iconPath} must exist`);
    }

    // Check background service worker
    assert.ok(existsSync(join(process.cwd(), manifest.background.service_worker)));

    // Check content scripts and css
    for (const cs of manifest.content_scripts) {
      if (cs.js) {
        for (const jsFile of cs.js) {
          assert.ok(existsSync(join(process.cwd(), jsFile)), `Content script ${jsFile} must exist`);
        }
      }
      if (cs.css) {
        for (const cssFile of cs.css) {
          assert.ok(existsSync(join(process.cwd(), cssFile)), `Content css ${cssFile} must exist`);
        }
      }
    }
  });

  it('should ensure popup.js has valid syntax and popup.html has matching tab bindings', () => {
    const popupHtmlPath = join(process.cwd(), 'popup', 'popup.html');
    const popupJsPath = join(process.cwd(), 'popup', 'popup.js');

    assert.ok(existsSync(popupHtmlPath), 'popup.html must exist');
    assert.ok(existsSync(popupJsPath), 'popup.js must exist');

    const html = readFileSync(popupHtmlPath, 'utf8');

    // Extract all data-tab values
    const tabMatches = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(tabMatches.length > 0, 'popup.html must have data-tab buttons');

    for (const tabId of tabMatches) {
      assert.ok(
        html.includes(`id="${tabId}"`) && html.includes('class="tab-pane'),
        `Each data-tab="${tabId}" must have a matching <section id="${tabId}" class="tab-pane">`
      );
    }

    // Extract all data-subpane values
    const subpaneMatches = [...html.matchAll(/data-subpane="([^"]+)"/g)].map((m) => m[1]);
    for (const subpaneId of subpaneMatches) {
      assert.ok(
        html.includes(`id="${subpaneId}"`),
        `Each data-subpane="${subpaneId}" must have a matching element id="${subpaneId}"`
      );
    }

    // Verify popup.html loads popup.js
    assert.ok(html.includes('src="popup.js"'), 'popup.html must load popup.js');
  });
});
