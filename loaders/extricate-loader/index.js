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
const a = /** @satisfies {import('webpack').LoaderDefinition} */ ({
	pitch(content, prev, data) {
		const callback = this.async();

		const query = /** @type {{ postProcess: (args: unknown) => (string | Promise<string>) }} */ (this.getOptions() ?? {});

		// const nodeRequireRegex = query.resolve && new RegExp(query.resolve, 'i');

		// this.getLogger().error('hiiii ' + content);

		// run root module, importing some resources synchronously with node require
		// and returning the placeholder for others

		(async () => {
			/** @type {Map<string, any>} */
			const loadedDeps = new Map();

			/** @type {any} */
			let moduleWithPlaceholders;
			let i = 0;
			// eslint-disable-next-line no-constant-condition
			while (true) {
				/** @type {string[]} */
				const requests = [];
				/** @type {Promise<string>[]} */
				const dependencies = [];

				let error1 = false;
				try {
					moduleWithPlaceholders = runScript(content, this.resourcePath, {
						require: (/** @type {string} */ request) => {
							const cached = loadedDeps.get(request);
							if (cached) {
								return cached;
							}

							requests.push(request);
							// evaluate the required file with webpack's require, interpolate the result later
							dependencies.push(this.importModule(request, {
								baseUri: path.dirname(this.resourcePath),
							}));
							return placeholder;
						},
					});
				} catch (error) {
					if (i++ > 10) throw error;
					error1 = true;
				}

				// eslint-disable-next-line no-await-in-loop
				const results = await Promise.all(dependencies);

				// eslint-disable-next-line no-restricted-syntax
				for (let i = 0; i < requests.length; i++) {
					loadedDeps.set(requests[i], results[i]);
				}

				if (!error1) {
					// interpolate the results into the root module's placeholders
					// eslint-disable-next-line no-await-in-loop
					if (query.postProcess) moduleWithPlaceholders = await query.postProcess(moduleWithPlaceholders);

					// eslint-disable-next-line no-useless-assign/no-useless-assign
					moduleWithPlaceholders = moduleWithPlaceholders.replace(new RegExp(placeholder, 'g'), () => results.shift());

					return moduleWithPlaceholders;
				}
			}
		})().then(e => callback(null, e), e => callback(e));
	},
});

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
		exports: undefined,
		...context,
	};
	sandbox.exports = sandbox.module.exports;

	const result = script.runInNewContext(sandbox);

	return typeof result === 'string' ? result : sandbox.module.exports;
}


module.exports = a.pitch;