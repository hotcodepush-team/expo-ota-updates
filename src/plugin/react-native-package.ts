/**
 * The Node expression that resolves a file of the React Native package through this package, the one the app depends
 * on, as the Expo template resolves its own transitive packages: an isolated install, pnpm's by default, keeps the
 * React Native package out of the app's `node_modules`.
 */
export function buildReactNativePackageFileResolution(
  filePath: string,
): string {
  return `require.resolve('@hotcodepush/react-native-code-push/${filePath}', { paths: [require.resolve('@hotcodepush/expo-ota-updates/package.json')] })`;
}
