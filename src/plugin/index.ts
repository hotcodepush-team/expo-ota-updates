import type { ConfigPlugin } from 'expo/config-plugins';
import { withPlugins } from 'expo/config-plugins';
import {
  withBinaryCreateGradleFile,
  withServedBundleReactHost,
} from './android';
import { withEnabledExpoUpdatesRefused } from './expo-updates';
import { withBinaryCreatePhase, withServedBundleUrl } from './ios';

/**
 * Wires HotCodePush into an Expo project at prebuild, as `hotcodepush init` does for a bare React Native app.
 *
 * In a release build both native apps run the bundle the SDK serves. The build step runs after the JavaScript is bundled:
 * binary create in a store build, resource-file write in any other.
 * A later prebuild leaves earlier edits as they are. An enabled expo-updates fails the prebuild.
 */
const withHotCodePush: ConfigPlugin = config =>
  withPlugins(config, [
    withBinaryCreateGradleFile,
    withBinaryCreatePhase,
    withEnabledExpoUpdatesRefused,
    withServedBundleReactHost,
    withServedBundleUrl,
  ]);

export default withHotCodePush;
