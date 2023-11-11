// @ts-check

/**
 * @author Erik Desjardins
 * See LICENSE file in root directory for full license.
 */

// @flow

const loaderUtils = require('loader-utils');
const NativeModule = require('module');

const a = /** @satisfies {import('webpack').LoaderDefinition} */ ({ pitch(source, prev, data) {
	const options = { cache: false, export: 'es6', ...this.getOptions() };

	// https://github.com/peerigon/modernizr-loader/issues/52#issuecomment-717743675
	// eslint-disable-next-line func-style
	const exec = (/** @type {string} */ code, /** @type {string} */ filename) => {
	  const _module = new NativeModule(filename, this);
	  _module.paths = NativeModule._nodeModulePaths(this.context);
	  _module.filename = filename;
	  _module._compile(code, filename);
	  return _module.exports;
	}

	this.cacheable(options.cache);

	const result = exec(source, this.resourcePath);

	const prefix = options.export === 'commonjs' ? 'module.exports = ' : 'export default ';

	return `${prefix + JSON.stringify(result) };`;
} });

module.exports = a.pitch;