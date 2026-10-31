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
 * Both native apps run the bundle the SDK serves, and each build runs binary create after the JavaScript is bundled.
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
