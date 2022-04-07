const dotenv = require('dotenv');
const fs = require('fs');
const chalk = require('chalk');

module.exports = {
  /**
   * Merges any env vars defined in the root .env file with the env vars in process.env
   */
  read: function () {
    const dotEnvFileLocation = './.env';

    const dotEnvFileExists = fs.existsSync(dotEnvFileLocation);

    if (!dotEnvFileExists) {
      return process.env;
    }

    const dotEnvResult = dotenv.config({
      path: dotEnvFileLocation,
    });

    if (dotEnvResult.error) {
      console.error(`
${chalk.red('Error parsing .env file')}

${chalk.red(dotEnvResult.error)}
`);

      process.exit(1);
    }

    // if there's no error, we assume that the `parsed` key holds the values
    return { ...process.env, ...dotEnvResult.parsed };
  },
  /**
   * Checks that the provided `env` contains each of the required env vars and kills the process (with an error message) if any are missing
   */
  validate: function (env, requiredEnvVars) {
    const missingEnvVars = requiredEnvVars.filter(
      (envVarName) => env[envVarName] === undefined,
    );

    if (missingEnvVars.length > 0) {
      console.error(`
${chalk.red(
  'The following env vars must be defined in order to execute this command',
)}

${missingEnvVars.join(', ')}

${chalk.yellow(
  'If you are running this command locally, you can define those env vars for this project by creating a file called .env at the project root with the format:',
)}

// .env

${missingEnvVars.map((missingEnvVar) => `${missingEnvVar} = value`).join('\n')}

${chalk.yellow(
  'If you are running this command within a CI environment, make sure that those env vars are properly injected into the CI runner',
)}
  `);

      process.exit(1);
    }
  },
};
