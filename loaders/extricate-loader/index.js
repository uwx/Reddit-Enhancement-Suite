/* eslint-disable filenames/match-exported */
// @ts-check

/* @noflow */

const util = require('util');
const vm = require('vm');
const path = require('path');
const loaderUtils = require('loader-utils');

const placeholder = `__EXTRICATE_LOADER_PLACEHOLDER_${String(Math.random()).slice(2)}__`;

/*

type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
*/

/**
 * @typedef {T extends (this: infer U, ...args: any[]) => any ? U : never} FunctionThis
 * @template {(this: any, ...args: any) => any} T
 */

// Executes the given module's src in a fake context in order to get the resulting string.
const a = /** @satisfies {import('webpack').LoaderDefinition} */ ({ pitch(content, prev, data) {
	const callback = this.async();

	const query = this.getOptions() ?? {};
	const nodeRequireRegex = query.resolve && new RegExp(query.resolve, 'i');

	this.getLogger().error('hiiii ' + content);

	const dependencies = [];
	// run root module, importing some resources synchronously with node require
	// and returning the placeholder for others
	const moduleWithPlaceholders = runScript(content, this.resourcePath, {
		require: (/** @type {string} */ resourcePath) => {
			if (nodeRequireRegex && nodeRequireRegex.test(resourcePath)) {
				// evaluate the required file with node's require
				const absPath = path.resolve(path.dirname(this.resourcePath), resourcePath);
				return require(absPath);
			} else {
				// evaluate the required file with webpack's require, interpolate the result later
				dependencies.push(new Promise((resolve, reject) => {
					// load the module with webpack's internal module loader
					this.loadModule(resourcePath, (err, src) => {
						if (err) {
							return reject(err);
						}
						try {
							// run the imported module to get its (string) export
							const result = runScript(src, resourcePath, {
								__webpack_public_path__: this._compilation.options.output.publicPath !== 'auto' && this._compilation.options.output.publicPath || '',
							});
							this.getLogger().warn(src, util.inspect(result));
							resolve(result);
						} catch (e) {
							reject(e);
						}
					});
				}));

				return placeholder;
			}
		},
	});

	Promise.all(dependencies)
		.then(results =>
			// interpolate the results into the root module's placeholders
			 moduleWithPlaceholders.replace(new RegExp(placeholder, 'g'), () => results.shift()),
		)
		.then(content => {
			callback(null, content);
		}, err => {
			callback(new Error(''+err+'\n'+err.stack));
		});
} });

// Executes the given CommonJS module in a fake context to get the exported string.
// The given module is expected to just return a string without requiring further modules.
/**
 * @param {string} src
 * @param {string} filename
 * @param {{ require?: (resourcePath: string) => any; __webpack_public_path__?: any; }} context
 */
function runScript(src, filename, context) {
	const script = new vm.Script(src, {
		filename,
	});

	const sandbox = {
		module: {
			exports: {},
		},
		...context,
	};
	sandbox.exports = sandbox.module.exports;

	const result = script.runInNewContext(sandbox);

	return typeof result === 'string' ? result : sandbox.module.exports;
}


module.exports = a.pitch;