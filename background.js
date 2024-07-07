chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    chrome.storage.sync.get(['blocked', 'enabled', 'blockerEnabled'], (data) => {
      const blocked = data.blocked || [];
      const enabled = data.enabled || [];
      const blockerEnabled = data.blockerEnabled !== false; // default to true if not set
      const url = new URL(tab.url);
      const hostname = url.hostname;

      // Check if the hostname or any of its subdomains is in the blocked list
      const isBlocked = blocked.some(blockedItem => hostname === blockedItem || hostname.endsWith(`.${blockedItem}`));
      const isEnabled = enabled.some(enabledItem => hostname === enabledItem || hostname.endsWith(`.${enabledItem}`));

      if (blockerEnabled && isBlocked && isEnabled) {
        chrome.storage.sync.set({ lastBlockedUrl: tab.url }, () => {
          chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'unblockSite') {
    chrome.storage.sync.get(['lastBlockedUrl', 'blocked'], (data) => {
      const lastBlockedUrl = data.lastBlockedUrl;
      const blocked = data.blocked || [];

      if (lastBlockedUrl) {
        const url = new URL(lastBlockedUrl);
        const hostname = url.hostname;
        
        let toUnblock = [];

        // Check if the exact hostname is in the blocked list
        if (blocked.includes(hostname)) {
          toUnblock.push(hostname);
        }

        // Check if any parent domain of the hostname is in the blocked list
        const parts = hostname.split('.');
        for (let i = 1; i < parts.length - 1; i++) {
          const domain = parts.slice(i).join('.');
          if (blocked.includes(domain)) {
            toUnblock.push(domain);
          }
        }

        // Remove from the enabled list
        chrome.storage.sync.get('enabled', (storageData) => {
          let enabled = storageData.enabled || [];
          toUnblock.forEach(domain => {
            enabled = enabled.filter(item => item !== domain);
          });
          chrome.storage.sync.set({ enabled }, () => {
            chrome.tabs.update(sender.tab.id, { url: lastBlockedUrl }, () => {
              // Clear the lastBlockedUrl after the site is unblocked and redirected
              chrome.storage.sync.remove('lastBlockedUrl');
            });
          });
        });
      }
    });
  }
});
