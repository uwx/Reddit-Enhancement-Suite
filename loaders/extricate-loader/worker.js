// @noflow

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const require = (...args) => {
    parentPort.postMessage()
};

parentPort.addListener('message', (value: string) => {

});
});