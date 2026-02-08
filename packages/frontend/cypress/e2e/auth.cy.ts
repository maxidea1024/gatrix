describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear any existing sessions
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Login Page', () => {
    it('should display login form', () => {
      cy.visit('/login');
      cy.get('input[name="email"]').should('be.visible');
      cy.get('input[name="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('contain', 'Sign In');
    });

    it('should show validation errors for empty fields', () => {
      cy.visit('/login');
      cy.get('button[type="submit"]').click();
      cy.get('form').should('contain', 'Email is required');
      cy.get('form').should('contain', 'Password is required');
    });

    it('should show error for invalid email format', () => {
      cy.visit('/login');
      cy.get('input[name="email"]').type('invalid-email');
      cy.get('input[name="password"]').type('password123');
      cy.get('button[type="submit"]').click();
      cy.get('form').should('contain', 'Please enter a valid email address');
    });

    it('should login successfully with valid credentials', () => {
      cy.visit('/login');
      cy.get('input[name="email"]').type('admin@motifgames.com');
      cy.get('input[name="password"]').type('admin123');
      cy.get('button[type="submit"]').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      cy.shouldBeAuthenticated();
    });

    it('should show error for invalid credentials', () => {
      cy.visit('/login');
      cy.get('input[name="email"]').type('admin@motifgames.com');
      cy.get('input[name="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();

      cy.get('[role="alert"]').should('contain', 'Invalid credentials');
    });

    it('should toggle password visibility', () => {
      cy.visit('/login');
      cy.get('input[name="password"]').should('have.attr', 'type', 'password');
      cy.get('[aria-label="toggle password visibility"]').click();
      cy.get('input[name="password"]').should('have.attr', 'type', 'text');
    });

    it('should navigate to register page', () => {
      cy.visit('/login');
      cy.get('a').contains('Sign Up').click();
      cy.url().should('include', '/register');
    });
  });

  describe('Register Page', () => {
    it('should display register form', () => {
      cy.visit('/register');
      cy.get('input[name="name"]').should('be.visible');
      cy.get('input[name="email"]').should('be.visible');
      cy.get('input[name="password"]').should('be.visible');
      cy.get('input[name="confirmPassword"]').should('be.visible');
      cy.get('button[type="submit"]').should('contain', 'Sign Up');
    });

    it('should show validation errors', () => {
      cy.visit('/register');
      cy.get('button[type="submit"]').click();
      cy.get('form').should('contain', 'Name is required');
      cy.get('form').should('contain', 'Email is required');
      cy.get('form').should('contain', 'Password is required');
    });

    it('should validate password confirmation', () => {
      cy.visit('/register');
      cy.get('input[name="name"]').type('Test User');
      cy.get('input[name="email"]').type('test@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('differentpassword');
      cy.get('button[type="submit"]').click();

      cy.get('form').should('contain', 'Passwords must match');
    });

    it('should register successfully', () => {
      const timestamp = Date.now();
      const email = `test${timestamp}@example.com`;

      cy.visit('/register');
      cy.get('input[name="name"]').type('Test User');
      cy.get('input[name="email"]').type(email);
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('password123');
      cy.get('button[type="submit"]').click();

      // Should show success message
      cy.get('h4').should('contain', 'Registration Successful');
      cy.get('button').contains('Sign In').should('be.visible');
    });

    it('should navigate to login page', () => {
      cy.visit('/register');
      cy.get('a').contains('Sign In').click();
      cy.url().should('include', '/login');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route without authentication', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });

    it('should redirect to dashboard after login', () => {
      // Try to access protected route
      cy.visit('/profile');
      cy.url().should('include', '/login');

      // Login
      cy.get('input[name="email"]').type('admin@motifgames.com');
      cy.get('input[name="password"]').type('admin123');
      cy.get('button[type="submit"]').click();

      // Should redirect to originally requested page
      cy.url().should('include', '/profile');
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
    });

    it('should logout successfully', () => {
      cy.logout();
      cy.shouldNotBeAuthenticated();
      cy.url().should('include', '/login');
    });
  });

  describe('Admin Routes', () => {
    it('should allow admin access to admin routes', () => {
      cy.loginAsAdmin();
      cy.visit('/admin/users');
      cy.url().should('include', '/admin/users');
      cy.get('h1').should('contain', 'User Management');
    });

    it('should deny regular user access to admin routes', () => {
      // This test would need a regular user account
      // cy.loginAsUser();
      // cy.visit('/admin/users');
      // cy.url().should('include', '/unauthorized');
    });
  });
});
