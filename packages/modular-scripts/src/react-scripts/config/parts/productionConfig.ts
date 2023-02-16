import path from 'path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { Paths } from '../../../utils/createPaths';
import { Configuration } from 'webpack';

export function createProductionConfig(
  shouldUseSourceMap: boolean,
  paths: Paths,
): Configuration {
  return {
    mode: 'production',
    // Stop compilation early in production
    bail: true,
    devtool: shouldUseSourceMap ? 'source-map' : false,
    output: {
      // The build folder.
      path: paths.appBuild,
      pathinfo: false,
      // There will be one main bundle, and one file per asynchronous chunk.
      filename: 'static/js/[name].[contenthash:8].js',
      // There are also additional JS chunk files if you use code splitting.
      // Please remember that Webpack 5, unlike Webpack 4, controls "splitChunks" via fileName, not chunkFilename - https://stackoverflow.com/questions/66077740/webpack-5-output-chunkfilename-not-working
      chunkFilename: 'static/js/[name].[contenthash:8].chunk.js',
      // Point sourcemap entries to original disk location (format as URL on Windows)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      devtoolModuleFilenameTemplate: (info: any) =>
        path
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          .relative(paths.appSrc, info.absoluteResourcePath)
          .replace(/\\/g, '/'),
    },
    optimization: {
      minimize: true,
    },
  };
}

export function createProductionPluginConfig() {
  return {
    plugins: [
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: 'static/css/[name].[contenthash:8].css',
        chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
      }),
    ].filter(Boolean),
  };
}
