import { apiToPromise } from "../utils/api";
import { addListener } from "./messaging";
addListener('permissions', handleMessage);
export function handleMessage({
  operation,
  permissions,
  origins
}: any) {
  switch (operation) {
    case 'contains':
      return apiToPromise(chrome.permissions.contains)({
        permissions,
        origins
      });

    case 'request':
      return apiToPromise(chrome.permissions.request)({
        permissions,
        origins
      }).catch(() => makePromptWindow({
        permissions,
        origins
      }));

    default:
      throw new Error(`Invalid permissions operation: ${operation}`);
  }
}

async function makePromptWindow({
  permissions,
  origins
}) {
  const url = new URL('prompt.html', location.origin);
  url.searchParams.set('permissions', JSON.stringify(permissions));
  url.searchParams.set('origins', JSON.stringify(origins));
  const width = 630;
  const height = 255;
  // Display popup on middle of screen
  const left = Math.floor(screen.width / 2 - width / 2);
  const top = Math.floor(screen.height / 2 - height / 2);
  const {
    tabs: [{
      id
    }]
  } = await apiToPromise(chrome.windows.create)({
    url: url.href,
    type: 'popup',
    width,
    height,
    left,
    top
  });
  return new Promise(resolve => {
    function updateListener(tabId, updates) {
      if (tabId !== id) return;
      const url = updates.url && new URL(updates.url);

      if (url && url.searchParams.has('result')) {
        stopListening();
        const result = url.searchParams.get('result');
        if (!result) return;
        resolve(JSON.parse(result));
        apiToPromise(chrome.tabs.remove)(id);
      }
    }

    function removeListener(tabId) {
      if (tabId !== id) return;
      stopListening();
      resolve(false);
    }

    function stopListening() {
      chrome.tabs.onUpdated.removeListener(updateListener);
      chrome.tabs.onRemoved.removeListener(removeListener);
    }

    chrome.tabs.onUpdated.addListener(updateListener);
    chrome.tabs.onRemoved.addListener(removeListener);
  });
}