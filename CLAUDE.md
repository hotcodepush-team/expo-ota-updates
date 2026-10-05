# CLAUDE.md

The HotCodePush Expo SDK: `@hotcodepush/expo-ota-updates`, the config plugin that wires `@hotcodepush/react-native-code-push` into an Expo app at prebuild and re-exports its API.
Stack: TypeScript, Expo's config plugins from `expo/config-plugins`, Vitest; Expo SDK 55 and newer.

This package holds no native code and none of the SDK's behaviour: both are the React Native package's, in `react-native-code-push`, pinned to a commit in `package.json`.
A change of the native code or of the API is a change there and a bump of that pin here.

## Layout

```
app.plugin.js                        the plugin as Expo resolves it: `dist/plugin`
src/index.ts                         the API, one re-export of `@hotcodepush/react-native-code-push`
src/plugin/index.ts                  `withHotCodePush`, the five plugins in alphabetical order
src/plugin/ios.ts                    the Xcode phase, the AppDelegate's bundle URL, the Podfile's pod
src/plugin/android.ts                the Gradle line, `MainApplication.kt`'s React host
src/plugin/react-native-package.ts   the Node expression that resolves a file of the React Native package through this one
src/plugin/index.test.ts             the plugin compiled over the fixture: every edit, every error, the second prebuild
src/plugin/fixtures/expo-sdk-55/     the native files `expo prebuild` generates for SDK 55; outside ESLint and Prettier
```

## What the plugin edits

`withHotCodePush` wires an Expo project at prebuild as `npx hotcodepush init` wires a bare React Native one, in five plugins:

- **`withBinaryCreatePhase`, the Xcode project.** The target that has "Bundle React Native code and images" gets the phase "Create HotCodePush binary" right after it. The phase sources `.xcode.env` and `.xcode.env.local`, exports `NODE_BINARY` and runs the React Native package's `scripts/binary-create-xcode.sh`, the build step.
- **`withServedBundleUrl`, `AppDelegate.swift`.** `bundleURL()` returns `HotCodePush.bundleURL()` where it returned the embedded `main.jsbundle`, and the file imports `HotcodepushReactNativeCodePush`. The debug build's Metro line stays.
- **`withProtocolPod`, the Podfile.** A `pod 'HotCodePushProtocol'` line follows the `use_native_modules!` line, with `:git` and the `:commit` the installed React Native package names under `hotcodepush.protocolIos`. The pod is not published yet; the edit goes when it is.
- **`withBinaryCreateGradleFile`, `android/app/build.gradle`.** One `apply from` line at the end applies the React Native package's `android/hotcodepush.gradle`, whose task runs the build step.
- **`withServedBundleReactHost`, `MainApplication.kt`.** The React host is built by the SDK's `HotCodePushReactHost.getDefaultReactHost` in place of Expo's `ExpoReactHostFactory.getDefaultReactHost`, and the SDK's import replaces Expo's, so Expo's host factory is not called on Android. The call gains `jsMainModulePath = ".expo/.virtual-metro-entry"`, Expo's entry for a debug build that asks Metro; the other arguments stay.

## Commands

| Command             | Does                                                     |
| ------------------- | -------------------------------------------------------- |
| `npm run lint`      | ESLint and Prettier                                      |
| `npm run typecheck` | TypeScript                                               |
| `npm test`          | Vitest, the plugin over the fixture                      |
| `npm run build`     | the TypeScript into `dist/`, which `app.plugin.js` loads |
| `npm run verify`    | the four above, in that order                            |

Run `npm run fmt` before every commit.
No workflow here builds a native project: `ci.yml` runs the four commands and publishes the preview build, and the demo's own CI builds both platforms with the plugin at the commit the demo pins.

## Dependencies during the build phase

Consumers pin the preview builds pkg.pr.new publishes from `ci.yml` on every push to `main` and every pull request, never npm: `npm install https://pkg.pr.new/hotcodepush-team/expo-ota-updates/@hotcodepush/expo-ota-updates@<sha>`.
A consumer pins a commit and bumps it deliberately — never `@main`, whose moving content breaks `npm ci` against the lockfile's integrity hash.
The React Native package comes the same way; its native code, its API and the commit of `HotCodePushProtocol` the Podfile pins all arrive as a bump of that sha.
The demo and the CLI's `init` each pin a commit of this package.

## Rules

- **An edit is recognised by what it wrote** and left as it is: the phase by its script's name in any shell phase, the pod by its `pod 'HotCodePushProtocol'` line, the Gradle line by `hotcodepush.gradle`, the bundle URL by `HotCodePush.bundleURL()`, the host by the SDK's import. A second prebuild changes no file, so an edit that changes its shape reaches a prebuilt project only through `npx expo prebuild --clean`.
- **An edit that finds no place throws**, and the message names the file and what it lacks: no bundling phase, no embedded `main.jsbundle` returned from `bundleURL()`, no `use_native_modules!` line, a build file that is not Groovy, no Expo React host. Never a silent skip: the error fails the prebuild.
- **A file of the React Native package is resolved through this package**, by `buildReactNativePackageFileResolution`: an isolated install, pnpm's by default, keeps the React Native package out of the app's `node_modules`. No path into `node_modules` is written into a native file.
- **The API is the React Native package's.** `src/index.ts` re-exports it and adds nothing; an app imports from this package.
- **Every edit and every error has a test** in `src/plugin/index.test.ts`, run over a copy of the fixture, the output of `expo-template-bare-minimum` 55.0.43.
- **No Expo Go, no `expo-updates` beside it.** The SDK's native code needs a development build or a release build, and nothing here handles an enabled `expo-updates`, which decides the app's bundle itself.

## Agent workspace

- `.claude/skills/` holds the developer skills copied from `hotcodepush-team/.github`, pinned in `skills-lock.json`.
- Commits are conventional commits; `main` is trunk, CI is the gate, and a commit that lands an issue says `Closes #<n>`.
