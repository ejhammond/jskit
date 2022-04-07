module.exports = {
  branch: 'master',
  preset: 'eslint',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    // publish to NPM
    [
      '@semantic-release/npm',
      {
        npmPublish: true,
        pkgRoot: '.',
      },
    ],
    // publish release notes
    '@semantic-release/github',
    // commit the package.json
    [
      '@semantic-release/git',
      {
        assets: ['package.json'],
        message:
          'Chore: ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
