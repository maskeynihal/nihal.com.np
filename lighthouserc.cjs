module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      settings: { chromeFlags: '--no-sandbox' },
    },
    assert: {
      assertMatrix: [
        {
          // Every page.
          matchingUrlPattern: '.*',
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
            'total-blocking-time': ['error', { maxNumericValue: 150 }],
            'categories:accessibility': ['error', { minScore: 1 }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
          },
        },
        {
          // SEO and best practices on the home page only: /404 and /sent are noindex by design.
          matchingUrlPattern: '^http://localhost:\\d+/(index\\.html)?$',
          assertions: {
            'categories:seo': ['error', { minScore: 1 }],
          },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
