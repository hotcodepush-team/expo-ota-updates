import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import reactNativePackage from '@hotcodepush/react-native-code-push/package.json';
import type { ExpoConfig } from 'expo/config';
import { compileModsAsync, IOSConfig } from 'expo/config-plugins';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import withHotCodePush from '.';

// the native files `expo prebuild` generates for SDK 55, from expo-template-bare-minimum 55.0.43
const FIXTURE_PATH = join(__dirname, 'fixtures', 'expo-sdk-55');

const NATIVE_FILE_PATHS = {
  appDelegate: 'ios/HelloWorld/AppDelegate.swift',
  buildGradle: 'android/app/build.gradle',
  mainApplication:
    'android/app/src/main/java/com/helloworld/MainApplication.kt',
  pbxproj: 'ios/HelloWorld.xcodeproj/project.pbxproj',
  podfile: 'ios/Podfile',
};

type NativeFile = keyof typeof NATIVE_FILE_PATHS;

describe('withHotCodePush', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'expo-ota-updates-'));
    cpSync(FIXTURE_PATH, projectRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { force: true, recursive: true });
  });

  it('should add the binary create phase right after the bundling phase', async () => {
    await prebuild(projectRoot);

    const project = IOSConfig.XcodeUtils.getPbxproj(projectRoot);
    const [[, target] = []] = IOSConfig.Target.getNativeTargets(project);
    expect(target?.buildPhases.map(({ comment }) => comment)).toEqual([
      '[CP] Check Pods Manifest.lock',
      'Sources',
      'Frameworks',
      'Resources',
      'Bundle React Native code and images',
      'Create HotCodePush binary',
      '[CP] Copy Pods Resources',
    ]);
    expect(readNativeFile(projectRoot, 'pbxproj')).toContain(
      '$REACT_NATIVE_PATH/../@hotcodepush/react-native-code-push/scripts/binary-create-xcode.sh',
    );
  });

  it("should return the served bundle from a release build's bundle URL", async () => {
    await prebuild(projectRoot);

    const appDelegate = readNativeFile(projectRoot, 'appDelegate');
    expect(appDelegate).toMatch(/^import HotcodepushReactNativeCodePush\n/);
    expect(appDelegate).toContain(
      '#else\n    return HotCodePush.bundleURL()\n#endif',
    );
    expect(appDelegate).toContain(
      'jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")',
    );
  });

  it('should pin the protocol pod at the commit the React Native package names', async () => {
    await prebuild(projectRoot);

    expect(readNativeFile(projectRoot, 'podfile')).toContain(
      `  config = use_native_modules!(config_command)\n  pod 'HotCodePushProtocol', :git => 'https://github.com/hotcodepush-team/protocol-ios.git', :commit => '${reactNativePackage.hotcodepush.protocolIos}'\n`,
    );
  });

  it("should apply the React Native package's Gradle file at the end of the app's build file", async () => {
    await prebuild(projectRoot);

    expect(readNativeFile(projectRoot, 'buildGradle')).toMatch(
      /\n\napply from: new File\(\["node", "--print", "require\.resolve\('@hotcodepush\/react-native-code-push\/package\.json'\)"\]\.execute\(null, rootDir\)\.text\.trim\(\), "\.\.\/android\/hotcodepush\.gradle"\)\n$/,
    );
  });

  it("should build the React host with the SDK's host in place of Expo's", async () => {
    await prebuild(projectRoot);

    const mainApplication = readNativeFile(projectRoot, 'mainApplication');
    expect(mainApplication).toContain(
      'import com.hotcodepush.reactnative.HotCodePushReactHost\n',
    );
    expect(mainApplication).toContain(
      '    HotCodePushReactHost.getDefaultReactHost(\n      jsMainModulePath = ".expo/.virtual-metro-entry",\n      context = applicationContext,\n',
    );
    expect(mainApplication).not.toContain('ExpoReactHostFactory');
  });

  it('should change no native file when prebuild runs again', async () => {
    await prebuild(projectRoot);
    const preparedFiles = readNativeFiles(projectRoot);

    await prebuild(projectRoot);

    expect(readNativeFiles(projectRoot)).toEqual(preparedFiles);
  });

  it('should throw when the Xcode project has no bundling phase', async () => {
    editNativeFile(projectRoot, 'pbxproj', pbxproj =>
      pbxproj.replaceAll('Bundle React Native code and images', 'Bundle'),
    );

    await expect(prebuild(projectRoot)).rejects.toThrow(
      'The Xcode project has no "Bundle React Native code and images" phase to run binary create after.',
    );
  });

  it('should throw when the AppDelegate returns no embedded bundle', async () => {
    editNativeFile(projectRoot, 'appDelegate', appDelegate =>
      appDelegate.replace('forResource: "main"', 'forResource: "app"'),
    );

    await expect(prebuild(projectRoot)).rejects.toThrow(
      'AppDelegate.swift does not return the embedded main.jsbundle from bundleURL() to replace with HotCodePush.bundleURL().',
    );
  });

  it('should throw when the Podfile has no native modules line', async () => {
    editNativeFile(projectRoot, 'podfile', podfile =>
      podfile.replace('config = use_native_modules!(config_command)', ''),
    );

    await expect(prebuild(projectRoot)).rejects.toThrow(
      'The Podfile has no use_native_modules! line to add the HotCodePushProtocol pod after.',
    );
  });

  it('should throw when the main application builds no Expo React host', async () => {
    editNativeFile(projectRoot, 'mainApplication', mainApplication =>
      mainApplication.replaceAll(
        'ExpoReactHostFactory',
        'DefaultReactHostFactory',
      ),
    );

    await expect(prebuild(projectRoot)).rejects.toThrow(
      "MainApplication.kt does not build its React host with Expo's ExpoReactHostFactory.getDefaultReactHost() to replace with HotCodePushReactHost.getDefaultReactHost().",
    );
  });
});

async function prebuild(projectRoot: string): Promise<void> {
  const config: ExpoConfig = {
    _internal: { projectRoot },
    name: 'HelloWorld',
    slug: 'hello-world',
  };
  await compileModsAsync(withHotCodePush(config), {
    platforms: ['android', 'ios'],
    projectRoot,
  });
}

function editNativeFile(
  projectRoot: string,
  nativeFile: NativeFile,
  edit: (contents: string) => string,
): void {
  writeFileSync(
    join(projectRoot, NATIVE_FILE_PATHS[nativeFile]),
    edit(readNativeFile(projectRoot, nativeFile)),
  );
}

function readNativeFile(projectRoot: string, nativeFile: NativeFile): string {
  return readFileSync(join(projectRoot, NATIVE_FILE_PATHS[nativeFile]), 'utf8');
}

function readNativeFiles(projectRoot: string): string[] {
  return Object.values(NATIVE_FILE_PATHS).map(path =>
    readFileSync(join(projectRoot, path), 'utf8'),
  );
}
