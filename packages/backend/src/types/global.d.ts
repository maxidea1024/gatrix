// Global type declarations for test environment

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidEmail(): R;
    }
  }

  var testUtils: {
    createTestUser: (overrides?: any) => any;
    createTestAdmin: (overrides?: any) => any;
  };
}

export {};
