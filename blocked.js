chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setBlockedUrl') {
    sessionStorage.setItem('lastBlockedUrl', message.url);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  let enableConfirmMessage = true;
  let enableReasonInput = true;
  let enableTimeInput = false;

  // Load options
  chrome.storage.sync.get(['enableConfirmMessage', 'enableReasonInput', 'enableTimeInput'], (data) => {
    enableConfirmMessage = (data.enableConfirmMessage !== undefined) ? data.enableConfirmMessage : true;
    enableReasonInput = (data.enableReasonInput !== undefined) ? data.enableReasonInput : true;
    enableTimeInput = data.enableTimeInput || false;
    updateUnblockButtonText();
  });

  function updateUnblockButtonText() {
    const unblockEmoji = document.getElementById("unblockEmoji");
    if(enableReasonInput) {
      unblockEmoji.innerText = "📝";
    } else if(enableConfirmMessage) {
      unblockEmoji.innerText = "❓";
    } else if(enableTimeInput) {
      unblockEmoji.innerText = "⏳";
    } else {
      unblockEmoji.innerText = "🔓";
    }
  }
  
  function closeTab() {
    sessionStorage.removeItem('lastBlockedUrl');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.remove(tabs[0].id);
    });
  }

  function unblockSite() {
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
  }

  function showReasonInput() {
    if (!enableReasonInput && !enableConfirmMessage) {
      unblockSite();
    } else {
      document.querySelector('.default-buttons').style.display = 'none';
      !enableReasonInput ? submitReason('') : document.querySelector('.reason-input').style.display = 'block';
    }
  }

  function showConfirmMessage(reason) {
    if (!enableConfirmMessage) {
      unblockSite();
    } else {
      let confirmText = "Are you sure you want to unblock this site";
      confirmText += reason === "" ? "?" : ` for the following reason: "${reason}"?`;
      document.getElementById('confirmText').textContent = confirmText;
      document.querySelector('.confirm-message').style.display = 'block';
      document.querySelector('.reason-input').style.display = 'none';
    }
  }

  function submitReason(reason) {
    reason = reason || document.getElementById('reason').value.trim();
    showConfirmMessage(reason);
  }

  document.getElementById('unblockButton').addEventListener('click', showReasonInput);

  document.getElementById('focusButton').addEventListener('click', closeTab);

  document.getElementById('submitReasonButton').addEventListener('click', () => submitReason());

  document.getElementById('cancelReasonButton').addEventListener('click', closeTab);

  document.getElementById('reason').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      submitReason();
    }
  });

  document.getElementById('confirmUnblockButton').addEventListener('click', unblockSite);

  document.getElementById('cancelUnblockButton').addEventListener('click', closeTab);
});
