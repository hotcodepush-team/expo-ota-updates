import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import expoPackage from 'expo/package.json';
import { describe, expect, it } from 'vitest';

const FACTORY_PATH_IN_EXPO =
  'expo/android/src/main/java/expo/modules/ExpoReactHostFactory.kt';

const FIXTURES_PATH = join(__dirname, 'fixtures');

const FIXTURE_NAMES = readdirSync(FIXTURES_PATH, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(({ name }) => name);

// HotCodePushReactHost stands in for Expo's host factory on Android; per supported SDK, the factory it was checked against
const CHECKED_FACTORY_SHA256_BY_SDK = new Map([
  [55, '12c7a812e557bbc5c58238241065841e85b3d3b295c3910ebea733e33ce2f91e'],
  [56, '12c7a812e557bbc5c58238241065841e85b3d3b295c3910ebea733e33ce2f91e'],
  [57, '12c7a812e557bbc5c58238241065841e85b3d3b295c3910ebea733e33ce2f91e'],
]);

describe.each(FIXTURE_NAMES)("Expo's host factory in %s", fixtureName => {
  it('should equal the one HotCodePushReactHost was checked against on its SDK', () => {
    expectCheckedFactory(
      Number(fixtureName.replace('expo-sdk-', '')),
      join(FIXTURES_PATH, fixtureName, 'ExpoReactHostFactory.kt'),
    );
  });
});

describe(`Expo's host factory in the installed expo ${expoPackage.version}`, () => {
  it('should equal the one HotCodePushReactHost was checked against on its SDK', () => {
    expectCheckedFactory(
      Number(expoPackage.version.split('.')[0]),
      require.resolve(FACTORY_PATH_IN_EXPO),
    );
  });
});

function expectCheckedFactory(sdk: number, factoryPath: string): void {
  expect(
    createHash('sha256').update(readFileSync(factoryPath)).digest('hex'),
    `Expo's ExpoReactHostFactory.kt at ${factoryPath} differs from the one HotCodePushReactHost was checked against on SDK ${sdk}. Compare it with HotCodePushReactHost.kt in @hotcodepush/react-native-code-push, bring over what is new, then record its SHA-256 for SDK ${sdk} in this test.`,
  ).toBe(CHECKED_FACTORY_SHA256_BY_SDK.get(sdk));
}
