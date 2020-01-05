#!/usr/bin/env node

const spawn = require('cross-spawn');
const localEnv = require('@tripphamm/trippkit/utils/env');

const env = localEnv.read();

localEnv.validate(env, ['GITHUB_TOKEN', 'NPM_TOKEN']);

const spawnOpts = {
  env,
  encoding: 'utf8',
  stdio: 'inherit',
};

// in CI we need to embed our github token into the origin url so that we can push a commit
if (env['CI'] === true) {
  const repository = require('./package.json').repository;

  // we need to inject the auth info after the prefix and before the rest

  const prefix = 'https://';

  if (!repository.startsWith(prefix)) {
    console.error(`Expected repository to start with ${prefix}. Got,`, repository);
    process.exit(1);
  }

  const authenticatedGitOrigin = [
    repository.slice(0, prefix.length),
    `tripphamm:${env['GITHUB_TOKEN']}@`,
    repository.slice(prefix.length),
  ].join('');

  const gitSetOriginResult = spawn.sync(
    'git',
    ['remote', 'set-origin', authenticatedGitOrigin],
    spawnOpts,
  );

  if (gitSetOriginResult.status !== 0) {
    process.exit(gitSetOriginResult.status);
  }
}

// // --ci false skips the only-ci check
// // this allows us to execute the release locally if we want
const semanticReleaseResult = spawn.sync('semantic-release', ['--ci', 'false'], spawnOpts);

if (semanticReleaseResult.status !== 0) {
  process.exit(semanticReleaseResult.status);
}

// semantic-release should have tagged the latest commit with the new version
// we'll use git to grab that tag in order to figure out the proper version to use
const gitVersionResult = spawn.sync('git', ['describe', '--tags'], {
  ...spawnOpts,
  // change stdio to pipe so that we can get access to the output
  stdio: 'pipe',
});

if (gitVersionResult.status !== 0) {
  process.exit(gitVersionResult.status);
}

const version = gitVersionResult.stdout.trim();

if (/^v\d+\.\d+\.\d+$/.test(version) === false) {
  console.error('Unexpected version', version);
  process.exit(1);
}

// remove the "v"
const versionNumber = version.slice(1);

const lernaVersionResult = spawn.sync(
  'lerna',
  [
    'version',
    versionNumber,
    '--yes',
    '--message',
    'Chore: Release',
    '--tag-version-prefix',
    'lerna-v',
  ],
  spawnOpts,
);

if (lernaVersionResult.status !== 0) {
  process.exit(lernaVersionResult.status);
}

const lernaPublishResult = spawn.sync(
  'lerna',
  ['publish', 'from-package', '--yes', '--message', `Chore: Release ${version} [skip ci]`],
  spawnOpts,
);

if (lernaPublishResult.status !== 0) {
  process.exit(lernaPublishResult.status);
}
