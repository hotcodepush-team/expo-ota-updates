// Resolves through this package, which the app depends on directly.
// An isolated install, such as pnpm by default, keeps the React Native package out of the app's `node_modules`.
export function buildReactNativePackageFileResolution(
  filePath: string,
): string {
  return `require.resolve('@hotcodepush/react-native-code-push/${filePath}', { paths: [require.resolve('@hotcodepush/expo-ota-updates/package.json')] })`;
}
