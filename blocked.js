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

function isNightTime() {
  const now = new Date();
  const currentHour = now.getHours();
  // Night time is between 9PM (21:00) and 4AM (04:00)
  return currentHour >= 21 || currentHour < 4;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Helper to show/hide navigation and display scriptures button
  function setScriptureNavigationVisibility(showNav, showDisplayBtn) {
    document.getElementById('previous').style.display = showNav ? 'inline-block' : 'none';
    document.getElementById('next').style.display = showNav ? 'inline-block' : 'none';
    let displayBtn = document.getElementById('displayScripturesBtn');
    if (!displayBtn) {
      displayBtn = document.createElement('button');
      displayBtn.id = 'displayScripturesBtn';
      displayBtn.innerText = 'Display Scriptures';
      displayBtn.style.margin = '10px';
      displayBtn.style.display = 'none';
      displayBtn.onclick = async function() {
        setScriptureNavigationVisibility(true, false);
        await displayVerse(false, true); // Show the verse when button is clicked
      };
      document.getElementById('playback').appendChild(displayBtn);
    }
    displayBtn.style.display = showDisplayBtn ? 'inline-block' : 'none';
  }
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
  let verse = 0;
  let requireVerse = true;
  let madeReadingProgress = true;
  let readingProgress = 0;
  let ubDisableDurationPassed = true;
  let heyIHidTheVerse = false;
  let allowUbReminder = true;
  let isHardMode = false;
  let challengeCompleted = false;
  let enableNightMode = false;

  chrome.storage.sync.get(['blockedPageBgColor', 'enableConfirmMessage', 'enableReasonInput', 'enableUbButtonDisabling', 'ubDisableDuration',
    'enableTempUnblocking', 'enableNightMode', 'unblockDuration', 'enableTimeInput', 'saveBlockedUrls', 'productiveSites',
    'enableScriptures', 'requireVerse', 'allowUbReminder', 'book', 'chapter', 'verse',
    'hardMode', 'enabled', 'lastBlockedUrl'], async (data) => {

    const hardModeSites = data.hardMode || [];
    const enabledSites = data.enabled || [];
    const lastBlockedUrl = data.lastBlockedUrl || "";
    if (lastBlockedUrl) {
      const matchedPatterns = enabledSites.filter(pattern =>
        new RegExp(pattern).test(lastBlockedUrl.toLowerCase())
      );
      if (matchedPatterns.some(p => hardModeSites.includes(p))) {
        isHardMode = true;
      }
    }

    if (isHardMode) {
      document.getElementById("message").innerText = "Access Denied";
      document.getElementById("verse").innerHTML = `You are <i>not</i> going to that website. It reinforces unhealthy behavioral patterns that should be avoided.`;
    }
      
    enableConfirmMessage = isHardMode ? true : data.enableConfirmMessage !== false;
    enableReasonInput = isHardMode ? true : data.enableReasonInput || false;
    enableUbButtonDisabling = isHardMode ? false : data.enableUbButtonDisabling || false;
    disableDuration = (!isNaN(data.ubDisableDuration) && data.ubDisableDuration > 0 && data.ubDisableDuration <= 300) ? parseInt(data.ubDisableDuration, 10) : 15;
    enableTimeInput = isHardMode ? true : data.enableTimeInput || false;
    enableTempUnblocking = isHardMode ? true : data.enableTempUnblocking !== false;
    enableNightMode = data.enableNightMode !== undefined ? data.enableNightMode : true;
    duration = isHardMode ? 5 : (!isNaN(data.unblockDuration) && data.unblockDuration > 0 && data.unblockDuration <= 1440) ? parseInt(data.unblockDuration, 10) : 5;
    saveBlockedUrls = data.saveBlockedUrls !== undefined ? data.saveBlockedUrls : 'reason';
    document.body.style.backgroundColor = isHardMode ? "#70101E" : (data.blockedPageBgColor !== undefined ? data.blockedPageBgColor : '#1E3A5F');
    productiveSites = data.productiveSites !== undefined ? data.productiveSites : [];
    enableScriptures = data.enableScriptures || false;
    requireVerse = (isHardMode && enableScriptures) ? true : data.requireVerse || false;
    allowUbReminder = data.allowUbReminder !== false;
    book = data.book || 0;
    chapter = data.chapter || 0;
    verse = data.verse || 0;
    loadedBook = book;
    loadedChapter = chapter;
    loadedVerse = verse;

    const unblockEmoji = document.getElementById("unblockEmoji");
    if (isHardMode) {
      unblockEmoji.innerText = "🏁";
      document.getElementById("unblockText").innerText = "Unblock Challenge";
    }
    else if (enableTimeInput) {
      unblockEmoji.innerText = "⏳";
    } else {
      unblockEmoji.innerText = "🔓";
      document.getElementById("backConfirmButton").style.display = "none";
    }

    if(!enableReasonInput) {
      document.querySelector('.default-buttons').style.display = 'block';
      document.querySelector('.reason-input').style.display = 'none';
    }

    if (enableUbButtonDisabling) {
      // Disable the button and start the timer
      unblockButton.disabled = true;
      ubDisableDurationPassed = false;
      setTimeout(() => {
        ubDisableDurationPassed = true;
        checkUnblockAvailability();
      }, disableDuration * 1000); // Disable for `disableDuration` seconds
    }

    if(productiveSites.length > 0) {
      productiveUrls.innerHTML = '';
      await productiveSites.forEach(site => {
        let a = document.createElement("a");
        a.href = site.url;
        a.innerHTML = site.name;
        productiveUrls.appendChild(a);
      });
    }

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
    // Now run scripture logic
    if(enableScriptures) {
      document.getElementById("playback").style.display = "block";
      if(requireVerse) {
        unblockButton.disabled = true;
        madeReadingProgress = false;
      }
      if (!isHardMode) {
        setScriptureNavigationVisibility(true, false);
        displayVerse(false, false);
      } else {
        setScriptureNavigationVisibility(false, true);
        document.getElementById('unblockButton').title = "Read a scripture verse to unlock the challenge";
      }
    }
  }, 100);

  function checkUnblockAvailability() {
    if (madeReadingProgress && ubDisableDurationPassed) {
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
    readingProgress--;
  
    if(!ubDisableDurationPassed && requireVerse)
      madeReadingProgress = false;

    await saveVerseData();
    await displayVerse(false, true);
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
      readingProgress++;
      await saveVerseData();
    }
    if(requireVerse && readingProgress > 0) {
      madeReadingProgress = true;
      checkUnblockAvailability();
    }
    await displayVerse(true, false);
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

  async function displayVerse(nextButtonClicked, prevButtonClicked) {
    if (isHardMode && !nextButtonClicked && !prevButtonClicked) {
      // In hard mode, hide the verse until Display Scriptures button is pressed
      verseHidden = true;
    } else if(madeReadingProgress && ubDisableDurationPassed && allowUbReminder && nextButtonClicked && !heyIHidTheVerse) {
      document.getElementById('message').innerHTML = 'Unblock Button Available';
      let displayText = isHardMode ? "\"Unblock Challenge\" button to do a challenge" : "\"Unblock Site\" button to unblock the site";
      document.getElementById('verse').innerHTML = `Hit the ${displayText}, or hit ⏩ to continue reading.`;
      verseHidden = true;
      heyIHidTheVerse = true;
      unblockButton.disabled = false;
    } else {
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

  // Helper function to extract domain from URL
  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.origin; // Returns scheme + domain (e.g., https://example.com)
    } catch (e) {
      return url;
    }
  };

  // Smart redirect: if tabs with the redirect URL exist, focus on one and close current tab
  // Otherwise, open the redirect URL in a new tab
  const smartRedirect = (redirectUrl) => {
    const redirectDomain = extractDomain(redirectUrl);

    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      const currentTabId = activeTabs[0]?.id;
      
      chrome.tabs.query({}, (allTabs) => {
        // Find tabs that match the redirect URL (either exact match or same domain/base URL)
        const matchingTabs = allTabs.filter(tab => {
          if (!tab.url) return false;
          const tabDomain = extractDomain(tab.url);
          // Match if the tab's domain starts with or matches the redirect domain
          return tabDomain.startsWith(redirectDomain) || tab.url.startsWith(redirectUrl);
        });

        if (matchingTabs.length > 0) {
          // Close the current (blocked) tab first
          chrome.storage.sync.remove('lastBlockedUrl');
          chrome.tabs.remove(currentTabId, () => {
            // Then focus on the first matching tab
            chrome.tabs.update(matchingTabs[0].id, { active: true });
            chrome.windows.update(matchingTabs[0].windowId, { focused: true });
          });
        } else {
          // No matching tabs found, open the redirect URL
          chrome.tabs.create({ url: redirectUrl }, () => {
            chrome.storage.sync.remove('lastBlockedUrl');
            chrome.tabs.remove(currentTabId);
          });
        }
      });
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
      let confirmText = "Are you sure you want to unblock this site";
      confirmText += reason === "" ? "?" : ` for the following reason: "${reason}"?`;
      let unblockTime = getUnblockingDuration();
      document.getElementById("unblockTime").innerHTML = `You will be unblocking it for${unblockTime}.`

      document.getElementById('confirmText').innerText = confirmText;
      document.querySelector('.time-input').style.display = 'none';
      document.querySelector('.default-buttons').style.display = 'none';
      document.querySelector('.challenge').style.display = 'none';
      document.querySelector('.confirm-message').style.display = 'block';
      if (isHardMode) {
        document.getElementById("hardModeWarning").style.display = "block";
      }
    }
  }

  function showNightModeMessage() {
    // Hide all other sections
    document.querySelector('.default-buttons').style.display = 'none';
    document.querySelector('.confirm-message').style.display = 'none';
    document.querySelector('.challenge').style.display = 'none';
    document.querySelector('.time-input').style.display = 'none';
    document.querySelector('.reason-input').style.display = 'none';
    document.querySelector('.message-buttons').style.display = 'none';

    // Show the night mode message
    document.getElementById("message").innerText = "Enough.";
    document.getElementById("verse").innerHTML = "You tried to unblock this website during nighttime hours. You should spend this time winding down and going to bed instead.";
    document.querySelector('.night-buttons').style.display = 'block';

    // Hide block count message
    document.getElementById("productiveUrls").style.display = "none";
    document.getElementById("blockCountMessage").style.display = "none";
    document.getElementById("durationText").style.display = "none";
    document.getElementById("playback").style.display = "none";
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

  function showChallenge() {
    document.querySelector('.default-buttons').style.display = 'none';
    document.querySelector('.confirm-message').style.display = 'none';
    document.querySelector('.challenge').style.display = 'block';

    const challengeText = quotes[Math.floor(Math.random() * quotes.length)];
    const challengeQuestionElem = document.getElementById("challengeQuestion");
    const challengeQuote = challengeText.quote
      .replace(/—|–/g, ', ')
      .replace(/…/g, '...')
      .replace(/[“”]/g, '"');
    challengeQuestionElem.innerText = challengeQuote;
    challengeQuestionElem.title = "Quote from " + (challengeText.author ? challengeText.author : "the developer, me!");

    const answerField = document.getElementById("challengeAnswer");
    answerField.onpaste = (e) => e.preventDefault();    // Prevent pasting
    answerField.ondragover = (e) => e.preventDefault(); // Prevent drag-over highlight
    answerField.ondrop = (e) => e.preventDefault();     // Prevent dropped content
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
      document.querySelector('.challenge').style.display = 'none';
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
      if(data.enableMessage || isHardMode) {
        document.querySelector(".default-buttons").style.display = "none";
        document.querySelector(".confirm-message").style.display = "none";
        document.querySelector(".challenge").style.display = "none";
        document.getElementById("playback").style.display = "none";
        document.querySelector(".message-buttons").style.display = "block";
        document.querySelector("p").innerHTML = isHardMode ? "You win this battle one decision at a time. Don’t forget that." : "";
        document.getElementById("blockCountMessage").innerHTML = "";
        document.getElementById("durationText").innerHTML = "";
        document.getElementById("message").innerHTML = isHardMode ? "Good. You made the right choice." : 
        data.message !== undefined ? data.message : "You can do it! Stay focused!";
      } else if (data.focusOption === "redirect") {
        smartRedirect(data.redirectUrl);
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
      await isHardMode && !challengeCompleted ? showChallenge() : showTimeInput(true);
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
  document.getElementById('submitChallengeButton').addEventListener('click', async () => {
    try {
      if (challengeCompleted) {
        await showTimeInput(true);
        return;
      }
      const userAnswer = document.getElementById("challengeAnswer").value.trim();
      const challengeText = document.getElementById("challengeQuestion").innerText.replace(/’/g, "'");
      console.log(userAnswer);
      console.log(challengeText);
      const feedbackElem = document.getElementById("challengeFeedback");
      if (userAnswer !== challengeText) {
        feedbackElem.innerText = "That doesn't match. Please try again.";
        return;
      }
      challengeCompleted = true;
      document.getElementById("unblockEmoji").innerText = "⏳";
      document.getElementById("unblockText").innerText = "Unblock Site";
      document.getElementById("challengeFeedback").innerText = "Challenge completed. You may unblock the site.";
      if (enableScriptures) {
        document.getElementById("challengeFeedback").innerText += "\nBut, did you think to pray?";
      }
      document.getElementById("submitChallengeButton").innerText = "⏳ Unblock Site";
      document.getElementById("challengeAnswer").value = "";
      document.getElementById("challengeInput").style.display = "none";
      const challengeQuestionElem = document.getElementById("challengeQuestion");
      let authorText = challengeQuestionElem.title.replace(/^Quote from /, '');
      if (authorText === "the developer, me!") authorText = "The developer, me!";
      challengeQuestionElem.innerText += ` – ${authorText}`;
      const focusBtn = document.createElement('button');
      focusBtn.id = 'challengeFocusButton';
      focusBtn.className = 'focus-button';
      focusBtn.innerText = '🔒 Remain Focused';
      focusBtn.onclick = () => {
        try {
          remainFocused();
        } catch (error) {
          console.error('Error in focusButton:', error);
        }
      };
      document.getElementById('submitChallengeButton').after(focusBtn);
    } catch (error) {
      console.error('Error in submitChallengeButton:', error);
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
      } else if (duration === '6AM') {
        // Calculate the time until 6 AM
        const now = new Date();
        const currentHour = now.getHours();
        // If it's before 6 AM, use today's 6 AM. Otherwise use tomorrow's 6 AM.
        const daysToAdd = currentHour < 6 ? 0 : 1;
        const sixAM = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd, 6, 0, 0);
        const timeDiff = sixAM - now;
        // Set duration to the time difference in minutes
        duration = Math.floor(timeDiff / (1000 * 60));
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
      // Check for night mode before final unblock - only for hard mode sites
      if (isHardMode && enableNightMode && isNightTime()) {
        showNightModeMessage();
        return;
      }
      await handleUnblockTime();
    } catch (error) {
      console.error('Error in handleUnblockTime:', error);
    }
  });
  document.getElementById('cancelUnblockButton').addEventListener('click', () => {
    try {
      remainFocused();
    } catch (error) {
      console.error('Error in remainFocused:', error)
    }
  });
  document.getElementById('backConfirmButton').addEventListener('click', () => {
    try {
      showTimeInput(false);
    } catch (error) {
      console.error('Error in showTimeInput:', error);
    }
  })
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
          smartRedirect(data.redirectUrl);
        } else {
          closeTab();
        }
      });
    } catch (error) {
      console.error('Error in closeButton:', error)
    }
  });
  document.getElementById('closeButtonNight').addEventListener('click', () => {
    try {
      closeTab();
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