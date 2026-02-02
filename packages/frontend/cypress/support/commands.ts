/// <reference types="cypress" />

// Custom commands for Gatrix application

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login with email and password
       * @example cy.login('admin@motifgames.com', 'admin123')
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Custom command to login as admin
       * @example cy.loginAsAdmin()
       */
      loginAsAdmin(): Chainable<void>;

      /**
       * Custom command to login as regular user
       * @example cy.loginAsUser()
       */
      loginAsUser(): Chainable<void>;

      /**
       * Custom command to logout
       * @example cy.logout()
       */
      logout(): Chainable<void>;

      /**
       * Custom command to wait for page to load
       * @example cy.waitForPageLoad()
       */
      waitForPageLoad(): Chainable<void>;

      /**
       * Custom command to check if user is authenticated
       * @example cy.shouldBeAuthenticated()
       */
      shouldBeAuthenticated(): Chainable<void>;

      /**
       * Custom command to check if user is not authenticated
       * @example cy.shouldNotBeAuthenticated()
       */
      shouldNotBeAuthenticated(): Chainable<void>;
    }
  }
}

// Login command
Cypress.Commands.add("login", (email: string, password: string) => {
  cy.visit("/login");
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.waitForPageLoad();
});

// Login as admin
Cypress.Commands.add("loginAsAdmin", () => {
  cy.login("admin@motifgames.com", "admin123");
});

// Login as user (you'll need to create a test user)
Cypress.Commands.add("loginAsUser", () => {
  cy.login("user@example.com", "password123");
});

// Logout command
Cypress.Commands.add("logout", () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-button"]').click();
  cy.waitForPageLoad();
});

// Wait for page to load
Cypress.Commands.add("waitForPageLoad", () => {
  cy.get('[data-testid="loading"]', { timeout: 10000 }).should("not.exist");
});

// Check if authenticated
Cypress.Commands.add("shouldBeAuthenticated", () => {
  cy.get('[data-testid="user-menu"]').should("exist");
  cy.url().should("not.include", "/login");
});

// Check if not authenticated
Cypress.Commands.add("shouldNotBeAuthenticated", () => {
  cy.get('[data-testid="user-menu"]').should("not.exist");
  cy.url().should("include", "/login");
});

// Prevent TypeScript errors
export {};
