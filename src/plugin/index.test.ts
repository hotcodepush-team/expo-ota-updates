import {
  cpSync,
  mkdtempSync,
  readFileSync,
  renameSync,
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

// the native files `expo prebuild` generates per SDK, from expo-template-bare-minimum 55.0.43, 56.0.37 and 57.0.28
const FIXTURE_NAMES = ['expo-sdk-55', 'expo-sdk-56', 'expo-sdk-57'];

const NATIVE_FILE_PATHS = {
  appDelegate: 'ios/HelloWorld/AppDelegate.swift',
  buildGradle: 'android/app/build.gradle',
  mainApplication:
    'android/app/src/main/java/com/helloworld/MainApplication.kt',
  pbxproj: 'ios/HelloWorld.xcodeproj/project.pbxproj',
  podfile: 'ios/Podfile',
};

type NativeFile = keyof typeof NATIVE_FILE_PATHS;

describe.each(FIXTURE_NAMES)('withHotCodePush on %s', fixtureName => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'expo-ota-updates-'));
    cpSync(join(__dirname, 'fixtures', fixtureName), projectRoot, {
      recursive: true,
    });
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
      `HOTCODEPUSH_BINARY_CREATE=\\"$(\\"$NODE_BINARY\\" --print \\"require.resolve('@hotcodepush/react-native-code-push/scripts/binary-create-xcode.sh', { paths: [require.resolve('@hotcodepush/expo-ota-updates/package.json')] })\\")\\"`,
    );
  });

  it('should mark the binary create phase to run on every build', async () => {
    await prebuild(projectRoot);

    const project = IOSConfig.XcodeUtils.getPbxproj(projectRoot);
    expect(
      project.buildPhaseObject(
        'PBXShellScriptBuildPhase',
        'Create HotCodePush binary',
      ),
    ).toMatchObject({ alwaysOutOfDate: 1 });
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

  it('should pin the core pod at the commit the React Native package names', async () => {
    await prebuild(projectRoot);

    expect(readNativeFile(projectRoot, 'podfile')).toContain(
      `  config = use_native_modules!(config_command)\n  pod 'HotCodePushCore', :git => 'https://github.com/hotcodepush-team/core-ios.git', :commit => '${reactNativePackage.hotcodepush.coreIos}'\n`,
    );
  });

  it('should pin the core pod when the Podfile names it outside a pod line', async () => {
    editNativeFile(projectRoot, 'podfile', podfile =>
      podfile.replace(
        'post_install do |installer|',
        "post_install do |installer|\n    # HotCodePushCore's resource bundle",
      ),
    );

    await prebuild(projectRoot);

    expect(readNativeFile(projectRoot, 'podfile')).toContain(
      "  pod 'HotCodePushCore', :git =>",
    );
  });

  it("should apply the React Native package's Gradle file at the end of the app's build file", async () => {
    await prebuild(projectRoot);

    expect(readNativeFile(projectRoot, 'buildGradle')).toMatch(
      /\n\napply from: \["node", "--print", "require\.resolve\('@hotcodepush\/react-native-code-push\/android\/hotcodepush\.gradle', \{ paths: \[require\.resolve\('@hotcodepush\/expo-ota-updates\/package\.json'\)\] \}\)"\]\.execute\(null, rootDir\)\.text\.trim\(\)\n$/,
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
      'The Podfile has no use_native_modules! line to add the HotCodePushCore pod after.',
    );
  });

  it("should throw when the app's build file is not Groovy", async () => {
    const buildGradlePath = join(projectRoot, NATIVE_FILE_PATHS.buildGradle);
    renameSync(buildGradlePath, `${buildGradlePath}.kts`);

    await expect(prebuild(projectRoot)).rejects.toThrow(
      "The app's build file is not Groovy, the language of the line that applies hotcodepush.gradle.",
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
