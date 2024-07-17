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

  async function unblockSite(duration, canTempUnblock) {
    const lastBlockedUrl = sessionStorage.getItem('lastBlockedUrl');
  
    if (lastBlockedUrl) {
      try {
        const data = await new Promise((resolve) => chrome.storage.sync.get(['blocked', 'enabled'], resolve));
        const blocked = data.blocked || [];
        const enabled = data.enabled || [];
  
        let toUnblock = [];
  
        blocked.forEach(blockedItem => {
          try {
            const regex = new RegExp(blockedItem);
            if (regex.test(lastBlockedUrl) && enabled.includes(blockedItem)) {
              toUnblock.push(blockedItem);
            }
          } catch (e) {
            console.error('Invalid regex pattern:', blockedItem);
          }
        });
  
        // Remove the items to unblock from the enabled array
        let newEnabled = enabled.filter(enabledItem => !toUnblock.includes(enabledItem));
  
        // Immediately unblock by updating the enabled list
        await new Promise((resolve) => chrome.storage.sync.set({ enabled: newEnabled }, resolve));
  
        // Schedule the reblock if necessary
        if (!isNaN(duration) && duration > 0 && canTempUnblock) {
          chrome.runtime.sendMessage({ 
            action: 'scheduleReblock', 
            url: lastBlockedUrl, 
            duration: duration,
            itemsToReblock: toUnblock
          });
        }
  
        // Immediately navigate to the unblocked URL
        chrome.tabs.update({ url: lastBlockedUrl }, () => {
          sessionStorage.removeItem('lastBlockedUrl');
        });
  
      } catch (error) {
        console.error('Error in unblockSite:', error);
      }
    } else {
      closeTab();
    }
  }

  async function showReasonInput() {
    if (!enableReasonInput && !enableConfirmMessage && !enableTimeInput) {
      await unblockSite(defaultDuration, enableTempUnblocking);
    } else {
      document.querySelector('.default-buttons').style.display = 'none';
      if (!enableReasonInput) {
        await submitReason('');
      } else {
        document.querySelector('.reason-input').style.display = 'block';
      }
    }
  }

  async function showConfirmMessage(reason) {
    if (!enableConfirmMessage) {
      await showTimeInput();
    } else {
      let confirmText = "Are you sure you want to unblock this site";
      confirmText += reason === "" ? "?" : ` for the following reason: "${reason}"?`;
      document.getElementById('confirmText').textContent = confirmText;
      document.querySelector('.confirm-message').style.display = 'block';
      document.querySelector('.reason-input').style.display = 'none';
    }
  }

  async function submitReason(reason) {
    reason = reason || document.getElementById('reason').value.trim();
    await showConfirmMessage(reason);
  }

  async function showTimeInput() {
    if (!enableTimeInput) {
      await unblockSite(defaultDuration, enableTempUnblocking);
    } else {
      document.getElementById('customDuration').value = defaultDuration.toString();
      document.querySelector('.confirm-message').style.display = 'none';
      document.querySelector('.time-input').style.display = 'block';
    }
  }

  async function handleUnblockTime() {
    const durationSelect = document.getElementById('unblockDuration');
    const customDurationInput = document.getElementById('customDuration');
    let duration = durationSelect.value;

    if (duration === 'custom') {
      duration = customDurationInput.value;
    }

    if(duration === 'forever') {
      await unblockSite(0, false);
    } else if (!isNaN(duration) && duration > 0) {
      await unblockSite(parseInt(duration, 10), true);
    } else {
      alert('Please enter a valid duration.');
    }
  }

  document.getElementById('unblockButton').addEventListener('click', async () => {
    try {
      await showReasonInput();
    } catch (error) {
      console.error('Error in unblock:', error);
    }
  });
  document.getElementById('focusButton').addEventListener('click', closeTab);
  document.getElementById('submitReasonButton').addEventListener('click', async () => {
    try {
      await submitReason();
    } catch (error) {
      console.error('Error in submitReason:', error);
    }
  });
  document.getElementById('cancelReasonButton').addEventListener('click', closeTab);
  document.getElementById('reason').addEventListener('keypress', async (event) => {
    if (event.key === 'Enter') {
      try {
        await submitReason();
      } catch (error) {
        console.error('Error submitting reason:', error);
      }
    }
  });
  document.getElementById('confirmUnblockButton').addEventListener('click', async () => {
    try {
      await showTimeInput();
    } catch (error) {
      console.error('Error in showTimeInput:', error);
    }
  });
  document.getElementById('cancelUnblockButton').addEventListener('click', closeTab);
  document.getElementById('unblockDuration').addEventListener('change', (event) => {
    const customDurationInput = document.getElementById('customDuration');
    if (event.target.value === 'custom') {
      customDurationInput.style.display = 'inline';
    } else {
      customDurationInput.style.display = 'none';
    }
  });
  document.getElementById('unblockTimeButton').addEventListener('click', async () => {
    try {
      await handleUnblockTime();
    } catch (error) {
      console.error('Error in handleUnblockTime:', error);
    }
  });
});
