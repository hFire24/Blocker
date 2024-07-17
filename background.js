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
