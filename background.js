chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
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
        chrome.storage.sync.set({ lastBlockedUrl: fullUrl }, () => {
          chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
        });
      }
    });
  }
});

/*chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'unblockSite') {
    chrome.storage.sync.get(['lastBlockedUrl', 'blocked', 'enabled'], (data) => {
      const lastBlockedUrl = data.lastBlockedUrl;
      const blocked = data.blocked || [];
      const enabled = data.enabled || [];

      if (lastBlockedUrl) {
        let toUnblock = [];

        // Check blocked list for regex matches
        blocked.forEach(blockedItem => {
          try {
            const regex = new RegExp(blockedItem);
            if (regex.test(lastBlockedUrl)) {
              toUnblock.push(blockedItem);
            }
          } catch (e) {
            console.error('Invalid regex pattern:', blockedItem);
          }
        });

        // Remove from the enabled list
        let newEnabled = enabled.filter(enabledItem => !toUnblock.includes(enabledItem));

        chrome.storage.sync.set({ enabled: newEnabled }, () => {
          chrome.tabs.update(sender.tab.id, { url: lastBlockedUrl }, () => {
            // Clear the lastBlockedUrl after the site is unblocked and redirected
            chrome.storage.sync.remove('lastBlockedUrl');
          });
        });
      }
    });
  }
});*/
