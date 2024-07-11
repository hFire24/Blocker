document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('unblockButton').addEventListener('click', () => {
    //chrome.runtime.sendMessage({ action: 'unblockSite' });
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
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.update(tabs[0].id, { url: lastBlockedUrl }, () => {
              // Clear the lastBlockedUrl after the site is unblocked and redirected
              chrome.storage.sync.remove('lastBlockedUrl');
            });
          })
        });
      }
    });
  });

  document.getElementById('focusButton').addEventListener('click', () => {
    chrome.storage.sync.remove('lastBlockedUrl', () => {
      // Close the current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.remove(tabs[0].id);
      });
    });
  });
});
