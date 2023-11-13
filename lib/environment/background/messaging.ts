import { createMessageHandler } from "../utils/messaging";
import { apiToPromise } from "../utils/api";

const _sendMessage = chrome.tabs.sendMessage;

const {
  _handleMessage,
  sendMessage,
  addListener
} = createMessageHandler((obj, tabId) => _sendMessage<unknown, unknown>(tabId, obj));
chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => _handleMessage(obj, sendResponse, sender));
export { sendMessage, addListener };