# Expo OTA updates by HotCodePush

[![npm](https://img.shields.io/npm/v/@hotcodepush/expo-ota-updates)](https://www.npmjs.com/package/@hotcodepush/expo-ota-updates)
[![CI](https://github.com/hotcodepush-team/expo-ota-updates/actions/workflows/ci.yml/badge.svg)](https://github.com/hotcodepush-team/expo-ota-updates/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@hotcodepush/expo-ota-updates)](./LICENSE)

`@hotcodepush/expo-ota-updates` is the Expo package that delivers over-the-air (OTA) updates to your app. Ship a JavaScript fix with one command, reach every installed app within seconds, and roll it back from the console if something goes wrong. No store review, no new build.
Learn more at [hotcodepush.com/expo-ota-updates](https://hotcodepush.com/expo-ota-updates).

It is a config plugin over [`@hotcodepush/react-native-code-push`](https://github.com/hotcodepush-team/react-native-code-push): the plugin wires the module into the native projects at prebuild, and the package re-exports the module's API.

<a href="https://hotcodepush.com/">
  <img alt="Ship updates in seconds. Over-the-air updates for React Native, Expo, Capacitor and Cordova. Get started." src="https://hotcodepush.com/assets/banners/readme-banner-ember.png" width="100%" />
</a>

## Features

- ⚡️ **One command to release.** `npx hotcodepush release create --platform ios` bundles, signs and publishes.
- 📺 **Channels.** Staging, beta and production, each with its own release log, and promotion between them.
- 🚀 **Staged rollouts.** Start at 5 percent, widen in steps, and let the automatic pause stop a release that fails on devices.
- 🛟 **Rollback.** One command or one click sends every device back to the release before.
- 🔁 **Delta updates.** A device downloads what changed, built on the platform from the bundle it runs.
- 🔒 **Code signing.** The app runs only bundles signed with your key, which never leaves your machine or your CI.
- 🎯 **Conditions.** Target a release by binary version, OS version, device attributes or a list of devices.
- 🖥️ **Console, CLI and GitHub Action.** Watch devices arrive on a release in the console, release from the terminal, or from a workflow step.
- 🤖 **Built for agents.** An MCP server and agent skills let Claude Code or Cursor set up, release and debug for you.
- 🌐 **Open source.** The package, the CLI, the clients and the Action are MIT licensed.

## Compatibility

| Expo SDK | React Native | iOS  | Android      |
| -------- | ------------ | ---- | ------------ |
| 55       | 0.83         | 15.1 | 7.0 (API 24) |
| 56       | 0.85         | 16.4 | 7.0 (API 24) |
| 57       | 0.86         | 16.4 | 7.0 (API 24) |
| 58       | 0.88         | 16.4 | 7.0 (API 24) |

The app runs in a development or release build of your own, never in Expo Go.
Remove `expo-updates`, or set `updates.enabled` to `false`, since both decide which bundle the app runs.

## Demo

[expo-ota-updates-demo](https://github.com/hotcodepush-team/expo-ota-updates-demo) is an Expo app with the package wired in, built on both platforms and released through the GitHub Action on every merge. [ng-native-ota-updates-demo](https://github.com/hotcodepush-team/ng-native-ota-updates-demo) does the same for an Angular app on Expo through [NG Native](https://ng-native.com).

## Guides

- [Quickstart](https://hotcodepush.com/docs/quickstart), the first release end to end
- [Migrate from EAS Update](https://hotcodepush.com/docs/migrate/eas-update) or [from CodePush](https://hotcodepush.com/docs/migrate/codepush), with the mapping of every command and option
- [Release from CI](https://hotcodepush.com/docs/ci), GitHub Actions, EAS Build, GitLab, Bitrise and more

## Installation

### AI-assisted setup (recommended)

Paste this prompt into the agent or assistant you use:

```text
Set up HotCodePush OTA updates in this project, following https://hotcodepush.com/docs/quickstart.md. If you can run commands, install the agent skills with `npx skills add hotcodepush-team/skills`, then run hotcodepush-init and hotcodepush-release. If you cannot run commands, read that page and give me the steps to do it myself.
```

An agent that runs commands installs the package, creates the app and the channel, and ships the first update. An assistant without a shell reads the quickstart and hands you the steps. [Agent skills](https://hotcodepush.com/docs/ai/skills) explains what the agent does.

### Set up with the CLI

```sh
npx hotcodepush init
```

`init` signs you in, picks or creates the app, installs the package, adds the config plugin to the app config, writes `hotcodepush.json` and offers a signing key. Run `npx expo prebuild`, then build the app once in release, an Xcode archive, EAS Build or a Gradle release variant, so the store build registers itself. Then change something and ship it:

```sh
npx hotcodepush release create --platform ios
npx hotcodepush release create --platform android
```

The installed app downloads the release at its next start and runs it from the start after that.
A debug build loads its JavaScript from the development server, so OTA updates are off there. Try an update with `npx expo run:ios --configuration Release` or `npx expo run:android --variant release`.

Prefer to wire it yourself? The [installation guide](https://hotcodepush.com/docs/sdks/expo/installation) has the steps by hand: the package and the CLI, the plugin entry in the app config, `hotcodepush.json`, `npx expo prebuild` and the check with `doctor`.

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

With the default `checkStrategy` of `auto`, the SDK checks on start, on resume and in the foreground, and `sync()` runs one cycle on demand.
Applying an update reloads the JavaScript without restarting the app.
Set `downloadStrategy` or `applyStrategy` to `manual` and call `downloadUpdate()` or `applyUpdate()` yourself to control when an update lands.

## Documentation

See [hotcodepush.com/docs/sdks/expo](https://hotcodepush.com/docs/sdks/expo) for the configuration, methods, events, types and reasons.

## Development

See [CLAUDE.md](./CLAUDE.md) for the layout and the commands, and [CONTRIBUTING.md](https://github.com/hotcodepush-team/.github/blob/main/CONTRIBUTING.md) for the rules of a change.
The package holds no native code, so CI builds the [demo app](https://github.com/hotcodepush-team/expo-ota-updates-demo) with the plugin. The native module lives in [react-native-code-push](https://github.com/hotcodepush-team/react-native-code-push), the cores in [core-ios](https://github.com/hotcodepush-team/core-ios) and [core-android](https://github.com/hotcodepush-team/core-android).

## License

See [LICENSE](./LICENSE).
An app that ships the plugin also ships the native cores' third-party code: FreeBSD's bspatch (BSD 2-clause) on both platforms and bzip2 1.0.8 on Android. Reproduce the notices from [core-ios](https://github.com/hotcodepush-team/core-ios/blob/main/THIRD-PARTY-NOTICES) and [core-android](https://github.com/hotcodepush-team/core-android/blob/main/THIRD-PARTY-NOTICES) in your app's distribution.
