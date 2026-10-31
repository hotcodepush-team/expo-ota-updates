import { describe, expect, it, vi } from 'vitest';
import { HotCodePush } from '.';

// Expo Go has no HotCodePush native module, so the registry returns null for it.
vi.mock('react-native', () => ({
  TurboModuleRegistry: { get: () => null },
}));

describe('HotCodePush', () => {
  it('should reject sync with the build OTA updates need when the native module is missing', async () => {
    await expect(HotCodePush.sync()).rejects.toThrow(
      'Over-the-air (OTA) updates need a development or release build; they are not available on the web or in Expo Go.',
    );
  });
});
