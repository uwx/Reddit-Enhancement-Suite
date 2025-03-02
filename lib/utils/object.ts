/*
 * Roughly equivalent to `$.extend(true, target, source)`
 * Unfortunately lodash does not seem to offer any function that does this:
 * _.assign/_.extend/Object.assign are not recursive
 * _.merge and _.defaultsDeep ignore undefined values
 */
export function extendDeep(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    if (target[key] && source[key] && typeof target[key] === 'object' && typeof source[key] === 'object' && !Array.isArray(source[key]) && !Array.isArray(target[key])) {
      extendDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }

  return target;
}