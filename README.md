# JSKit

Common configurations and scripts for my js/ts projects

> Disclaimer: This is really only built for personal use. I suggest forking and using it as inspiration if you like what's going on. I make no guarantees about breaking changes etc.

## Install

```
yarn add -D @ejhammond/jskit
```

Auto-generate all config files:

```
yarn run jskit-bootstrap
```

### App vs Library

Apps are services/websites. JSKit is rather unopinionated about apps. You'll get formatting and linting configurations.

Libraries are reusable modules that are distributed via NPM. In addition to formatting and linting, JSKit will also configure automated releases so that the library is automatically versioned and released whenever you push a commit.

### Build and Test Scripts

If you selected `library` in the first step, you'll be asked about your library's build and test steps. JSKit uses this info in order to ensure that you library is built and tested before each release. Concretely, JSKit will add `yarn {buildCommand}` and `yarn {testCommand}` steps to the CircleCI configuration. You can always update this later by editing `.circleci/config.yml`.

### Frameworks

This step is mostly related to the linter. JSKit will include a base set of linting rules by default, and can augment those rules with framework-specific rules based on your selections.

> Tip: You can always modify the generated .eslintrc.js file after it's generated in order to add your own overrides

### What's Next?

Based on your selections, JSKit will generate a set of configuration files for you. Once those configuration files are generated, you're free to make any edits that you'd like. JSKit does not seek to manage those files after the initial bootstrap.

- if we encountered any conflicts with existing files, we will have produced a config with `.jskit` appended to the name. Take a look at your own versions and compare them to the `jskit` versions choose which one you'd like to keep, and remove the other. If you're keeping the `.jskit` version, you must rename the file and remove the `.jskit` suffix.
- if you selected `library` as your project type, you'll need to head over to the CircleCI website and click a button in order for CircleCI to start monitoring your repo.

## What's Included?

### Base

The following configurations are included in both `app` and `library` setups.

#### Eslint

Enforce code quality best-practices.

An `.eslintrc.js` file will be created. It will include a base set of recommended rules from ESLint plus rules for TypeScript projects. Depending on your framework selections during bootstrap, it may also include rules for React/JSX.

```js
// .eslintrc.js

module.exports = {
  extends: [
    'plugin:@ejhammond/react',
    // or
    'plugin:@ejhammond/node',
  ],
};
```

A package.json script will be added so that you can run the linter manually. Although, it is recommended that you integrate ESLint with your editor so that you can get live feedback as you code.

```json
// package.json

{
  ...
  "scripts": {
    ...
    "lint": "jskit-lint"
  }
}
```

#### Prettier

Enable automatic code formatting.

A `.prettierrc.js` file will be created.

```js
// .prettierrc.js

module.exports = require('@ejhammond/jskit/configs/shared/prettier');
```

A package.json script will be added so that you can run the formatter manually. Although, it is recommended that you integrate Prettier with your editor so that your code can be auto-formatted every time you save.

```json
// package.json

{
  ...
  "scripts": {
    ...
    "format": "jskit-format"
  }
}
```

#### EditorConfig

Prettier can auto-format your code for you, but it would be nice if your editor knew about your desired formatting ahead of time. EditorConfig configures the editor to use the proper formatting by default. This makes sure that your editor knows things like whether to use spaces or tabs and whether or not you'd like a newline at the end of your files.

[There's no way to "extend" an EditorConfig](https://github.com/editorconfig/editorconfig/issues/236), so rather than abstracting the configuration away, the raw config is exposed in the `.editorconfig` file.

#### Lint-Staged

Enables us to run our auto-formatter and linter on staged files. When combined with Husky, this ensures that all commits are formatted and that they don't introduce lint errors.

A `lint-staged.config.js` file will be created.

```js
// lint-staged.config.js

module.exports = require('@ejhammond/jskit/configs/shared/lint-staged');
```

#### Husky

Allows us to run scripts as part of the Git lifecycle. When combined with Lint-Staged, this ensures that all commits are formatted and that they don't introduce lint errors.

If your project is a `library`, we also leverage Husky to run our commit-message validator.

A `.huskyrc.js` file will be created.

```js
//.huskyrc.js

module.exports = require('@ejhammond/jskit/configs/{library|app}/husky');
```

### Library Only

The following configs are only included if you select the `library` option during the `bootstrap` phase.

Before we dive in to the specific configs, it's important to understand the idea of a commit-convention.

We enforce a commit-message convention so that we can automatically create releases with nice release notes and deterministic version-bumps.

For simplicity, there are only 4 types of commits and they correspond directly to the type of version-bump that would be required.

- Chore - some internal change that has no bearing on the exported artifacts / app (no version bump, no release)
- Fix - a non-breaking bug fix (patch version bump, release)
- New - a non-breaking new feature (minor version bump, release)
- Breaking - a breaking change (major version bump, release)

e.g.

> Chore: Update readme

> Fix: Check for null before executing logic

> New: Add Carousel component

> Breaking: Remove bad API, add new API

#### Commitlint

Allows us to encode our commit-message convention and to validate commit messages. When combined with Husky, we can validate commit each commit message and we can provide immediate feedback to the developer during the commit process.

A `commitlint.config.js` file will be created.

```js
//commitlint.config.js

module.exports = require('@ejhammond/jskit/configs/library/commitlint');
```

#### Semantic Release

Runs during CI builds.

Here's the process:

1. Analyze commits (leveraging the commit-message convention) to determine the next version number
2. Write new version number to package.json
3. Commit the version bump and tag that commit with the version
4. Push that commit to GitHub
5. Generate release notes based on the commit messages
6. Publish the release notes on GitHub
7. Publish the library on NPM

This is a _huge_ convenience and it's the primary reason that we adopt the strict commit-message convention.

##### Dependencies

In order for this to work, we need write-access to GitHub and NPM. Therefore, `GITHUB_TOKEN` and `NPM_TOKEN` env variables must be defined in order for the release to work.

You should ensure that those two environment variables are defined within your CI tool.

##### Local Releases

In order to support local releases, JSKit supports the `.env` pattern.

You can add a `.env` file at the root of your project with the required environment variables and JSKit will read those during the release process.

> Important! Be careful not to commit your secret tokens to your repository. You don't want anyone to be able to impersonate your GitHub/NPM accounts using those tokens.

```
// .env

// don't forget to .gitignore this file!

GITHUB_TOKEN = abcdefghijklmnopqrstuvwxyz
NPM_TOKEN = abcdefghijklmnopqrstuvwxyz
```

Once the environment is set up, simply build your library (e.g. `yarn build`) and then run `yarn release`.

##### Config

A `.releaserc.js` file will be created.

```js
// .releaserc.js

module.exports = require('@ejhammond/jskit/configs/library/semantic-release');
```

##### Script

The `bootstrap` process will add a script called `release` in your package.json.

```json
// package.json

{
  ...
  "scripts": {
    ...
    "release": "jskit-release"
  }
}
```

#### CircleCI

In order to build and release our library when we push changes, we utilize CircleCI. JSKit will generate a `.circleci/config.yml` file which will install, build, test, and release your library every time a change is pushed to the `master` branch.

#### Dependabot

GitHub's Dependabot will scan your library for vulnerable dependencies and will open Pull Requests in order to update those dependencies. In order to ensure that Dependabot follows our commit-message convention, JSKit includes a `.dependabot` config which tells Dependabot to prefix its commit messages with "Fix".
