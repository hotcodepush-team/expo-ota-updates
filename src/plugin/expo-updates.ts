import type { ExpoConfig } from 'expo/config';
import { getPackageJson } from 'expo/config';
import type {
  ConfigPlugin,
  ExportedConfigWithProps,
} from 'expo/config-plugins';
import { withDangerousMod } from 'expo/config-plugins';

const ENABLED_EXPO_UPDATES_MESSAGE =
  'HotCodePush and expo-updates cannot both serve updates. Set updates.enabled to false in your app config, or remove expo-updates.';

const EXPO_UPDATES_PACKAGE_NAME = 'expo-updates';

/**
 * expo-updates decides the bundle the app runs, as the SDK does: beside an enabled expo-updates, Android would run
 * the SDK's bundle and iOS Expo's. The prebuild of either platform fails instead.
 */
export const withEnabledExpoUpdatesRefused: ConfigPlugin = config =>
  withDangerousMod(
    withDangerousMod(config, ['android', refuseEnabledExpoUpdates]),
    ['ios', refuseEnabledExpoUpdates],
  );

function refuseEnabledExpoUpdates(
  config: ExportedConfigWithProps<unknown>,
): ExportedConfigWithProps<unknown> {
  if (isExpoUpdatesEnabled(config, config.modRequest.projectRoot)) {
    throw new Error(ENABLED_EXPO_UPDATES_MESSAGE);
  }
  return config;
}

// an unset updates.enabled counts as enabled: Expo enables expo-updates as soon as the config names an update URL
function isExpoUpdatesEnabled(
  config: ExpoConfig,
  projectRoot: string,
): boolean {
  return (
    config.updates?.enabled !== false && isExpoUpdatesInstalled(projectRoot)
  );
}

// the dependencies autolinking starts from: a package listed in either is linked into the native projects
function isExpoUpdatesInstalled(projectRoot: string): boolean {
  const { dependencies = {}, devDependencies = {} } =
    getPackageJson(projectRoot);
  return (
    EXPO_UPDATES_PACKAGE_NAME in dependencies ||
    EXPO_UPDATES_PACKAGE_NAME in devDependencies
  );
}
