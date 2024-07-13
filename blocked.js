chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setBlockedUrl') {
    sessionStorage.setItem('lastBlockedUrl', message.url);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  function closeTab() {
    sessionStorage.removeItem('lastBlockedUrl');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.remove(tabs[0].id);
    });
  }

  document.getElementById('unblockButton').addEventListener('click', () => {
    const lastBlockedUrl = sessionStorage.getItem('lastBlockedUrl');

    if (lastBlockedUrl) {
      chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
        const blocked = data.blocked || [];
        const enabled = data.enabled || [];

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
          chrome.tabs.update({ url: lastBlockedUrl }, () => {
            sessionStorage.removeItem('lastBlockedUrl');
          });
        });
      });
    } else {
      closeTab();
    }
  });

  document.getElementById('focusButton').addEventListener('click', closeTab);
});
