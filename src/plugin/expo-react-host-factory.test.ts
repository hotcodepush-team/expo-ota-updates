import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FIXTURES_PATH = join(__dirname, 'fixtures');

const FIXTURE_NAMES = readdirSync(FIXTURES_PATH, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(({ name }) => name);

// HotCodePushReactHost stands in for Expo's host factory on Android and was written against this one
const REFERENCE_FACTORY_EXPO_VERSION = '55.0.31';
const REFERENCE_FACTORY_SHA256 =
  '12c7a812e557bbc5c58238241065841e85b3d3b295c3910ebea733e33ce2f91e';

describe.each(FIXTURE_NAMES)("Expo's host factory in %s", fixtureName => {
  it('should equal the one HotCodePushReactHost was written against', () => {
    const factory = readFileSync(
      join(FIXTURES_PATH, fixtureName, 'ExpoReactHostFactory.kt'),
    );

    expect(
      createHash('sha256').update(factory).digest('hex'),
      `Expo's ExpoReactHostFactory.kt in ${fixtureName} differs from the one HotCodePushReactHost was written against (expo ${REFERENCE_FACTORY_EXPO_VERSION}). Compare it with HotCodePushReactHost.kt in @hotcodepush/react-native-code-push, bring over what is new, then record its expo version and SHA-256 in this test.`,
    ).toBe(REFERENCE_FACTORY_SHA256);
  });
});
