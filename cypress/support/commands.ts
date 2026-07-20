import '@cypress/code-coverage/support';

declare global {
  namespace Cypress {
    interface Chainable {
      mockAuth(userId?: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('mockAuth', (userId = '00000000-0000-0000-0000-000000000000') => {
  const session = {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Test User' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  cy.window().then((win) => {
    // VITE_SUPABASE_URL might be undefined in tests, so we use a generic matching for the storage key
    // Usually it's sb-<project-ref>-auth-token
    // Let's just set it for any project ref we can guess, or better, we can inject window.Cypress auth mock
    win.localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(session));
    // Since our app uses 'placeholder-anon-key', we can assume the project ref is 'placeholder'
  });

  // Intercept the auth endpoint to return the user
  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: session.user,
  }).as('getUser');
});
