import type { ConfigPlugin } from 'expo/config-plugins';
import { withPlugins } from 'expo/config-plugins';
import {
  withBinaryCreateGradleFile,
  withServedBundleReactHost,
} from './android';
import {
  withBinaryCreatePhase,
  withProtocolPod,
  withServedBundleUrl,
} from './ios';

/**
 * Wires an Expo project at prebuild as `hotcodepush init` wires a bare React Native one: the build step runs binary
 * create after React Native bundles the JavaScript, and both native apps ask the SDK for the bundle they run.
 * Every edit is recognised on the next prebuild and left as it is.
 */
const withHotCodePush: ConfigPlugin = config =>
  withPlugins(config, [
    withBinaryCreateGradleFile,
    withBinaryCreatePhase,
    withProtocolPod,
    withServedBundleReactHost,
    withServedBundleUrl,
  ]);

export default withHotCodePush;
