chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ businesses: [] });
});

let isScrapingPaused = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'pause') {
    isScrapingPaused = true;
  } else if (message.action === 'resume') {
    isScrapingPaused = false;
  }
});