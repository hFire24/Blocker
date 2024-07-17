chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setBlockedUrl') {
    const url = message.url;
    const today = new Date().toISOString().split('T')[0];

    chrome.storage.sync.get(['blockedCounts'], (data) => {
      const blockedCounts = data.blockedCounts || {};
      const countsForToday = blockedCounts[today] || {};
      const matchingKey = Object.keys(countsForToday).find(k => {
        try {
          const regex = new RegExp(k);
          return regex.test(url);
        } catch (e) {
          return false;
        }
      }) || url;
      const count = countsForToday[matchingKey] || 0;

      sessionStorage.setItem('lastBlockedUrl', url);
      sessionStorage.setItem('blockCount', JSON.stringify({ [matchingKey]: count }));
    });
  }
});

function waitForStorage(key, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkStorage = () => {
      const value = sessionStorage.getItem(key);
      if (value !== null) {
        resolve(value);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Storage retrieval timed out.'));
      } else {
        setTimeout(checkStorage, 50);
      }
    };
    checkStorage();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  let enableConfirmMessage = true;
  let enableReasonInput = true;
  let enableTimeInput = false;
  let enableTempUnblocking = false;
  let defaultDuration = 60;

  chrome.storage.sync.get(['enableConfirmMessage', 'enableReasonInput', 'enableTempUnblocking', 'unblockDuration', 'enableTimeInput'], (data) => {
    enableConfirmMessage = (data.enableConfirmMessage !== undefined) ? data.enableConfirmMessage : true;
    enableReasonInput = (data.enableReasonInput !== undefined) ? data.enableReasonInput : true;
    enableTimeInput = data.enableTimeInput || false;
    enableTempUnblocking = data.enableTempUnblocking || false;
    defaultDuration = data.unblockDuration || 60;
    updateUnblockButtonText();
  });

  try {
    const blockCountJSON = await waitForStorage('blockCount');
    if (blockCountJSON) {
      const blockCount = JSON.parse(blockCountJSON);
      const blockCountMessage = document.getElementById('blockCountMessage');
      blockCountMessage.innerHTML = '';
      for (const [pattern, count] of Object.entries(blockCount)) {
        const p = document.createElement('p');
        const displayText = getDisplayText(pattern);
        const times = (count === 1) ? 'time' : 'times';
        p.textContent = `Website Blocker has blocked ${displayText} ${count} ${times} today.`;
        blockCountMessage.appendChild(p);
      }
    }
  } catch (error) {
    console.error('Error retrieving block count:', error);
  }

  function getDisplayText(pattern) {
    let displayText = pattern;
    if (pattern.startsWith('^https?://')) {
      displayText = displayText.replace("^https?://+([^:/]+\\.)?", '');
      displayText = displayText.replace(/\\./g, '.');
      displayText = displayText.replace("[:/]", '');
    } else if (pattern.startsWith('(?:q|s|search_query)=')) {
      displayText = displayText.replace("(?:q|s|search_query)=(.*", '');
      displayText = displayText.replace("[^&]*)", '');
    }
    return displayText;
  }

  function updateUnblockButtonText() {
    const unblockEmoji = document.getElementById("unblockEmoji");
    if (enableReasonInput) {
      unblockEmoji.innerText = "📝";
    } else if (enableConfirmMessage) {
      unblockEmoji.innerText = "❓";
    } else if (enableTimeInput) {
      unblockEmoji.innerText = "⏳";
    } else {
      unblockEmoji.innerText = "🔓";
    }
    const unblockEmojiTwo = document.getElementById("unblockEmojiTwo")
    if (enableTimeInput) {
      unblockEmojiTwo.innerText = "⏳";
    } else {
      unblockEmojiTwo.innerText = "🔓";
    }
  }

  function closeTab() {
    sessionStorage.removeItem('lastBlockedUrl');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.remove(tabs[0].id);
    });
  }

  function unblockSite(duration, canTempUnblock) {
    const lastBlockedUrl = sessionStorage.getItem('lastBlockedUrl');
  
    if (lastBlockedUrl) {
      chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
        const blocked = data.blocked || [];
        const enabled = data.enabled || [];
  
        let toUnblock = [];
  
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

        let newEnabled = enabled.filter(enabledItem => !toUnblock.includes(enabledItem));

        chrome.storage.sync.set({ enabled: newEnabled }, () => {
          if (!isNaN(duration) && duration > 0 && canTempUnblock) {
            chrome.runtime.sendMessage({ action: 'scheduleReblock', url: lastBlockedUrl, duration: duration });
          }
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
    if (!enableReasonInput && !enableConfirmMessage && !enableTimeInput) {
      unblockSite(defaultDuration, enableTempUnblocking);
    } else {
      document.querySelector('.default-buttons').style.display = 'none';
      !enableReasonInput ? submitReason('') : document.querySelector('.reason-input').style.display = 'block';
    }
  }

  function showConfirmMessage(reason) {
    if (!enableConfirmMessage) {
      showTimeInput();
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

  function showTimeInput() {
    if (!enableTimeInput) {
      unblockSite(defaultDuration, enableTempUnblocking);
    } else {
      document.getElementById('customDuration').value = defaultDuration.toString();
      document.querySelector('.confirm-message').style.display = 'none';
      document.querySelector('.time-input').style.display = 'block';
    }
  }

  function handleUnblockTime() {
    const durationSelect = document.getElementById('unblockDuration');
    const customDurationInput = document.getElementById('customDuration');
    let duration = durationSelect.value;

    if (duration === 'custom') {
      duration = customDurationInput.value;
    }

    if(duration === 'forever') {
      unblockSite(0, false);
    } else if (!isNaN(duration) && duration > 0) {
      unblockSite(parseInt(duration, 10), true);
    } else {
      alert('Please enter a valid duration.');
    }
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
  document.getElementById('confirmUnblockButton').addEventListener('click', showTimeInput);
  document.getElementById('cancelUnblockButton').addEventListener('click', closeTab);
  document.getElementById('unblockDuration').addEventListener('change', (event) => {
    const customDurationInput = document.getElementById('customDuration');
    if (event.target.value === 'custom') {
      customDurationInput.style.display = 'inline';
    } else {
      customDurationInput.style.display = 'none';
    }
  });
  document.getElementById('unblockTimeButton').addEventListener('click', handleUnblockTime);
});
