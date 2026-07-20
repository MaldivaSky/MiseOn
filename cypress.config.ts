import { defineConfig } from 'cypress';
import coverageTask from '@cypress/code-coverage/task';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on, config) {
      coverageTask(on, config);
      return config;
    },
    retries: {
      runMode: 2,
      openMode: 0
    },
    video: false,
    screenshotOnRunFailure: true
  }
});
