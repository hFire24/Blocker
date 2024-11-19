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
  let enableReasonInput = false;
  let enableUbButtonDisabling = false;
  let disableDuration = 15;
  let enableTimeInput = false;
  let enableTempUnblocking = true;
  let duration = 5;
  let saveBlockedUrls = 'reason';
  let reason = '';
  let productiveSites = [];
  let productiveUrls = document.getElementById('productiveUrls');
  let enableScriptures = false;
  let verseHidden = false;
  let book = 0;
  let chapter = 0;
  let verse = -1;
  let nextButtonClicked = true;
  let unblockButtonEnabled = true;
  let clicksSinceEnabling = 0;
  let allowUbReminder = true;

  chrome.storage.sync.get(['blockedPageBgColor', 'enableConfirmMessage', 'enableReasonInput', 'enableUbButtonDisabling', 'ubDisableDuration',
    'enableTempUnblocking', 'unblockDuration', 'enableTimeInput', 'saveBlockedUrls', 'productiveSites',
    'enableScriptures', 'requireVerse', 'allowUbReminder', 'book', 'chapter', 'verse'], async (data) => {
    enableConfirmMessage = data.enableConfirmMessage !== false;
    enableReasonInput = data.enableReasonInput || false;
    enableUbButtonDisabling = data.enableUbButtonDisabling || false;
    disableDuration = (!isNaN(data.ubDisableDuration) && data.ubDisableDuration > 0 && data.ubDisableDuration <= 300) ? parseInt(data.ubDisableDuration, 10) : 15;
    enableTimeInput = data.enableTimeInput || false;
    enableTempUnblocking = data.enableTempUnblocking !== false;
    duration = (!isNaN(data.unblockDuration) && data.unblockDuration > 0 && data.unblockDuration <= 1440) ? parseInt(data.unblockDuration, 10) : 5;
    saveBlockedUrls = data.saveBlockedUrls !== undefined ? data.saveBlockedUrls : 'reason';
    document.body.style.backgroundColor = data.blockedPageBgColor !== undefined ? data.blockedPageBgColor : '#1E3A5F';
    productiveSites = data.productiveSites !== undefined ? data.productiveSites : [];
    enableScriptures = data.enableScriptures || false;
    requireVerse = data.requireVerse || false;
    allowUbReminder = data.allowUbReminder !== false;
    book = data.book || 0;
    chapter = data.chapter || 0;
    verse = data.verse || 0;

    const unblockEmoji = document.getElementById("unblockEmoji");
    if (enableTimeInput) {
      unblockEmoji.innerText = "⏳";
    } else {
      unblockEmoji.innerText = "🔓";
    }

    if(!enableReasonInput) {
      document.querySelector('.default-buttons').style.display = 'block';
      document.querySelector('.reason-input').style.display = 'none';
    }

    if (enableUbButtonDisabling) {
      // Disable the button and start the timer
      unblockButton.disabled = true;
      unblockButtonEnabled = false;
      setTimeout(() => {
        unblockButtonEnabled = true;
        checkUnblockAvailability();
      }, disableDuration * 1000); // Disable for `disableDuration` seconds
    }

    await productiveSites.forEach(site => {
      let a = document.createElement("a");
      a.href = site.url;
      a.innerHTML = site.name;
      productiveUrls.appendChild(a);
    });

    document.getElementById("focusButton").disabled = false;
  });

  setTimeout(() => {
    chrome.storage.sync.get(['blockCount', 'enabled'], (data) => {
      const blockCount = data.blockCount;
      const enabledSites = data.enabled || [];
      const blockCountMessage = document.getElementById('blockCountMessage');
      blockCountMessage.innerHTML = '';
    
      if (blockCount) {
        const blockEntries = Object.entries(blockCount);
    
        // Display only the enabled sites that are currently blocked
        const blockMessages = blockEntries
          .filter(([pattern]) => enabledSites.includes(pattern))
          .map(([pattern, count]) => {
            const displayText = getDisplayText(pattern);
            const times = (count === 1) ? 'time' : 'times';
            return `<b>${displayText}</b> ${count} ${times}`;
          });
    
        let joinedMessages;
        if (blockMessages.length > 2) {
          const lastMessage = blockMessages.pop();
          joinedMessages = blockMessages.join(', ') + ', and ' + lastMessage;
        } else if (blockMessages.length === 2) {
          const lastMessage = blockMessages.pop();
          joinedMessages = blockMessages.join('') + ' and ' + lastMessage;
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
        //document.getElementById("url").innerHTML = lastBlockedUrl.includes('&') ? lastBlockedUrl.slice(0, lastBlockedUrl.indexOf('&')) : lastBlockedUrl;
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
    if(enableScriptures) {
      document.getElementById("playback").style.display = "block";
      displayVerse();
      if(requireVerse) {
        unblockButton.disabled = true;
        nextButtonClicked = false;
      }
    }
  }, 100);

  function checkUnblockAvailability() {
    if (nextButtonClicked && unblockButtonEnabled) {
      unblockButton.disabled = false;
    } else {
      unblockButton.disabled = true;
    }
  }

  async function goToPreviousVerse() {
    if (!enableScriptures) return;
    const bom = await fetchData();
  
    // Check if we're on the first verse of the current chapter
    if (verse === 0) {
      // Move to the previous chapter
      chapter--;
      if (chapter < 0) {
        // Move to the previous book
        book--;
        if (book < 0) {
          // Wrap around to the last book if necessary
          book = bom.length - 1;
        }
        // Wrap around to the last chapter of the previous book
        chapter = bom[book].chapters.length - 1;
      }
      // Set verse to the last verse of the new chapter
      verse = bom[book].chapters[chapter].verses.length - 1;
    } else {
      // Otherwise, simply move to the previous verse
      verse--;
    }
  
    await saveVerseData();
    await displayVerse();
  }  

  async function goToNextVerse() {
    if (!enableScriptures) return;
    
    if(!verseHidden) {
      const bom = await fetchData();
      verse++;

      if (verse === bom[book].chapters[chapter].verses.length) {
        chapter++;
        if (chapter === bom[book].chapters.length) {
          book++;
          if (book === bom.length) {
            book = 0
          }
          chapter = 0;
        }
        verse = 0;
      }
      await saveVerseData();
    }
    if(requireVerse) {
      nextButtonClicked = true;
      checkUnblockAvailability();
    }
    if(enableUbButtonDisabling && unblockButtonEnabled || !enableUbButtonDisabling)
      clicksSinceEnabling++;
    await displayVerse();
  }

  async function fetchData() {
    try {
      const response = await fetch(chrome.runtime.getURL('assets/book-of-mormon.json'));
      const data = await response.json();
      return data.books;
    } catch (error) {
      console.error('Error fetching chapter data:', error);
    }
  }

  async function saveVerseData() {
    chrome.storage.sync.set({ book, chapter, verse });
  }

  async function displayVerse() {
    if(clicksSinceEnabling === 1 && (requireVerse || enableUbButtonDisabling) && allowUbReminder) {
      document.getElementById('message').innerHTML = 'Unblock Button Available';
      document.getElementById('verse').innerHTML = 'Hit the "Unblock Site" button to unblock site, or hit ⏩ to continue reading.';
      verseHidden = true;
    }
    else {
      const bom = await fetchData();
      const verseData = bom[book].chapters[chapter].verses[verse];
      document.getElementById('message').innerHTML = verseData.reference;
      document.getElementById('verse').innerHTML = verseData.text;
      verseHidden = false;
    }
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

  const saveUrl = () => {
    chrome.storage.sync.get('lastBlockedUrl', (data) => {
      const lastBlockedUrl = data.lastBlockedUrl;
      if (lastBlockedUrl) {
        chrome.storage.sync.get('enabled', (data) => {
          const patterns = data.enabled.filter(pattern => new RegExp(pattern).test(lastBlockedUrl.toLowerCase()));
          chrome.runtime.sendMessage({ action: 'saveBlockedUrl', url: lastBlockedUrl, patterns, reason });
        });
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
  
          chrome.tabs.update({ url: lastBlockedUrl }, () => {
            chrome.storage.sync.remove('lastBlockedUrl');
          });
        });
      } else {
        closeTab();
      }
    });
  }

  async function showConfirmMessage() {
    if (!enableConfirmMessage) {
      enableTimeInput ? await handleUnblockTime() : await unblockSite(duration, enableTempUnblocking);
    } else {
      let confirmText = "Are you being distracted?";

      document.getElementById('confirmText').innerText = confirmText;
      document.querySelector('.time-input').style.display = 'none';
      document.querySelector('.default-buttons').style.display = 'none';
      document.querySelector('.confirm-message').style.display = 'block';
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

  function showReasonInput() {
    document.querySelector('.default-buttons').style.display = 'none';
    document.querySelector('.reason-input').style.display = 'block';
  }

  function submitReason() {
    reason = document.getElementById('reason').value.trim();
    if(saveBlockedUrls === 'always' || saveBlockedUrls == 'reason' && reason !== '')
      saveUrl();
    document.querySelector('.reason-input').style.display = 'none';
    document.querySelector('.default-buttons').style.display = 'block';
  }

  const durationSelect = document.getElementById('unblockDuration');
  const customDurationInput = document.getElementById('customDuration');
  const customDurationHrsInput = document.getElementById('customDurationHrs');

  async function showTimeInput(firstSet) {
    if (firstSet)
      document.getElementById('customDuration').value = duration.toString();
    if (!enableTimeInput) {
      await showConfirmMessage();
    } else {
      document.querySelector('.default-buttons').style.display = 'none';
      document.querySelector('.confirm-message').style.display = 'none';
      document.querySelector('.time-input').style.display = 'block';
    }
  }

  function getUnblockingDuration() {
    if (!enableTimeInput && !enableTempUnblocking || duration === 'forever')
      return 'ever until you block it again';
    else if(duration >= 60) {
      const hour = 60;
      let hours = Math.floor(duration / hour);
      let minutes = Math.floor(duration % hour);
      if (minutes === 0)
        return ` ${hours} hour${hours !== 1 ? 's' : ''}`;
      return ` ${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    else
      return ` ${duration} minute${duration !== '1' ? 's' : ''}`
  }

  async function handleUnblockTime() {
    if (!enableTimeInput && !enableTempUnblocking || duration === 'forever') {
      await unblockSite(0, false);
    } else {
      await unblockSite(parseInt(duration, 10), true);
    }
  }

  function remainFocused() {
    chrome.storage.sync.get(['focusOption', 'redirectUrl', 'enableMessage', 'message'], (data) => {
      if(data.enableMessage) {
        document.querySelector(".default-buttons").style.display = "none";
        document.querySelector(".confirm-message").style.display = "none";
        document.querySelector(".message-buttons").style.display = "none";
        document.querySelector("p").innerHTML = "";
        document.getElementById("blockCountMessage").innerHTML = "";
        document.getElementById("durationText").innerHTML = "";
        document.getElementById("message").innerHTML = data.message !== undefined ? data.message : "You can do it! Stay focused!";
      } else if (data.focusOption === "redirect") {
        window.location.href = data.redirectUrl;
      } else {
        closeTab();
      }
    });
  }

  document.getElementById('submitReasonButton').addEventListener('click', () => {
    try {
      submitReason();
    } catch (error) {
      console.error('Error in submitReason:', error);
    }
  });
  document.getElementById('reason').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      try {
        submitReason();
      } catch (error) {
        console.error('Error submitting reason:', error);
      }
    }
  });
  document.getElementById('unblockButton').addEventListener('click', async () => {
    try {
      await showTimeInput(true);
    } catch (error) {
      console.error('Error in unblock:', error);
    }
  });
  document.getElementById('reasonButton').addEventListener('click', () => {
    try {
      showReasonInput(true);
    } catch (error) {
      console.error('Error in reasonButton:', error);
    }
  });
  document.getElementById('focusButton').addEventListener('click', () => {
    try {
      remainFocused();
    } catch (error) {
      console.error('Error in focusButton:', error);
    }
  });
  document.getElementById('unblockDuration').addEventListener('change', (event) => {
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
      duration = durationSelect.value;
      if (duration === 'custom') {
        duration = customDurationInput.value;
      } else if (duration === 'hours') {
        duration = parseInt(customDurationHrsInput.value) * 60 + parseInt(customDurationInput.value);
      }
      if (duration === 'forever' || !isNaN(duration) && duration > 0 && duration <= 1440) {
        await showConfirmMessage();
      } else {
        alert('Please enter a valid duration.');
      }
    } catch (error) {
      console.error('Error in unblockTimeButton:', error);
    }
  });
  document.getElementById('backTimeButton').addEventListener('click', () => {
    try {
      document.querySelector('.default-buttons').style.display = 'block';
      document.querySelector('.time-input').style.display = 'none';
    } catch (error) {
      console.error('Error in backTimeButton:', error)
    }
  });
  document.getElementById('confirmUnblockButton').addEventListener('click', async () => {
    try {
      await handleUnblockTime();
    } catch (error) {
      console.error('Error in handleUnblockTime:', error);
    }
  });
  document.getElementById('cancelUnblockButton').addEventListener('click', () => {
    try {
      remainFocused();
    } catch (error) {
      console.error('Error in showAskToSave:', error)
    }
  });
  document.getElementById('editMessageButton').addEventListener('click', () => {
    try {
      let message = prompt("What would you like the message to say?");
      if(message !== undefined) {
        message = message.trim();
        if(message !== "") {
          chrome.storage.sync.set({message});
          document.getElementById("message").innerHTML = message;
        }
      }
    } catch (error) {
      console.error('Error in editMessageButton:', error);
    }
  });
  document.getElementById('closeButton').addEventListener('click', () => {
    try {
      chrome.storage.sync.get(['focusOption', 'redirectUrl', 'enableMessage', 'message'], (data) => {
        if (data.focusOption === "redirect") {
          window.location.href = data.redirectUrl;
        } else {
          closeTab();
        }
      });
    } catch (error) {
      console.error('Error in closeButton:', error)
    }
  });
  document.getElementById('savedUrlsButton').addEventListener('click', async () => {
    try {
      chrome.tabs.query({}, (tabs) => {
        const optionsUrl = chrome.runtime.getURL('options.html');
        let optionsTab = null;
  
        for (const tab of tabs) {
          if (tab.url === optionsUrl) {
            optionsTab = tab;
            break;
          }
        }
  
        if (optionsTab) {
          chrome.tabs.update(optionsTab.id, { active: true }, () => {
            chrome.tabs.sendMessage(optionsTab.id, { action: 'openSavedUrls' });
          });
          chrome.tabs.getCurrent((tab) => {
            chrome.tabs.remove(tab.id);
          });
        } else {
          chrome.tabs.update({ url: optionsUrl }, () => {
            chrome.storage.sync.set({ openTab: 'SavedUrls' });
          });
        }
      });
    } catch (error) {
      console.error('Error in seeUrlsButton:', error);
    }
  });
  document.getElementById('previous').addEventListener('click', goToPreviousVerse);
  document.getElementById('next').addEventListener('click', goToNextVerse);
  document.addEventListener('keydown', async function(event) {
    if (event.key === 'ArrowLeft') { // Left arrow key
      await goToPreviousVerse();
    } else if (event.key === 'ArrowRight') { // Right arrow key
      await goToNextVerse();
    }
  });
});