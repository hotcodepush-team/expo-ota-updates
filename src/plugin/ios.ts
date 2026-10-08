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
  '# hotcodepush: writes hotcodepush.json into the app and, in a store build, creates the binary',
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

const CORE_POD_NAME = 'HotCodePushCore';

const CORE_POD_LINE_START = `pod '${CORE_POD_NAME}'`;

const CORE_POD_REPOSITORY_URL =
  'https://github.com/hotcodepush-team/core-ios.git';

const EMBEDDED_BUNDLE_URL_CALL =
  'Bundle.main.url(forResource: "main", withExtension: "jsbundle")';

// the build step reads the version and build from the built app's processed Info.plist: declared as the phase's input,
// Xcode processes the plist before it runs the phase
const INFO_PLIST_INPUT_PATH = '"$(TARGET_BUILD_DIR)/$(INFOPLIST_PATH)"';

const SWIFT_MODULE_IMPORT = 'import HotcodepushReactNativeCodePush';

/**
 * The app target runs the build step right after "Bundle React Native code and images", whose output it hashes.
 */
export const withBinaryCreatePhase: ConfigPlugin = config =>
  withXcodeProject(config, xcodeConfig => {
    addBinaryCreatePhase(xcodeConfig.modResults);
    return xcodeConfig;
  });

/**
 * Until `HotCodePushCore` is published, the Podfile pins the pod at the commit the installed React Native package
 * names in its `package.json`, and every prebuild moves the pin to that commit; the pin falls away at publish.
 */
export const withCorePod: ConfigPlugin = config =>
  withPodfile(config, podfileConfig => {
    podfileConfig.modResults.contents = pinCorePod(
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
  const { buildPhase } = project.addBuildPhase(
    [],
    'PBXShellScriptBuildPhase',
    BINARY_CREATE_PHASE_NAME,
    target.uuid,
    {
      inputPaths: [INFO_PLIST_INPUT_PATH],
      shellPath: '/bin/sh',
      shellScript: BINARY_CREATE_PHASE_SCRIPT,
    },
  );
  // the build step writes hotcodepush.json, which carries the build's time, on every build; a phase without outputs
  // that is not marked so makes Xcode warn
  buildPhase.alwaysOutOfDate = 1;
  // the package appends the phase to the target; the build step belongs right after the bundling it reads
  const { buildPhases } = target;
  const binaryCreatePhase = buildPhases.pop();
  if (binaryCreatePhase !== undefined) {
    buildPhases.splice(target.bundlingPhaseIndex + 1, 0, binaryCreatePhase);
  }
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
 * The pod line at the commit the installed React Native package names, indented as the line it replaces or follows.
 */
function buildCorePodLine(neighbouringLine: string): string {
  const indentation = /^\s*/.exec(neighbouringLine)?.[0] ?? '';
  const commit = reactNativePackage.hotcodepush.coreIos;
  return `${indentation}${CORE_POD_LINE_START}, :git => '${CORE_POD_REPOSITORY_URL}', :commit => '${commit}'`;
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

/**
 * The pod line is recognised by the pod's name and rewritten, so a prebuilt project follows the React Native package
 * the app installs; without one, the line follows `use_native_modules!`.
 */
function pinCorePod(podfile: string): string {
  const lines = podfile.split('\n');
  const corePodLine = lines.find(line =>
    line.trimStart().startsWith(CORE_POD_LINE_START),
  );
  if (corePodLine !== undefined) {
    return podfile.replace(corePodLine, buildCorePodLine(corePodLine));
  }
  const nativeModulesLine = lines.find(line =>
    line.includes('use_native_modules!'),
  );
  if (nativeModulesLine === undefined) {
    throw new Error(
      `The Podfile has no use_native_modules! line to add the ${CORE_POD_NAME} pod after.`,
    );
  }
  return podfile.replace(
    nativeModulesLine,
    `${nativeModulesLine}\n${buildCorePodLine(nativeModulesLine)}`,
  );
}
