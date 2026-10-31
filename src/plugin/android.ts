import type { AndroidConfig, ConfigPlugin } from 'expo/config-plugins';
import { withAppBuildGradle, withMainApplication } from 'expo/config-plugins';
import { buildReactNativePackageFileResolution } from './react-native-package';

const EXPO_REACT_HOST_CALL = 'ExpoReactHostFactory.getDefaultReactHost(';

const EXPO_REACT_HOST_IMPORT = 'import expo.modules.ExpoReactHostFactory';

const EXPO_METRO_ENTRY_PATH = '.expo/.virtual-metro-entry';

const GRADLE_FILE_NAME = 'hotcodepush.gradle';

// Node resolves the file path when Gradle evaluates the build file.
const GRADLE_FILE_APPLY_LINE = `apply from: ["node", "--print", "${buildReactNativePackageFileResolution(`android/${GRADLE_FILE_NAME}`)}"].execute(null, rootDir).text.trim()`;

const REACT_HOST_CALL = 'HotCodePushReactHost.getDefaultReactHost(';

const REACT_HOST_IMPORT =
  'import com.hotcodepush.reactnative.HotCodePushReactHost';

// The build logic lives in the Gradle file of the React Native package, so the app needs only one line.
export const withBinaryCreateGradleFile: ConfigPlugin = config =>
  withAppBuildGradle(config, gradleConfig => {
    gradleConfig.modResults.contents = addBinaryCreateGradleFile(
      gradleConfig.modResults,
    );
    return gradleConfig;
  });

// The HotCodePush host asks for the served bundle at every start and reload.
export const withServedBundleReactHost: ConfigPlugin = config =>
  withMainApplication(config, mainApplicationConfig => {
    mainApplicationConfig.modResults.contents = addServedBundleReactHost(
      mainApplicationConfig.modResults.contents,
    );
    return mainApplicationConfig;
  });

function addBinaryCreateGradleFile({
  contents,
  language,
}: AndroidConfig.Paths.GradleProjectFile): string {
  if (contents.includes(GRADLE_FILE_NAME)) {
    return contents;
  }
  if (language !== 'groovy') {
    throw new Error(
      `The app's build file is not Groovy, the language of the line that applies ${GRADLE_FILE_NAME}.`,
    );
  }
  return `${contents}${contents.endsWith('\n') ? '' : '\n'}\n${GRADLE_FILE_APPLY_LINE}\n`;
}

function addServedBundleReactHost(mainApplication: string): string {
  if (mainApplication.includes(REACT_HOST_IMPORT)) {
    return mainApplication;
  }
  if (
    !mainApplication.includes(EXPO_REACT_HOST_IMPORT) ||
    !mainApplication.includes(EXPO_REACT_HOST_CALL)
  ) {
    throw new Error(
      `MainApplication.kt does not build its React host with Expo's ${EXPO_REACT_HOST_CALL}) to replace with ${REACT_HOST_CALL}).`,
    );
  }
  // A debug build must ask Metro for the Expo entry. The SDK default is the index of a bare app.
  return mainApplication
    .replace(EXPO_REACT_HOST_IMPORT, REACT_HOST_IMPORT)
    .replace(
      EXPO_REACT_HOST_CALL,
      `${REACT_HOST_CALL}\n      jsMainModulePath = "${EXPO_METRO_ENTRY_PATH}",`,
    );
}
