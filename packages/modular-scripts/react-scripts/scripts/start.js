'use strict';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', (err) => {
  throw err;
});

const fs = require('fs');
const chalk = require('chalk');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const { clearConsole, log } = require('../../react-dev-utils/logger');
const {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls,
} = require('../../react-dev-utils/WebpackDevServerUtils');
const openBrowser = require('../../react-dev-utils/openBrowser');
const isCI = require('is-ci');

const paths = require('../config/paths');
const configFactory = require('../config/webpack.config');
const createDevServerConfig = require('../config/webpackDevServer.config');
const isInteractive = process.stdout.isTTY;

// Tools like Cloud9 rely on this.
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
if (process.env.HOST) {
  log(
    chalk.cyan(
      `Attempting to bind to HOST environment variable: ${chalk.yellow(
        chalk.bold(process.env.HOST),
      )}`,
    ),
  );
  log(
    `If this was unintentional, check that you haven't mistakenly set it in your shell.`,
  );
  log(`Learn more here: ${chalk.yellow('https://cra.link/advanced-config')}`);
  log();
}

choosePort(HOST, DEFAULT_PORT)
  .then(async (port) => {
    if (port == null) {
      // We have not found a port.
      return;
    }

    const config = configFactory('development');
    // overload for webpack-dev-server@4
    config.stats = 'none';
    config.infrastructureLogging = {
      level: 'none',
    };

    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
    const appName = require(paths.appPackageJson).name;

    const useTypeScript = !isCI && fs.existsSync(paths.appTsConfig);
    const urls = prepareUrls(
      protocol,
      HOST,
      port,
      paths.publicUrlOrPath.slice(0, -1),
    );
    // Create a webpack compiler that is configured with custom messages.
    // Only run typecheck if not in CI env
    const compiler = createCompiler({
      appName,
      config,
      urls,
      useTypeScript,
      webpack,
    });

    // Load proxy config
    const proxySetting = require(paths.appPackageJson).proxy;
    const proxyConfig = prepareProxy(
      proxySetting,
      paths.appPublic,
      paths.publicUrlOrPath,
    );
    // Serve webpack assets generated by the compiler over a web server.
    const serverConfig = createDevServerConfig(
      port,
      proxyConfig,
      urls.lanUrlForConfig,
    );
    const devServer = new WebpackDevServer(serverConfig, compiler);

    if (isInteractive) {
      clearConsole();
    }

    // Launch WebpackDevServer.
    log(chalk.cyan('Starting the development server...'));

    await devServer.start();

    openBrowser(urls.localUrlForBrowser);

    ['SIGINT', 'SIGTERM'].forEach(function (sig) {
      process.on(sig, function () {
        devServer.close();
        process.exit();
      });
    });

    // Gracefully exit when stdin ends
    process.stdin.on('end', function () {
      devServer.close();
      process.exit();
    });
  })
  .catch((err) => {
    if (err && err.message) {
      log(err.message);
    }
    process.exit(1);
  });
