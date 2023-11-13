// @ts-check

/* @noflow */

import path from 'path';

import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import ZipPlugin from 'zip-webpack-plugin';
import sass from 'sass';
import { globSync } from 'glob';
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
				import: `./${conf.entry}`,
				filename: 'ignoreme.js',
			},
			...globSync('**.entry.js', { ignore: 'node_modules/**' }).reduce((accum, entry) => {
				accum[entry] = {
					import: entry,
					filename: '[name].entry.bundle.js',
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
				type: 'asset/resource',
				use: [
					{ loader: 'extricate-loader' },
					{ loader: 'interpolate-loader' },
				],
				generator: {
				  filename: 'manifest.json',
				},
			}, {
				test: /\.entry\.[jt]s$/,
				use: [
					{ loader: 'spawn-loader', options: { name: '[name].js' } },
				],
			}, {
				test: /\.[jt]s$/,
				exclude: path.join(__dirname, 'node_modules'),
				use: [
					{
						loader: 'esbuild-loader',
						options: {
							target: 'es2020',
						},
					},
				],
			}, {
				test: /\.scss$/,
				use: [
					// { loader: 'file-loader', options: { esModule: false, name: '[name].css' } },
					// { loader: 'extricate-loader', options: { resolve: '\\.js$' } },
					// { loader: 'css-loader', options: { esModule: false, exportType: 'string' } },

					// Indexes description:
					// 0 - module id
					// 1 - CSS code
					// 2 - media
					// 3 - source map
					// 4 - supports
					// 5 - layer
					{
						loader: 'extricate-loader',
						options: {
							// eslint-disable-next-line arrow-body-style
							postProcess: (/** @type {any[]} */ exports) => {
								// console.log(JSON.stringify(exports, null, 2));
								return exports.map(e => e[1]).join('\n');
							},
						},
					},
					{ loader: 'source-map-loader' },
					{ loader: 'css-loader', options: { esModule: false } },
					{ loader: 'postcss-loader' },
					{ loader: 'sass-loader', options: { implementation: sass } },
				],
				type: 'asset/resource',
				generator: {
					filename: '[name].css',
				},
			}, {
				test: /\.html$/,
				use: [
					// { loader: 'file-loader', options: { esModule: false, name: '[name].[ext]' } },
					{ loader: 'extricate-loader' },
					{ loader: 'html-loader', options: { /* attrs: ['link:href', 'script:src'] */ esModule: false } },
				],
				type: 'asset/resource',
				generator: {
					filename: '[name].html',
				},
			}, {
				test: /\.(png|gif|svg)$/,
				exclude: path.join(__dirname, 'lib', 'images'),
				// use: [
				// 	{ loader: 'file-loader', options: { esModule: false, name: '[name].[ext]' } },
				// ],
				type: 'asset/resource',
				generator: {
					filename: '[name][ext]',
				},
			}, {
				test: /\.(png|gif|svg)$/,
				include: path.join(__dirname, 'lib', 'images'),
				// use: [
				// 	{ loader: 'url-loader', options: { esModule: false } },
				// ],
				type: 'asset/inline',
			}, {
				test: /\.woff$/,
				// use: [
				// 	{ loader: 'url-loader', options: { esModule: false } },
				// ],
				type: 'asset/inline',
			}],
		},
		optimization: {
			minimize: isProduction,
			concatenateModules: true,
		},
		resolve: {
			extensions: ['.tsx', '.ts', '.js'],
			mainFields: ['module', 'main', 'browser'],
		},
		plugins: [
			new MiniCssExtractPlugin(),
			new DefinePlugin({
				__MANIFEST_V3__: !!conf.mv3,
				'process.env.BUILD_TARGET': conf.target,
				// 'process.env.NODE_ENV': argv.mode,
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
