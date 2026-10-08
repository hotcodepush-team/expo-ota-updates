# Expo OTA updates by HotCodePush

`@hotcodepush/expo-ota-updates` is the Expo package that delivers over-the-air updates to your app: an OTA update reaches installed apps in seconds, without a store review. Learn more at [hotcodepush.com/expo-ota-updates](https://hotcodepush.com/expo-ota-updates).

It is a config plugin over [`@hotcodepush/react-native-code-push`](https://github.com/hotcodepush-team/react-native-code-push), the React Native module: the plugin wires the module into the native projects at prebuild, and the package re-exports the module's API.

## Installation

`npx hotcodepush init` installs the package, adds its config plugin to the app config and writes `hotcodepush.json`, the project's configuration, which names the app and the channel. By hand, until the package is published, install the preview build pkg.pr.new publishes for every commit on `main`, pinned to a commit, together with the CLI the native builds call:

```sh
npm install https://pkg.pr.new/hotcodepush-team/expo-ota-updates/@hotcodepush/expo-ota-updates@<sha>
npm install --save-dev https://pkg.pr.new/hotcodepush-team/cli/hotcodepush@<sha>
```

Then list the plugin in the app config:

```json
{
  "expo": {
    "plugins": ["@hotcodepush/expo-ota-updates"]
  }
}
```

`init` adds the entry to `app.config.json` where the project has one, otherwise to `app.json`. In a project whose app config is code, such as `app.config.ts`, or whose JSON config the CLI cannot parse, `init` edits no app config and names the entry for you to add.

The package supports the Expo SDKs it is proven on. Its peer range on `expo` ends at the newest of them, and a release that proves a newer SDK widens it.

| Expo SDK | React Native | iOS  | Android      |
| -------- | ------------ | ---- | ------------ |
| 55       | 0.83         | 15.1 | 7.0 (API 24) |
| 56       | 0.85         | 16.4 | 7.0 (API 24) |
| 57       | 0.86         | 16.4 | 7.0 (API 24) |

The iOS and Android floors are Expo's own for each SDK.

Generate the native projects:

```sh
npx expo prebuild
```

At prebuild the plugin wires the build step and the served bundle into the native projects: the native builds run the build step after they bundle the JavaScript, and the app runs the bundle the SDK serves. Every prebuild applies the plugin, and an edit that is already in a file is left as it is, except the native core's pin, which every prebuild moves to the package's. A project prebuilt with an older version of the package therefore needs `npx expo prebuild --clean` once for the build phase's shape, which regenerates the native projects. Where the plugin does not recognise a file of Expo's template, the prebuild fails with a message that names the file and what it lacks.

The SDK reads `hotcodepush.json` from the app's resources, which the build step writes on every native build. Only a store build, an Xcode archive (Product > Archive, `xcodebuild archive`, EAS Build) or a release Gradle variant, runs `binary create` and creates the store build's binary in HotCodePush, so it needs a login, `npx hotcodepush login`, or `HOTCODEPUSH_TOKEN`; a cloud build, such as EAS Build, needs the token in its environment. Every other build runs `resource-file write`, which writes the file and creates nothing, and never fails for a missing token: it goes on without a channel and takes no updates, in CI too. A store build without a token fails with `E_NOT_LOGGED_IN` where `CI` is set and warns elsewhere. `HOTCODEPUSH_OFFLINE=1` builds without asking the API, also where `CI` is set, for a build that is never shipped. A debug build, where the development server serves the JavaScript, gets the file without an embedded bundle, asks nothing and needs no login.

The native cores are the pod `HotCodePushCore` and the Android library [core-android](https://github.com/hotcodepush-team/core-android), each pinned to a commit until it is published. The plugin pins the pod in the Podfile, and the Gradle file it applies adds core-android's `maven` branch, where the pinned commit is published, to the app's repositories.

The app runs in a build of your own, a development build or a release build. Expo Go does not contain the SDK's native code.

Expo's own autolinking is required. The React Native module is a dependency of this package, not of your app, and the community autolinking, `EXPO_USE_COMMUNITY_AUTOLINKING=1`, links only the app's direct dependencies.

Do not use the SDK beside an enabled `expo-updates`: each of the two decides which bundle the app runs. Remove `expo-updates` when you adopt the SDK.

Live updates are off in a debug build, where the development server serves the JavaScript: every check answers `SKIPPED` with `BUILD_DEBUG`. Test an update in a release build: `npx expo run:ios --configuration Release` or `npx expo run:android --variant release`. The iOS run creates no binary, since it is not an archive; the Android release variant does and needs a login.

## Usage

```tsx
import { HotCodePush, useUpdates } from '@hotcodepush/expo-ota-updates';

const result = await HotCodePush.sync();
if (result.status === 'DOWNLOADED') {
  console.log(`release #${result.release.number} applies at ${result.applyAt}`);
}

function ReleaseLabel() {
  const { isSyncing, state } = useUpdates();
  return (
    <Text>
      {isSyncing
        ? 'syncing…'
        : (state.currentRelease?.bundleVersion ?? 'embedded')}
    </Text>
  );
}
```

The API is the React Native module's, re-exported. Import it from `@hotcodepush/expo-ota-updates`, the package your app depends on; [react-native-code-push](https://github.com/hotcodepush-team/react-native-code-push) is where it is defined.

With `checkStrategy` at `auto`, the default, the SDK checks on start, on resume and while the app stays in the foreground, and what follows a check is the download and apply strategies' business; `sync()` runs one such cycle when you want an update now, and with `checkStrategy` at `manual` it is the only way a cycle starts. Applying an update reloads the JavaScript without restarting the app. An app that asks before downloading sets `downloadStrategy` to `manual` and calls `downloadUpdate()` on `updateAvailable`, naming the apply strategies for that cycle if it wants; one that protects a flow sets `applyStrategy` to `manual` and calls `applyUpdate()` when it is ready.

`npx hotcodepush release create` bundles each platform itself with `npx expo export:embed`, the bundler the native release builds run, and compiles the JavaScript with Hermes as the store build does: one bundle per platform. `bundle upload` does the same without releasing. `--path` with `--platform` takes one platform's bundle directory you prepared yourself, laid out as the native build lays it out: `main.jsbundle` with `assets/` on iOS, `index.android.bundle` with its `drawable-*` directories on Android. The CLI refuses a directory without that JavaScript file, so an `expo export` directory is not one.

## Documentation

The SDK reference — configuration, methods, events, types and reasons — is at [hotcodepush.com/docs/expo](https://hotcodepush.com/docs/expo).

## Development

```sh
nvm use
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The package holds no native code. The tests run the plugin over the native files Expo's template generates, kept under `src/plugin/fixtures/`, and the [demo app](https://github.com/hotcodepush-team/expo-ota-updates-demo) builds both platforms with the plugin. The native module lives in [react-native-code-push](https://github.com/hotcodepush-team/react-native-code-push), the cores and their tests in [core-ios](https://github.com/hotcodepush-team/core-ios) and [core-android](https://github.com/hotcodepush-team/core-android).

## License

See [LICENSE](./LICENSE). An app that ships the package ships the native cores' third-party code with it: FreeBSD's bspatch under the BSD 2-clause licence on both platforms and, on Android, the decompression of bzip2 1.0.8 under the bzip2 licence. The cores' `THIRD-PARTY-NOTICES`, in [core-ios](https://github.com/hotcodepush-team/core-ios/blob/main/THIRD-PARTY-NOTICES) and in [core-android](https://github.com/hotcodepush-team/core-android/blob/main/THIRD-PARTY-NOTICES), carry the notices, and an app's distribution reproduces them: the BSD 2-clause licence requires it of a binary, the bzip2 licence appreciates the acknowledgment.
