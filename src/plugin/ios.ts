import reactNativePackage from '@hotcodepush/react-native-code-push/package.json';
import type { ConfigPlugin } from 'expo/config-plugins';
import {
  withAppDelegate,
  withPodfile,
  withXcodeProject,
} from 'expo/config-plugins';
import type { XcodeProject } from 'xcode';
import { buildReactNativePackageFileResolution } from './react-native-package';

const BINARY_CREATE_PHASE_NAME = 'Create HotCodePush binary';

const BINARY_CREATE_SCRIPT_NAME = 'binary-create-xcode.sh';

// the lines of the phase as a pbxproj string carries them, the line breaks escaped
const BINARY_CREATE_PHASE_SCRIPT = [
  'set -e',
  '',
  '# hotcodepush: writes hotcodepush.json into the app and registers the binary',
  'if [ -f "$PODS_ROOT/../.xcode.env" ]; then',
  '  . "$PODS_ROOT/../.xcode.env"',
  'fi',
  'if [ -f "$PODS_ROOT/../.xcode.env.local" ]; then',
  '  . "$PODS_ROOT/../.xcode.env.local"',
  'fi',
  'export NODE_BINARY',
  `HOTCODEPUSH_BINARY_CREATE="$("$NODE_BINARY" --print "${buildReactNativePackageFileResolution(`scripts/${BINARY_CREATE_SCRIPT_NAME}`)}")"`,
  '',
  '"$HOTCODEPUSH_BINARY_CREATE"',
  '',
].join('\\n');

const BUNDLE_URL_CALL = 'HotCodePush.bundleURL()';

const BUNDLING_PHASE_NAME = 'Bundle React Native code and images';

const EMBEDDED_BUNDLE_URL_CALL =
  'Bundle.main.url(forResource: "main", withExtension: "jsbundle")';

const PROTOCOL_POD_NAME = 'HotCodePushProtocol';

const PROTOCOL_POD_LINE_START = `pod '${PROTOCOL_POD_NAME}'`;

const PROTOCOL_POD_REPOSITORY_URL =
  'https://github.com/hotcodepush-team/protocol-ios.git';

const SWIFT_MODULE_IMPORT = 'import HotcodepushReactNativeCodePush';

/**
 * The app target runs binary create right after "Bundle React Native code and images", whose output it hashes.
 */
export const withBinaryCreatePhase: ConfigPlugin = config =>
  withXcodeProject(config, xcodeConfig => {
    addBinaryCreatePhase(xcodeConfig.modResults);
    return xcodeConfig;
  });

/**
 * Until `HotCodePushProtocol` is published, the Podfile pins the pod at the commit the installed React Native package
 * names in its `package.json`; the pin falls away at publish.
 */
export const withProtocolPod: ConfigPlugin = config =>
  withPodfile(config, podfileConfig => {
    podfileConfig.modResults.contents = addProtocolPod(
      podfileConfig.modResults.contents,
    );
    return podfileConfig;
  });

/**
 * A release build's `bundleURL()` returns the bundle the SDK serves in place of the embedded `main.jsbundle`;
 * the debug build's Metro line stays as it is.
 */
export const withServedBundleUrl: ConfigPlugin = config =>
  withAppDelegate(config, appDelegateConfig => {
    appDelegateConfig.modResults.contents = addServedBundleUrl(
      appDelegateConfig.modResults.contents,
    );
    return appDelegateConfig;
  });

function addBinaryCreatePhase(project: XcodeProject): void {
  if (hasBinaryCreatePhase(project)) {
    return;
  }
  const target = findBundlingTarget(project);
  if (target === undefined) {
    throw new Error(
      `The Xcode project has no "${BUNDLING_PHASE_NAME}" phase to run binary create after.`,
    );
  }
  project.addBuildPhase(
    [],
    'PBXShellScriptBuildPhase',
    BINARY_CREATE_PHASE_NAME,
    target.uuid,
    { shellPath: '/bin/sh', shellScript: BINARY_CREATE_PHASE_SCRIPT },
  );
  // the package appends the phase to the target; binary create belongs right after the bundling it reads
  const { buildPhases } = target;
  const binaryCreatePhase = buildPhases.pop();
  if (binaryCreatePhase !== undefined) {
    buildPhases.splice(target.bundlingPhaseIndex + 1, 0, binaryCreatePhase);
  }
}

function addProtocolPod(podfile: string): string {
  if (podfile.includes(PROTOCOL_POD_LINE_START)) {
    return podfile;
  }
  const nativeModulesLine = podfile
    .split('\n')
    .find(line => line.includes('use_native_modules!'));
  if (nativeModulesLine === undefined) {
    throw new Error(
      `The Podfile has no use_native_modules! line to add the ${PROTOCOL_POD_NAME} pod after.`,
    );
  }
  const indentation = /^\s*/.exec(nativeModulesLine)?.[0] ?? '';
  const commit = reactNativePackage.hotcodepush.protocolIos;
  return podfile.replace(
    nativeModulesLine,
    `${nativeModulesLine}\n${indentation}${PROTOCOL_POD_LINE_START}, :git => '${PROTOCOL_POD_REPOSITORY_URL}', :commit => '${commit}'`,
  );
}

function addServedBundleUrl(appDelegate: string): string {
  if (appDelegate.includes(BUNDLE_URL_CALL)) {
    return appDelegate;
  }
  if (!appDelegate.includes(EMBEDDED_BUNDLE_URL_CALL)) {
    throw new Error(
      `AppDelegate.swift does not return the embedded main.jsbundle from bundleURL() to replace with ${BUNDLE_URL_CALL}.`,
    );
  }
  return `${SWIFT_MODULE_IMPORT}\n${appDelegate.replace(EMBEDDED_BUNDLE_URL_CALL, BUNDLE_URL_CALL)}`;
}

/**
 * The native target that bundles React Native's JavaScript, with the position of that phase among its phases.
 */
function findBundlingTarget(project: XcodeProject):
  | {
      buildPhases: { value: string; comment?: string }[];
      bundlingPhaseIndex: number;
      uuid: string;
    }
  | undefined {
  for (const [uuid, target] of Object.entries(
    project.pbxNativeTargetSection(),
  )) {
    if (typeof target !== 'object') {
      continue;
    }
    const bundlingPhaseIndex = target.buildPhases.findIndex(
      ({ comment }) => comment === BUNDLING_PHASE_NAME,
    );
    if (bundlingPhaseIndex !== -1) {
      return { buildPhases: target.buildPhases, bundlingPhaseIndex, uuid };
    }
  }
  return undefined;
}

/**
 * The phase is recognised by the script it runs, whatever it is named.
 */
function hasBinaryCreatePhase(project: XcodeProject): boolean {
  return Object.values(
    project.hash.project.objects.PBXShellScriptBuildPhase ?? {},
  ).some(
    phase =>
      typeof phase === 'object' &&
      String(phase.shellScript).includes(BINARY_CREATE_SCRIPT_NAME),
  );
}
