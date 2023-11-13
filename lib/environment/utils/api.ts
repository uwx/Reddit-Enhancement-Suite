export function apiToPromise(func: (...args: any[]) => void): (...args: unknown[]) => Promise<any> {
  // if (__MANIFEST_V3__) return func;
  return (...args) => new Promise((resolve, reject) => {
    func(...args, (...results: any[]) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(results.length > 1 ? results : results[0]);
      }
    });
  });
}