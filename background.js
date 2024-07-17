chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith(chrome.runtime.getURL("blocked.html"))) {
    chrome.storage.sync.get(['lastBlockedUrl'], (data) => {
      if (data.lastBlockedUrl) {
        chrome.tabs.sendMessage(tabId, { action: 'setBlockedUrl', url: data.lastBlockedUrl });
        chrome.storage.sync.remove('lastBlockedUrl');
      }
    });
  } else if (changeInfo.status === 'loading' && tab.url) {
    chrome.storage.sync.get(['blocked', 'enabled', 'blockerEnabled'], (data) => {
      const blocked = data.blocked || [];
      const enabled = data.enabled || [];
      const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
      const fullUrl = tab.url.toLowerCase();

      const isBlocked = blocked.some(blockedItem => {
        try {
          const regex = new RegExp(blockedItem);
          return regex.test(fullUrl);
        } catch (e) {
          console.error('Invalid regex pattern:', blockedItem);
          return false;
        }
      });

      const isEnabled = enabled.some(enabledItem => {
        try {
          const regex = new RegExp(enabledItem);
          return regex.test(fullUrl);
        } catch (e) {
          console.error('Invalid regex pattern:', enabledItem);
          return false;
        }
      });

      if (blockerEnabled && isBlocked && isEnabled) {
        const matchingEnabledItem = enabled.find(enabledItem => {
          try {
            const regex = new RegExp(enabledItem);
            return regex.test(fullUrl);
          } catch (e) {
            console.error('Invalid regex pattern:', enabledItem);
            return false;
          }
        });

        chrome.storage.sync.get(['blockedCounts'], (data) => {
          const today = new Date().toISOString().split('T')[0];
          let blockedCounts = data.blockedCounts || {};

          // Remove entries older than 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

          blockedCounts = Object.fromEntries(
            Object.entries(blockedCounts).filter(([date]) => date >= cutoffDate)
          );

          // Add new block count
          if (!blockedCounts[today]) {
            blockedCounts[today] = {};
          }
          const key = matchingEnabledItem || fullUrl;
          if (!blockedCounts[today][key]) {
            blockedCounts[today][key] = 0;
          }
          blockedCounts[today][key]++;

          chrome.storage.sync.set({ blockedCounts }, () => {
            chrome.storage.sync.set({ lastBlockedUrl: fullUrl }, () => {
              chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
            });
          });
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scheduleReblock') {
    const { url, duration, itemsToReblock } = message;
    scheduleReblock(url, duration, itemsToReblock);
    sendResponse(); // Immediately send response
    return true;  // Indicates we will send a response asynchronously
  }
});

function scheduleReblock(url, duration, itemsToReblock) {
  setTimeout(() => {
    chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
      const currentBlocked = data.blocked || [];
      const currentEnabled = data.enabled || [];

      // Check if the item is still in the blocked array
      const stillBlocked = currentBlocked.some(blockedItem => {
        try {
          const regex = new RegExp(blockedItem);
          return regex.test(url);
        } catch (e) {
          return false;
        }
      });

      if (stillBlocked) {
        // Add the temporarily unblocked items back to the enabled array
        const updatedEnabled = [...currentEnabled, ...itemsToReblock];
        chrome.storage.sync.set({ enabled: updatedEnabled }, () => {
          console.log(`Reblocked items: ${itemsToReblock.join(', ')}`);
        });
      }
    });
  }, duration * 60 * 1000); // convert minutes to milliseconds
}
