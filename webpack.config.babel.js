// @ts-check

/* @noflow */

import path from 'path';

import InertEntryPlugin from 'inert-entry-webpack-plugin';
import ZipPlugin from 'zip-webpack-plugin';
import sass from 'sass';
import { globSync } from 'glob';
import { RawSource } from 'webpack-sources';
import { DefinePlugin } from 'webpack';

const browserConfig = {
	chrome: {
		target: 'chrome',
		entry: 'chrome/manifest.json',
		output: 'chrome',
		mv3: true,
	},
	chromebeta: {
		target: 'chrome',
		entry: 'chrome/beta/manifest.json',
		output: 'chrome-beta',
		mv3: true,
	},
	firefox: {
		target: 'firefox',
		entry: 'firefox/manifest.json',
		output: 'firefox',
		noSourcemap: true,
	},
	opera: {
		target: 'opera',
		entry: 'chrome/manifest.json',
		output: 'opera',
		noSourcemap: true,
	},
	edge: {
		target: 'edge',
		entry: 'chrome/manifest.json',
		output: 'edge',
	},
};

export default /** @satisfies {( env: Record<string, any>, argv: Record<string, any>) => (import('webpack').Configuration | ArrayLike<import('webpack').Configuration>)} */ ((env = {}, argv = {}) => {
	const isProduction = argv.mode === 'production';
	const browsers = /** @type {(keyof browserConfig)[]} */ (
		typeof env.browsers !== 'string' ? ['chrome'] :
		env.browsers === 'all' ? Object.keys(browserConfig) :
		env.browsers.split(',')
	);

	const configs = browsers.map(b => browserConfig[b]).map(conf => /** @satisfies {import('webpack').Configuration} */ ({
		entry: {
			main: {
				import: `extricate-loader!interpolate-loader!./${conf.entry}`,
				filename: 'ignoreme.js',
			},
			...globSync('**.entry.js', { ignore: 'node_modules/**' }).reduce((accum, entry) => {
				accum[entry] = {
					import: entry,
				};
				return accum;
			}, /** @type {import('webpack').EntryObject} */ ({})),
		},
		output: {
			path: path.join(__dirname, 'dist', conf.output),
			filename: path.basename(conf.entry),
			publicPath: '/',
		},
		devtool: (() => {
			if (!isProduction) return 'source-map';
			if (!conf.noSourcemap) return 'source-map';
			return false;
		})(),
		node: false,
		performance: false,
		module: {
			rules: [{
				include: path.resolve(conf.entry),
				use: [
					{ loader: 'extricate-loader' },
					{ loader: 'interpolate-loader' },
				],
				type: 'asset/resource',
				generator: {
				  filename: 'manifest.json',
				},
			}, {
				test: /\.entry\.js$/,
				use: [
					{ loader: 'spawn-loader' },
				],
			}, {
				test: /\.js$/,
				exclude: path.join(__dirname, 'node_modules'),
				use: [
					{ loader: 'esbuild-loader' },
					{
						loader: 'babel-loader',
						options: {
							plugins: [
								'@babel/plugin-proposal-optional-chaining',
								'@babel/plugin-proposal-export-namespace-from',
								['@babel/plugin-proposal-class-properties', { loose: true }],
								'@babel/plugin-transform-flow-strip-types',
								'minify-dead-code-elimination',
								['transform-define', {
									'process.env.BUILD_TARGET': conf.target,
									'process.env.NODE_ENV': argv.mode,
								}],
							],
							presets: [
								[
									'@babel/preset-env',
									{
										loose: true,
										targets: 'defaults',
										useBuiltIns: 'entry',
										corejs: '3.22',
										modules: 'auto',
									},
								],
							],
							comments: !isProduction,
							babelrc: false,
						},
					},
				],
			}, {
				test: /\.js$/,
				include: path.join(__dirname, 'node_modules'),
				exclude: path.join(__dirname, 'node_modules', 'dashjs', 'dist', 'dash.mediaplayer.min.js'),
				use: [
					{
						loader: 'babel-loader',
						options: {
							plugins: [
								'minify-dead-code-elimination',
								// 'minify-builtins',
								// 'minify-infinity',
								// 'transform-merge-sibling-variables',
								// 'transform-minify-booleans',
								// 'transform-simplify-comparison-operators',
								// 'transform-undefined-to-void',
								// 'minify-replace',
								// 'minify-simplify',
								['transform-define', {
									'process.env.NODE_ENV': argv.mode,
								}],
							],
							compact: true,
							comments: false,
							babelrc: false,
						},
					},
				],
			}, {
				test: /\.scss$/,
				use: [
					{ loader: 'file-loader', options: { esModule: false, name: '[name].css' } },
					// { loader: 'extricate-loader', options: { resolve: '\\.js$' } },
					{ loader: 'css-loader', options: { esModule: false } },
					{ loader: 'postcss-loader' },
					{ loader: 'sass-loader', options: { implementation: sass } },
				],
				type: 'asset/resource',
			}, {
				test: /\.html$/,
				use: [
					{ loader: 'file-loader', options: { esModule: false, name: '[name].[ext]' } },
					// { loader: 'extricate-loader' },
					{ loader: 'html-loader', options: { /* attrs: ['link:href', 'script:src'] */ esModule: false, } },
				],
				type: 'asset/resource',
			}, {
				test: /\.(png|gif|svg)$/,
				exclude: path.join(__dirname, 'lib', 'images'),
				use: [
					{ loader: 'file-loader', options: { esModule: false, name: '[name].[ext]' } },
				],
			}, {
				test: /\.(png|gif|svg)$/,
				include: path.join(__dirname, 'lib', 'images'),
				use: [
					{ loader: 'url-loader', options: { esModule: false } },
				],
			}, {
				test: /\.woff$/,
				use: [
					{ loader: 'url-loader', options: { esModule: false } },
				],
			}],
		},
		optimization: {
			minimize: isProduction,
			concatenateModules: true,
		},
		resolve: {
			mainFields: ['module', 'main', 'browser'],
		},
		plugins: [
			new DefinePlugin({
				__MANIFEST_V3__: !!conf.mv3
			}),
			// new InertEntryPlugin(),
			(env.zip && !conf.noZip && new ZipPlugin({
				path: path.join('..', 'zip'),
				filename: conf.output,
			})),
		].filter(x => x),

		resolveLoader: {
			modules: [path.join(__dirname, 'loaders'), 'node_modules'],
		},
		stats: {
			children: true,
		},
	}));

	return (configs.length === 1 ? configs[0] : configs);
});
