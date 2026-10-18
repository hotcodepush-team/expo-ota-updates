import { describe, expect, it, vi } from 'vitest';
import { HotCodePush } from '.';

// Expo Go carries no native module of ours: React Native's registry answers the module's name with null
vi.mock('react-native', () => ({
  TurboModuleRegistry: { get: () => null },
}));

describe('HotCodePush', () => {
  it('should reject sync with the build live updates need when the native module is missing', async () => {
    await expect(HotCodePush.sync()).rejects.toThrow(
      'Live updates need a development or release build; they are not available on the web or in Expo Go.',
    );
  });
});
