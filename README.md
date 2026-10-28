# Expo OTA updates by HotCodePush

`@hotcodepush/expo-ota-updates` is the Expo package that delivers over-the-air (OTA) updates to your app: an OTA update reaches installed apps in seconds, without a store review.
Learn more at [hotcodepush.com/expo-ota-updates](https://hotcodepush.com/expo-ota-updates).

It is a config plugin over [`@hotcodepush/react-native-code-push`](https://github.com/hotcodepush-team/react-native-code-push): the plugin wires the module into the native projects at prebuild, and the package re-exports the module's API.

## Installation

`npx hotcodepush init` installs the package, adds the config plugin to the app config and writes `hotcodepush.json`.
By hand, until the package is on npm, install the preview build pkg.pr.new publishes for every commit on `main`, pinned to a commit, together with the CLI the native builds call, and list the plugin:

```sh
npm install https://pkg.pr.new/hotcodepush-team/expo-ota-updates/@hotcodepush/expo-ota-updates@<sha>
npm install --save-dev https://pkg.pr.new/hotcodepush-team/cli/hotcodepush@<sha>
```

```json
{ "expo": { "plugins": ["@hotcodepush/expo-ota-updates"] } }
```

Then run `npx expo prebuild`; after an upgrade of the package, `npx expo prebuild --clean` once.

| Expo SDK | React Native | iOS  | Android      |
| -------- | ------------ | ---- | ------------ |
| 55       | 0.83         | 15.1 | 7.0 (API 24) |
| 56       | 0.85         | 16.4 | 7.0 (API 24) |
| 57       | 0.86         | 16.4 | 7.0 (API 24) |
| 58       | 0.88         | 16.4 | 7.0 (API 24) |

The app runs in a development or release build of your own, never in Expo Go.
Remove `expo-updates`, or set `updates.enabled` to `false`, since both decide which bundle the app runs.
A store build, an Xcode archive, EAS Build or a release Gradle variant, registers the store build in HotCodePush and needs `npx hotcodepush login` or `HOTCODEPUSH_TOKEN`.
A debug build loads its JavaScript from the development server, so OTA updates are off there: try an update with `npx expo run:ios --configuration Release` or `npx expo run:android --variant release`.

## Usage

```tsx
import { HotCodePush, useUpdates } from '@hotcodepush/expo-ota-updates';

const result = await HotCodePush.sync();
if (result.status === 'downloaded') {
  console.log(
    `release #${result.release.number} applies at ${result.applyStrategy}`,
  );
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

With the default `checkStrategy` of `auto`, the SDK checks on start, on resume and in the foreground; `sync()` runs one cycle on demand.
Applying an update reloads the JavaScript without restarting the app.
Set `downloadStrategy` or `applyStrategy` to `manual` and call `downloadUpdate()` or `applyUpdate()` yourself to control when an update lands.
`npx hotcodepush release create` bundles each platform with `npx expo export:embed` and Hermes, as the store build does.

## Documentation

See [hotcodepush.com/docs/expo](https://hotcodepush.com/docs/expo) for the configuration, methods, events, types and reasons.

## Development

```sh
nvm use
npm ci
npm run build
npm test             # the plugin over Expo's template fixtures and the API loaded without the native module
npm run lint && npm run typecheck
npm run fmt          # run before every commit
```

The package holds no native code; the [demo app](https://github.com/hotcodepush-team/expo-ota-updates-demo) builds both platforms with the plugin.
The native module lives in [react-native-code-push](https://github.com/hotcodepush-team/react-native-code-push), the cores in [core-ios](https://github.com/hotcodepush-team/core-ios) and [core-android](https://github.com/hotcodepush-team/core-android).
`CLAUDE.md` holds the layout and the rules.

## License

See [LICENSE](./LICENSE).
An app that ships the plugin also ships the native cores' third-party code: FreeBSD's bspatch (BSD 2-clause) on both platforms and bzip2 1.0.8 on Android. Reproduce the notices from [core-ios](https://github.com/hotcodepush-team/core-ios/blob/main/THIRD-PARTY-NOTICES) and [core-android](https://github.com/hotcodepush-team/core-android/blob/main/THIRD-PARTY-NOTICES) in your app's distribution.
