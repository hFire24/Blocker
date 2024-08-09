chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setBlockedUrl') {
    const url = message.url;
    const today = getLocalDate();

    chrome.storage.local.get(['blockedCounts'], async (data) => {
      const blockedCounts = data.blockedCounts || {};
      const countsForToday = blockedCounts[today] || {};
      const matchingKeys = Object.keys(countsForToday).filter(k => {
        try {
          const regex = new RegExp(k);
          return regex.test(url);
        } catch (e) {
          return false;
        }
      }) || [url];
      const counts = matchingKeys.map(key => countsForToday[key] || 0);

      try {
        await setChromeStorage({ lastBlockedUrl: url });
        const blockCounts = matchingKeys.reduce((obj, key, index) => {
          obj[key] = counts[index];
          return obj;
        }, {});
        await setChromeStorage({ blockCount: blockCounts });
      } catch (error) {
        console.error('Error setting storage:', error);
      }
    });
  }
});

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setChromeStorage(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  let enableConfirmMessage = true;
  let enableReasonInput = true;
  let enableTimeInput = false;
  let enableTempUnblocking = false;
  let defaultDuration = 5;
  let saveBlockedUrls = 'ask';
  let saveUnblockedUrls = true;

  chrome.storage.sync.get(['enableConfirmMessage', 'enableReasonInput', 'enableTempUnblocking', 'unblockDuration', 'enableTimeInput',
    'saveBlockedUrls', 'saveUnblockedUrls'], (data) => {
    enableConfirmMessage = data.enableConfirmMessage !== false;
    enableReasonInput = data.enableReasonInput !== false;
    enableTimeInput = data.enableTimeInput || false;
    enableTempUnblocking = data.enableTempUnblocking || false;
    defaultDuration = data.unblockDuration || 5;
    saveBlockedUrls = data.saveBlockedUrls !== undefined ? data.saveBlockedUrls : 'ask'; // default to ask if not set
    saveUnblockedUrls = data.saveUnblockedUrls !== false;
    updateUnblockButtonText();
  });

  setTimeout(() => {
    chrome.storage.sync.get(['blockCount'], (data) => {
      const blockCount = data.blockCount;
      const blockCountMessage = document.getElementById('blockCountMessage');
      blockCountMessage.innerHTML = '';
      if (blockCount) {
        const blockEntries = Object.entries(blockCount);
        const blockMessages = blockEntries.map(([pattern, count]) => {
          const displayText = getDisplayText(pattern);
          const times = (count === 1) ? 'time' : 'times';
          return `<b>${displayText}</b> ${count} ${times}`;
        });

        let joinedMessages;
        if (blockMessages.length > 1) {
          const lastMessage = blockMessages.pop();
          joinedMessages = blockMessages.join(', ') + ', and ' + lastMessage;
        } else {
          joinedMessages = blockMessages.join('');
        }

        const p = document.createElement('p');
        p.innerHTML = `Website Blocker has blocked ${joinedMessages} today.`;
        blockCountMessage.appendChild(p);
      }
    });

    chrome.storage.sync.get('lastBlockedUrl', (data) => {
      const lastBlockedUrl = data.lastBlockedUrl;
      if (lastBlockedUrl) {
        document.getElementById("url").innerHTML = lastBlockedUrl;
        chrome.storage.sync.get(null, (data) => {
          const enabled = data.enabled || [];
          const matchedPatterns = enabled.filter(pattern => new RegExp(pattern).test(lastBlockedUrl.toLowerCase()));
          if (matchedPatterns.length > 0) {
            const timestamps = matchedPatterns.map(pattern => data[`blockedTimestamp_${getDisplayText(pattern)}`]);
            const durations = timestamps.map(timestamp => timestamp ? getBlockingDuration(timestamp) : "a while");
            const durationText = durations.map((duration, index) => `<b>${getDisplayText(matchedPatterns[index])}</b> has been blocked for ${duration}.`).join("<br>");
            document.getElementById('durationText').innerHTML = durationText;
          }
        });
      }
    });

    chrome.storage.local.remove('reason');
  }, 100);

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
    const unblockText = document.getElementById("unblockText");
    if (enableReasonInput) {
      unblockEmoji.innerText = "📝";
      unblockText.innerText = "Give a Reason";
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

  const saveUrl = () => {
    chrome.storage.sync.get('lastBlockedUrl', (data) => {
      const lastBlockedUrl = data.lastBlockedUrl;
      if (lastBlockedUrl) {
        chrome.storage.sync.get('enabled', (data) => {
          const patterns = data.enabled.filter(pattern => new RegExp(pattern).test(lastBlockedUrl.toLowerCase()));
          
          // Use a promise to ensure the message is sent before closing the tab
          const sendMessagePromise = new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'saveBlockedUrl', url: lastBlockedUrl, patterns }, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          });
  
          sendMessagePromise.finally(() => {
            closeTab();
          });
        });
      } else {
        closeTab();
      }
    });
  };
  
  const closeTab = () => {
    chrome.storage.sync.remove('lastBlockedUrl');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.remove(tabs[0].id);
    });
  };

  async function unblockSite(duration, canTempUnblock) {
    chrome.storage.sync.get('lastBlockedUrl', async (data) => {
      const lastBlockedUrl = data.lastBlockedUrl;

      if (lastBlockedUrl) {
        chrome.storage.sync.get(['blocked', 'enabled'], async (data) => {
          const blocked = data.blocked || [];
          const enabled = data.enabled || [];

          let toUnblock = [];

          blocked.forEach(blockedItem => {
            try {
              const regex = new RegExp(blockedItem);
              if (regex.test(lastBlockedUrl.toLowerCase()) && enabled.includes(blockedItem)) {
                toUnblock.push(blockedItem);
              }
            } catch (e) {
              console.error('Invalid regex pattern:', blockedItem);
            }
          });

          let newEnabled = enabled.filter(enabledItem => !toUnblock.includes(enabledItem));

          await new Promise((resolve) => chrome.storage.sync.set({ enabled: newEnabled }, resolve));

          if (!isNaN(duration) && duration > 0 && duration <= 1440 && canTempUnblock) {
            chrome.runtime.sendMessage({
              action: 'scheduleReblock',
              url: lastBlockedUrl,
              duration: duration,
              itemsToReblock: toUnblock
            });
          }

          if(saveUnblockedUrls) {
            // Use a promise to ensure the message is sent before closing the tab
            const patterns = enabled.filter(pattern => new RegExp(pattern).test(lastBlockedUrl.toLowerCase()));
            await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'saveBlockedUrl', url: lastBlockedUrl, patterns }, resolve));
          }
          chrome.tabs.update({ url: lastBlockedUrl }, () => {
            chrome.storage.sync.remove('lastBlockedUrl');
          });
        });
      } else {
        closeTab();
      }
    });
  }

  async function showReasonInput() {
    if (!enableReasonInput && !enableConfirmMessage && !enableTimeInput) {
      await unblockSite(defaultDuration, enableTempUnblocking);
    } else {
      document.querySelector('.default-buttons').style.display = 'none';
      if (!enableReasonInput) {
        await submitReason(true, '');
      } else {
        document.querySelector('.reason-input').style.display = 'block';
      }
    }
  }

  async function showConfirmMessage() {
    if (!enableConfirmMessage) {
      await showTimeInput();
    } else {
      let confirmText = "Are you sure you want to unblock this site";
      let reason = document.getElementById('reason').value.trim();
      confirmText += reason === "" ? "?" : ` for the following reason: "${reason}"?`;

      document.getElementById('confirmText').innerText = confirmText;
      document.querySelector('.confirm-message').style.display = 'block';
      document.querySelector('.reason-input').style.display = 'none';
      /*if (!enableTimeInput) {
        document.getElementById('backTimeButton').style.display = 'none';
      }*/
    }
  }

  function getBlockingDuration(startTime) {
    const now = Date.now();
    const durationMs = now - startTime;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (durationMs < minute) {
      return 'less than a minute';
    } else if (durationMs < hour) {
      const minutes = Math.floor(durationMs / minute);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (durationMs < day) {
      const hours = Math.floor(durationMs / hour);
      const minutes = Math.floor((durationMs % hour) / minute);
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (durationMs < 30 * day) {
      const days = Math.floor(durationMs / day);
      const hours = Math.floor((durationMs % day) / hour);
      return `${days} day${days !== 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return 'a while';
    }
  }

  async function submitReason(nextStep, reason) {
    reason = reason || document.getElementById('reason').value.trim();
    nextStep = nextStep || false;
    if (reason !== '')
      chrome.storage.local.set({ reason });
    nextStep ? await showConfirmMessage() : showAskToSave();
  }

  function showAskToSave() {
    switch(saveBlockedUrls) {
      case 'always':
        saveUrl();
        break;
      case 'never':
        closeTab();
        break;
      default:
        document.querySelector('.default-buttons').style.display = 'none';
        document.querySelector('.reason-input').style.display = 'none';
        document.querySelector('.time-input').style.display = 'none';
        document.querySelector('.confirm-message').style.display = 'none';
        document.querySelector('.save-message').style.display = 'block';
    }
  }

  async function showTimeInput() {
    if (!enableTimeInput) {
      await unblockSite(defaultDuration, enableTempUnblocking);
    } else {
      document.getElementById('customDuration').value = defaultDuration.toString();
      document.querySelector('.reason-input').style.display = 'none';
      document.querySelector('.confirm-message').style.display = 'none';
      document.querySelector('.time-input').style.display = 'block';
    }
  }

  async function handleUnblockTime() {
    const durationSelect = document.getElementById('unblockDuration');
    const customDurationInput = document.getElementById('customDuration');
    const customDurationHrsInput = document.getElementById('customDurationHrs');
    let duration = durationSelect.value;

    if (duration === 'custom') {
      duration = customDurationInput.value;
    } else if (duration === 'hours') {
      duration = parseInt(customDurationHrsInput.value) * 60 + parseInt(customDurationInput.value);
    }

    if (duration === 'forever') {
      await unblockSite(0, false);
    } else if (!isNaN(duration) && duration > 0 && duration <= 1440) {
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
  document.getElementById('focusButton').addEventListener('click', async () => {
    try {
      await submitReason(false, '');
    } catch (error) {
      console.error('Error in submitReason:', error);
    }
  });
  document.getElementById('submitReasonButton').addEventListener('click', async () => {
    try {
      await submitReason(true);
    } catch (error) {
      console.error('Error in submitReason:', error);
    }
  });
  document.getElementById('cancelReasonButton').addEventListener('click', async () => {
    try {
      await submitReason(false);
    } catch (error) {
      console.error('Error in submitReason:', error)
    }
  });
  document.getElementById('reason').addEventListener('keypress', async (event) => {
    if (event.key === 'Enter') {
      try {
        await submitReason(true);
      } catch (error) {
        console.error('Error submitting reason:', error);
      }
    }
  });
  document.getElementById('unblockDuration').addEventListener('change', (event) => {
    const customDurationInput = document.getElementById('customDuration');
    const customDurationHrsInput = document.getElementById('customDurationHrs');
    const colon = document.getElementById('customDurationColon');
    if (event.target.value === 'custom') {
      customDurationInput.style.display = 'inline';
      customDurationHrsInput.style.display = 'none';
      colon.style.display = 'none';
      customDurationInput.min = '1';
      customDurationInput.max = '1440';
      customDurationInput.value = parseInt(customDurationHrsInput.value) * 60 + parseInt(customDurationInput.value);
    } else if (event.target.value === 'hours') {
      customDurationInput.style.display = 'inline';
      customDurationHrsInput.style.display = 'inline';
      colon.style.display = 'inline';
      if (Math.floor(customDurationInput.value / 60) !== parseInt(customDurationHrsInput.value))
        customDurationHrsInput.value = Math.floor(customDurationInput.value / 60)
      customDurationInput.value = customDurationInput.value % 60;
      customDurationInput.min = '0';
      customDurationInput.max = '59';
    } else {
      customDurationInput.style.display = 'none';
      customDurationHrsInput.style.display = 'none';
      colon.style.display = 'none';
    }
  });
  document.getElementById('unblockTimeButton').addEventListener('click', async () => {
    try {
      await handleUnblockTime();
    } catch (error) {
      console.error('Error in handleUnblockTime:', error);
    }
  });
  document.getElementById('cancelTimeButton').addEventListener('click', async () => {
    try {
      await showAskToSave();
    } catch (error) {
      console.error('Error in showAskToSave:', error)
    }
  });
  document.getElementById('confirmUnblockButton').addEventListener('click', async () => {
    try {
      await showTimeInput();
    } catch (error) {
      console.error('Error in showTimeInput:', error);
    }
  });
  document.getElementById('cancelUnblockButton').addEventListener('click', async () => {
    try {
      await showAskToSave();
    } catch (error) {
      console.error('Error in showAskToSave:', error)
    }
  });
  document.getElementById('confirmSaveButton').addEventListener('click', async () => {
    try {
      await saveUrl();
    } catch (error) {
      console.error('Error in showTimeInput:', error);
    }
  });
  document.getElementById('cancelSaveButton').addEventListener('click', async () => {
    try {
      closeTab();
    } catch (error) {
      console.error('Error in closeTab:', error)
    }
  });
});