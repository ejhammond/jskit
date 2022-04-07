#!/usr/bin/env node

const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const { format } = require('prettier');
const prompts = require('prompts');
const prettierConfig = require('../configs/shared/prettier');

const nodeVersion = '17.2';

function formatWithParser(content, parser) {
  return format(content, { ...prettierConfig, parser });
}
function formatJS(js) {
  return formatWithParser(js, 'babel');
}

function formatYML(yml) {
  return formatWithParser(yml, 'yaml');
}

function formatJSON(json) {
  return formatWithParser(json, 'json-stringify');
}

function formatINI(ini) {
  // prettier doesn't support formatting .ini files yet, so we'll do a basic formatting
  // removes any leading whitespace and ensures that there's exactly one trailing newline
  return ini.trim() + '\n';
}

function createFile(fileName, content) {
  return new Promise((resolve, reject) => {
    try {
      fs.exists(fileName, (exists) => {
        mkdirp(path.dirname(fileName), (mkdirpErr) => {
          if (mkdirpErr) {
            reject(mkdirpErr);
            return;
          }

          fs.writeFile(
            `${fileName}${exists ? '.jskit' : ''}`,
            content,
            { encoding: 'utf8' },
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            },
          );
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

const packageJSON = JSON.parse(
  fs.readFileSync('./package.json', { encoding: 'utf8' }),
);

function addPackageJSONScript(scriptName, script) {
  if (packageJSON.scripts === undefined) {
    packageJSON.scripts = {};
  }

  if (packageJSON.scripts[scriptName] !== undefined) {
    console.log(
      `JSKit encountered a conflict when trying to create a package.json script with the content: "${scriptName}": "${script}"`,
    );
    return;
  }

  packageJSON.scripts[scriptName] = script;
}

async function eslint({ frameworks }) {
  const pluginMap = {
    react: 'plugin:@ejhammond/react',
    node: 'plugin:@ejhammond/node',
  };

  const plugins = frameworks.map((fw) => pluginMap[fw]);

  // each of the framework plugins inherits from the base
  // if we don't include any frameworks, that's fine
  // but we must explicitly add the base config in that case
  if (plugins.length === 0) {
    plugins.push('plugin:@ejhammond/base');
  }

  await createFile(
    './.eslintrc.js',
    formatJS(
      `module.exports = { extends: [ ${plugins
        .map((p) => `"${p}"`)
        .join(', ')} ] };`,
    ),
  );

  addPackageJSONScript('lint', 'jskit-lint');
}

async function prettier() {
  await createFile(
    './.prettierrc.js',
    formatJS(
      "module.exports = require('@ejhammond/jskit/configs/shared/prettier');",
    ),
  );

  addPackageJSONScript('format', 'jskit-format');
}

async function editorConfig() {
  return createFile(
    './.editorconfig',
    formatINI(`
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
    `),
  );
}

async function lintStaged() {
  return createFile(
    './lint-staged.config.js',
    formatJS(
      "module.exports = require('@ejhammond/jskit/configs/shared/lint-staged');",
    ),
  );
}

async function husky({ projectType }) {
  return createFile(
    './.huskyrc.js',
    formatJS(
      `module.exports = require('@ejhammond/jskit/configs/${projectType}/husky');`,
    ),
  );
}

async function semanticRelease({
  projectType,
  hasBuildCommand,
  hasTestCommand,
  buildCommand,
  testCommand,
}) {
  if (projectType !== 'library') {
    return;
  }

  const ciSteps = [
    'checkout',
    'run: yarn install',
    hasBuildCommand ? `run: yarn ${buildCommand}` : null,
    hasTestCommand ? `run: yarn ${testCommand}` : null,
    'run: yarn release',
  ].filter(Boolean);

  await Promise.all([
    createFile(
      './commitlint.config.js',
      formatJS(
        "module.exports = require('@ejhammond/jskit/configs/library/commitlint');",
      ),
    ),
    createFile(
      './.releaserc.js',
      "module.exports = require('@ejhammond/jskit/configs/library/semantic-release')",
    ),
    createFile(
      './.circleci/config.yml',
      formatYML(`
version: 2
jobs:
  release:
    docker:
      - image: circleci/node:${nodeVersion}
    working_directory: ~/repo
    steps:
${ciSteps.map((s) => `      - ${s}`).join('\n')}
workflows:
  version: 2
  release-workflow:
    jobs:
      - release:
          context: semantic-release
          filters:
            branches:
              only: master
        `),
    ),
    createFile(
      './.github/dependabot.yml',
      formatYML(`
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    commit-message:
      prefix: "Fix"
    `),
    ),
  ]);

  addPackageJSONScript('release', 'jskit-release');
}

async function node() {
  // add engines.node to packageJSON

  if (packageJSON.engines === undefined) {
    packageJSON.engines = {};
  }

  if (packageJSON.engines.node !== undefined) {
    console.warn(
      `JSKit wanted to set the Node engine to ${nodeVersion} but it is already set to ${packageJSON.engines.node}`,
    );
    return;
  }

  packageJSON.engines.node = nodeVersion;

  // create nvmrc

  return createFile('./.nvmrc', `${nodeVersion}\n`);
}

function onlyIfLibrary(type) {
  return (_, { projectType }) => (projectType === 'library' ? type : null);
}

async function bootstrap() {
  const questions = [
    {
      name: 'projectType',
      type: 'select',
      message: 'What type of project is this?',
      choices: [
        {
          title: 'Library',
          description:
            'Distributed via NPM [includes Semantic Release and CircleCI]',
          value: 'library',
        },
        {
          title: 'App',
          description: 'Published as a webiste or service',
          value: 'app',
        },
      ],
    },
    {
      name: 'hasBuildCommand',
      type: onlyIfLibrary('confirm'),
      message: 'Does the library have a build step?',
    },
    {
      name: 'buildCommand',
      // only ask this if this is a library and it has a build command
      type: (_, { hasBuildCommand, projectType }) =>
        hasBuildCommand === true && projectType === 'library' ? 'text' : null,
      message: 'What yarn command will build your library?',
      initial: 'build',
      validate: (input) =>
        !/\s/.test(input) ||
        'Input should be the name of a yarn script e.g. "build"',
    },
    {
      name: 'hasTestCommand',
      type: onlyIfLibrary('confirm'),
      message: 'Does the library have a test step?',
    },
    {
      name: 'testCommand',
      // only ask this if this is a library and it has a test command
      type: (_, { hasTestCommand, projectType }) =>
        hasTestCommand === true && projectType === 'library' ? 'text' : null,
      message: 'What yarn command will test your library?',
      initial: 'test',
      validate: (input) =>
        !/\s/.test(input) ||
        'Input should be the name of a yarn script e.g. "test"',
    },
    {
      name: 'frameworks',
      type: 'multiselect',
      message: 'What frameworks are you using?',
      choices: [
        {
          title: 'Node',
          value: 'node',
          description: 'e.g. terminal script or Express service',
        },
        {
          title: 'React',
          value: 'react',
          description: 'e.g. a web-app or component library',
        },
      ],
      instructions: false,
      hint: '- Use <Space> to select and <Enter> to submit',
    },
  ];

  const config = await prompts(questions, { onCancel: () => process.exit(0) });

  await eslint(config);
  await editorConfig(config);
  await prettier(config);
  await lintStaged(config);
  await husky(config);
  await node(config);
  await semanticRelease(config);

  fs.writeFileSync('./package.json', formatJSON(JSON.stringify(packageJSON)), {
    encoding: 'utf8',
  });
}

bootstrap();
