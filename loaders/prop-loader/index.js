/**
 * @author Tobias Koppers @sokra
 * @author Erik Desjardins
 * See LICENSE file in root directory for full license.
 */

/** @noflow */

module.exports = function(source) {
	// console.log(source);
	const value = typeof source === 'string' ? JSON.parse(source) : source;
	const path = this.query ? this.query.slice(1).split('.') : [];
	const prop = path.reduce((obj, key) => {
		// eslint-disable-next-line no-restricted-syntax
		if (!(key in obj)) throw new Error(`Property "${path.join('.')}" not found`);
		return obj[key]
	}, value);
	// console.log(prop);
	return JSON.stringify(prop); // webpack will load this with json loader and not js loader. don't know how to tell it otherwise
};