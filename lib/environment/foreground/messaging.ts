import { createMessageHandler } from "../utils/messaging";
import { apiToPromise } from "../utils/api";

const _sendMessage = chrome.runtime.sendMessage;

const {
  _handleMessage,
  sendMessage,
  addListener
} = createMessageHandler(obj => _sendMessage(obj));
chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => _handleMessage(obj, sendResponse, sender));
export { sendMessage, addListener };