/**
 * Type declarations for CocosCreator global API
 *
 * In CocosCreator 2.x and 3.x, `cc` is a global namespace.
 * These declarations provide just enough typing for the SDK to compile
 * without depending on the full CocosCreator type package.
 */

declare namespace cc {
  namespace sys {
    /** CocosCreator's localStorage wrapper (available on all platforms) */
    const localStorage: {
      getItem(key: string): string | null;
      setItem(key: string, value: string): void;
      removeItem(key: string): void;
    };
  }
}
