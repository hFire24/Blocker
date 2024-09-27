document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  const sitesTab = document.getElementById('sitesTab');
  const optionsTab = document.getElementById('optionsTab');
  const analyticsTab = document.getElementById('analyticsTab');
  const savedUrlsTab = document.getElementById('savedUrlsTab');
  const productiveUrlsTab = document.getElementById('productiveUrlsTab');
  const exportTab = document.getElementById('exportTab');
  const helpTab = document.getElementById('helpTab');

  function openTab(tabName) {
    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
    const tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
      tablinks[i].classList.remove("active");
    }
    document.getElementById(tabName).style.display = "block";
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  }

  // Event listeners for tabs
  sitesTab.addEventListener('click', () => openTab('Sites'));
  optionsTab.addEventListener('click', () => openTab('Options'));
  analyticsTab.addEventListener('click', () => openTab('Analytics'));
  savedUrlsTab.addEventListener('click', () => openTab('SavedUrls'));
  productiveUrlsTab.addEventListener('click', () => openTab('ProductiveUrls'))
  exportTab.addEventListener('click', () => openTab('Export'))
  helpTab.addEventListener('click', () => window.open('help.html'));

  // Check if a specific tab should be opened
  chrome.storage.sync.get(['openTab'], (data) => {
    if (data.openTab) {
      openTab(data.openTab);
      switch(data.openTab) {
        case 'Analytics':
          loadAnalytics();
          break;
        case 'SavedUrls':
          loadSavedUrls();
          break;
      }
      // Clear the openTab value
      chrome.storage.sync.remove('openTab');
    } else {
      // Default to the Sites tab if no tab is specified
      openTab('Sites');
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openSavedUrls') {
      openTab('SavedUrls');
      loadSavedUrls();
    }
  });

  const blockedList = document.getElementById('blockedSitesList');
  const addUrlInput = document.getElementById('addUrlInput');
  const addUrlButton = document.getElementById('addUrlButton');

  const addProductiveInput = document.getElementById('addProductiveInput')
  const addProductiveButton = document.getElementById('addProductiveButton');

  const backgroundColorSelect = document.getElementById('backgroundColorSelect');
  const confirmMessage = document.getElementById('enableConfirmMessage');
  const reasonInput = document.getElementById('enableReasonInput');
  const ubButtonDisabling = document.getElementById('enableUbButtonDisabling');
  const disableDuration = document.getElementById('ubDisableDuration');
  const timeInput = document.getElementById('enableTimeInput');
  const tempUnblocking = document.getElementById('enableTempUnblocking');
  const tempUbOptions = document.getElementById('enableTempUbOptions');
  const tempUbPopup = document.getElementById('enableTempUbPopup');
  const ubDuration = document.getElementById('ubDuration');
  const blockUrlSelect = document.getElementById('blockUrlSelect');
  const focusSelect = document.getElementById('focusSelect');
  const redirectField = document.getElementById('redirectPage');
  const messageField = document.getElementById('message');
  const notiReblock = document.getElementById('enableNotifications');

  let draggedItem = null;

  // Load blocked items from storage
  chrome.storage.sync.get(['blocked', 'enabled', 'favorites', 
  'blockedPageBgColor', 'enableConfirmMessage', 'enableReasonInput', 'enableUbButtonDisabling', 'ubDisableDuration', 
  'enableTimeInput', 'enableTempUnblocking', 'enableTempUbOptions', 'enableTempUbPopup', 'unblockDuration', 'saveBlockedUrls',
  'focusOption', 'redirectUrl', 'message', 'enableNotiReblock'], (data) => {
    const blocked = data.blocked || [];
    const enabled = data.enabled || [];
    const favorites = data.favorites || [];

    blocked.forEach(item => {
      addItemToList(item, enabled.includes(item), favorites.includes(item));
    });

    // Set blocking options
    backgroundColorSelect.value = data.blockedPageBgColor !== undefined ? data.blockedPageBgColor : "#1E3A5F";
    confirmMessage.checked = data.enableConfirmMessage !== undefined ? data.enableConfirmMessage : true;
    reasonInput.checked = data.enableReasonInput !== undefined ? data.enableReasonInput : false;
    ubButtonDisabling.checked = data.enableUbButtonDisabling !== undefined ? data.enableUbButtonDisabling : false;
    disableDuration.value = data.ubDisableDuration !== undefined ? data.ubDisableDuration : 15;
    timeInput.checked = data.enableTimeInput !== undefined ? data.enableTimeInput : false;
    tempUnblocking.checked = data.enableTempUnblocking !== undefined ? data.enableTempUnblocking : true;
    tempUbOptions.checked = data.enableTempUbOptions !== undefined ? data.enableTempUbOptions : false;
    tempUbPopup.checked = data.enableTempUbPopup !== undefined ? data.enableTempUbPopup : false;
    ubDuration.value = data.unblockDuration !== undefined ? data.unblockDuration : 5;
    blockUrlSelect.value = data.saveBlockedUrls !== undefined ? data.saveBlockedUrls : "reason";
    focusSelect.value = data.focusOption !== undefined ? data.focusOption : "close";
    redirectField.value = data.redirectUrl !== undefined ? data.redirectUrl : "";
    messageField.value = data.message !== undefined ? data.message : "You can do it! Stay focused!";
    notiReblock.checked = data.enableNotiReblock !== undefined ? data.enableNotiReblock : false;

    updateCheckboxState();
    toggleFocusField();
  });

  // Listen for changes in chrome.storage and update the blocked list in real time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.enabled || changes.blocked)) {
      updateBlockedList();
    }
  });

  function updateBlockedList() {
    chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
      blockedList.innerHTML = '';
      const blocked = data.blocked || [];
      const enabled = data.enabled || [];
      const favorites = data.favorites || [];

      blocked.forEach(item => {
        addItemToList(item, enabled.includes(item), favorites.includes(item));
      });
    });
  }

  // Event listeners for blocking options
  backgroundColorSelect.addEventListener('change', saveOptions);
  confirmMessage.addEventListener('change', saveOptions);
  reasonInput.addEventListener('change', saveOptions);
  ubButtonDisabling.addEventListener('change', saveOptions);
  disableDuration.addEventListener('change', saveOptions);
  timeInput.addEventListener('change', saveOptions);
  tempUnblocking.addEventListener('change', toggleTempUnblocking);
  tempUbOptions.addEventListener('change', saveOptions);
  tempUbPopup.addEventListener('change', saveOptions);
  ubDuration.addEventListener('change', saveOptions);
  blockUrlSelect.addEventListener('change', saveOptions);
  focusSelect.addEventListener('change', toggleFocusField);
  document.getElementById("saveUrl").addEventListener('click', saveOptions);
  document.getElementById("saveMessage").addEventListener('click', saveOptions);
  document.getElementById("resetMessage").addEventListener('click', resetMessage);
  notiReblock.addEventListener('change',saveOptions);

  function toggleTempUnblocking() {
    if (!tempUnblocking.checked) {
      chrome.alarms.clearAll(() => {
        chrome.storage.sync.get(null, (items) => {
          let allKeys = Object.keys(items);
          let keysToRemove = allKeys.filter(key => key.startsWith('reblock'));

          chrome.storage.sync.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
            } else {
              console.log(`Removed keys: ${keysToRemove}`);
            }
          });
        });
      });
    }
    updateCheckboxState();
  }

  function updateCheckboxState() {
    tempUbOptions.disabled = !tempUnblocking.checked ? true : false;
    tempUbPopup.disabled = !tempUnblocking.checked ? true : false;
    saveOptions();
  }

  function toggleFocusField() {
    document.getElementById("redirectOptions").style.display = "none";
    document.getElementById("messageOptions").style.display = "none";
    switch(focusSelect.value) {
      case "redirect":
        document.getElementById("redirectOptions").style.display = "inline";
        break;
      case "message":
        document.getElementById("messageOptions").style.display = "inline";
        break;
    }
    saveOptions();
  }

  function resetMessage() {
    const resetMessage = "You can do it! Stay focused!"
    chrome.storage.sync.set({ message: resetMessage });
    messageField.value = resetMessage;
  }

  function saveOptions() {
    const blockedPageBgColor = backgroundColorSelect.value;
    const enableConfirmMessage = confirmMessage.checked;
    const enableReasonInput = reasonInput.checked;
    const enableUbButtonDisabling = ubButtonDisabling.checked;
    const ubDisableDuration = disableDuration.value;
    const enableTimeInput = timeInput.checked;
    const enableTempUnblocking = tempUnblocking.checked;
    const enableTempUbOptions = tempUbOptions.disabled ? false : tempUbOptions.checked;
    const enableTempUbPopup = tempUbPopup.disabled ? false : tempUbPopup.checked;
    const unblockDuration = ubDuration.value;
    const saveBlockedUrls = blockUrlSelect.value;
    const focusOption = focusSelect.value;
    const redirectUrl = redirectField.value;
    const message = messageField.value;
    const enableNotiReblock = notiReblock.checked;
    chrome.storage.sync.set({ blockedPageBgColor, enableConfirmMessage, enableReasonInput, enableUbButtonDisabling, ubDisableDuration, 
      enableTimeInput, enableTempUnblocking, enableTempUbOptions, enableTempUbPopup, unblockDuration, saveBlockedUrls,
      focusOption, redirectUrl, message, enableNotiReblock });
  }

  addUrlButton.addEventListener('click', () => {
    const url = addUrlInput.value.trim().toLowerCase();
    const type = url.includes('.') ? 'website' : 'keyword';
    if (url) {
      addBlockedPattern(url, type);
    }
  });

  function validateRegex(pattern) {
    try {
      new RegExp(pattern);
      return true;
    } catch (e) {
      return false;
    }
  }

  function formatPattern(pattern, type) {
    if (type === 'website') {
      pattern = `^https?://+([^:/]+\\.)?${escapePattern(pattern)}[:/]`;
    } else if (type === 'keyword') {
      pattern = `(?:q|s|search_query)=(.*${escapePattern(pattern)}[^&]*)`;
    }
    return pattern;
  }

  function escapePattern(input) {
    return input.replace(/\./g, '\\.').replace(/ /g, '+');
  }

  function isPatternTooBroad(pattern) {
    return pattern.length < 4 || pattern.includes('.*') || pattern.includes('.*?') || pattern.includes('.+');
  }

  function addBlockedPattern(pattern, type) {
    if (isPatternTooBroad(pattern)) {
      alert(`Keyword is too broad.\nTo block the whole word: \\b${pattern}\\b\nTo block just the start: \\b${pattern}\nTo block just the end: ${pattern}\\b`);
      return;
    }
    pattern = formatPattern(pattern, type);

    if (!validateRegex(pattern)) {
      alert("Invalid regular expression. Please try again.");
      return;
    }
    // Add the pattern to the blocked list and the enabled list
    chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
      const blocked = data.blocked || [];
      let enabled = data.enabled || [];
      if (!blocked.includes(pattern)) {
        blocked.push(pattern);
        if (!enabled.includes(pattern)) {
          enabled.push(pattern);
        }
        chrome.storage.sync.set({ blocked, enabled, [`blockedTimestamp_${getDisplayText(pattern)}`]: Date.now() }, () => {
          addItemToList(pattern, true);
        });
      }
    });
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

  function addItemToList(pattern, isEnabled, isFavorite) {
    const listItem = document.createElement('li');
    listItem.draggable = true;

    const dragHandle = document.createElement('span');
    dragHandle.textContent = '☰';
    dragHandle.className = 'drag-handle';

    const itemText = document.createElement('span');
    const type = pattern.includes('^https?://') ? '🌐' : '🔍';
    const displayText = getDisplayText(pattern);
    itemText.textContent = `${type} ${displayText}`;
    itemText.classList.add('text');
    if (!isEnabled) {
      itemText.classList.add('disabled');
    }

    const favoriteButton = document.createElement('span');
    favoriteButton.textContent = isFavorite ? '★' : '☆';
    favoriteButton.className = 'star';
    favoriteButton.addEventListener('click', () => {
      toggleFavorite(pattern, favoriteButton)
    })

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => {
      toggleItem(pattern, checkbox.checked, itemText);
    });

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => {
      editItem(pattern, listItem, itemText);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      deleteItem(pattern, listItem);
    });

    listItem.appendChild(dragHandle);
    listItem.appendChild(favoriteButton);
    listItem.appendChild(checkbox);
    listItem.appendChild(itemText);
    listItem.appendChild(editButton);
    listItem.appendChild(deleteButton);

    listItem.addEventListener('dragstart', handleDragStart);
    listItem.addEventListener('dragover', handleDragOver);
    listItem.addEventListener('drop', handleDrop);
    listItem.addEventListener('dragend', handleDragEnd);

    blockedList.appendChild(listItem);
  }

  function toggleFavorite(pattern, button) {
    chrome.storage.sync.get(['blocked', 'favorites'], (data) => {
      let blocked = data.blocked || [];
      let favorites = data.favorites || [];
      if (button.textContent === '☆') {
        if (!favorites.includes(pattern)) {
          favorites.push(pattern);
          favorites.sort((a, b) => blocked.indexOf(a) - blocked.indexOf(b));
        }
        button.textContent = '★';
      } else {
        favorites = favorites.filter(item => item !== pattern);
        button.textContent = '☆';
      }
      chrome.storage.sync.set({ favorites });
    });
  }

  function toggleItem(pattern, isEnabled, itemText) {
    const displayPattern = getDisplayText(pattern);
    chrome.storage.sync.get(['enabled', `blockedTimestamp_${displayPattern}`], (data) => {
      let enabled = data.enabled || [];
      if (isEnabled) {
        if (!enabled.includes(pattern)) {
          enabled.push(pattern);
          if (!data[`blockedTimestamp_${displayPattern}`]) {
            chrome.storage.sync.set({ [`blockedTimestamp_${displayPattern}`]: Date.now() });
          }
        }
        itemText.classList.remove('disabled');
      } else {
        enabled = enabled.filter(item => item !== pattern);
        itemText.classList.add('disabled');
      }
      chrome.storage.sync.set({ enabled }, () => {
        if (isEnabled) {
          const alarmName = `reblock_${displayPattern}`;
          deleteAlarm(alarmName);
        }
      });
    });
  }

  function deleteAlarm(alarmName) {
    chrome.alarms.clear(alarmName, (wasCleared) => {
      if (wasCleared) {
        console.log(`Cleared ${alarmName}`);
        chrome.storage.sync.remove(alarmName);
      }
    });
  }

  function editItem(oldPattern, listItem, itemText) {
    const displayText = getDisplayText(oldPattern);
    const blockedList = document.getElementById('blockedSitesList');
    const listItems = blockedList.querySelectorAll('li');

    if (blockedList.querySelectorAll('button.save').length === 0) {
      listItems.forEach(li => {
        li.setAttribute('draggable', 'false');
      });
    }
    const type = oldPattern.includes('^https?://') ? '🌐' : '🔍';

    // Create edit input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.value = displayText;
    editInput.className = 'edit-input';

    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save';
    saveButton.addEventListener('click', () => {
      const newDisplayText = editInput.value.trim();
      if (isPatternTooBroad(newDisplayText)) {
        alert("This pattern is too broad and may block unintended URLs. Please make it more specific.");
        revertToDisplayMode();
        return;
      }
      if (newDisplayText && newDisplayText !== displayText) {
        const newPattern = newDisplayText.includes('.') ? formatPattern(newDisplayText, 'website') : formatPattern(newDisplayText, 'keyword');

        if (!validateRegex(newPattern)) {
          alert("Invalid regular expression. Please try again.");
          revertToDisplayMode();
          return;
        }
        updatePattern(oldPattern, newPattern, listItem, itemText);
      } else {
        // If no changes, revert back to display mode
        revertToDisplayMode();
      }
    });

    // Replace text and buttons with edit input and save button
    listItem.replaceChild(editInput, itemText);
    listItem.replaceChild(saveButton, listItem.querySelector('button:nth-of-type(1)'));
    listItem.removeChild(listItem.querySelector('button:nth-of-type(2)'));

    // Focus on the input
    editInput.focus();

    function revertToDisplayMode() {
      listItem.replaceChild(itemText, editInput);
      const blockedList = document.getElementById('blockedSitesList');
      const listItems = blockedList.querySelectorAll('li');

      if (blockedList.querySelectorAll('button.save').length <= 1) {
        listItems.forEach(li => {
          li.setAttribute('draggable', 'true');
        });
      }

      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', () => {
        editItem(oldPattern, listItem, itemText);
      });
      listItem.replaceChild(editButton, saveButton);
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => {
        deleteItem(oldPattern, listItem);
      });
      listItem.appendChild(deleteButton);
    }
  }

  function updatePattern(oldPattern, newPattern, listItem, itemText) {
    chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
      let blocked = data.blocked || [];
      let enabled = data.enabled || [];
      let favorites = data.favorites || [];

      const oldIndex = blocked.indexOf(oldPattern);
      if (oldIndex !== -1) {
        blocked[oldIndex] = newPattern;
      }

      const enabledIndex = enabled.indexOf(oldPattern);
      if (enabledIndex !== -1) {
        enabled[enabledIndex] = newPattern;
      }

      const favoritesIndex = favorites.indexOf(oldPattern);
      if (favoritesIndex !== -1) {
        favorites[favoritesIndex] = newPattern;
      }

      chrome.storage.sync.remove(`blockedTimestamp_${getDisplayText(oldPattern)}`);

      const alarmName = `reblock_${getDisplayText(oldPattern)}`;
      deleteAlarm(alarmName);

      chrome.storage.sync.set({ blocked, enabled, favorites, [`blockedTimestamp_${getDisplayText(newPattern)}`]: Date.now() }, () => {
        const type = newPattern.includes('^https?://') ? '🌐' : '🔍';
        const displayText = getDisplayText(newPattern);
        itemText.textContent = `${type} ${displayText}`;
        listItem.replaceChild(itemText, listItem.querySelector('.edit-input'));

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => {
          editItem(newPattern, listItem, itemText);
        });
        listItem.replaceChild(editButton, listItem.querySelector('button:nth-of-type(1)'));

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
          deleteItem(newPattern, listItem);
        });
        listItem.appendChild(deleteButton);
      });
    });
  }

  function deleteItem(pattern, listItem) {
    if (confirm("Are you sure you want to delete this item?")) {
      chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
        const blocked = data.blocked.filter(item => item !== pattern);
        const enabled = data.enabled.filter(item => item !== pattern);
        const favorites = data.favorites.filter(item => item !== pattern);
        chrome.storage.sync.set({ blocked, enabled, favorites }, () => {
          listItem.remove();
          chrome.storage.sync.remove(`blockedTimestamp_${getDisplayText(pattern)}`);
          const alarmName = `reblock_${getDisplayText(pattern)}`;
          deleteAlarm(alarmName);
        });
      });
    }
  }

  function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.style.opacity = '0.4';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    const targetItem = e.target.closest('li');
    const draggedList = draggedItem.parentNode; // Get the list the dragged item belongs to
    const targetList = targetItem ? targetItem.parentNode : null;
    if (targetList && draggedList === targetList && draggedItem !== targetItem) {
      const rect = targetItem.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      if (e.clientY > middleY) {
        targetItem.parentNode.insertBefore(draggedItem, targetItem.nextSibling);
      } else {
        targetItem.parentNode.insertBefore(draggedItem, targetItem);
      }
    } else if (!targetItem) {
      // Append to the end of the list if dropped on empty space
      draggedList.appendChild(draggedItem);
    }
    // Update the order in storage based on the list type (blocked or productive)
    if (draggedList.id === 'blockedSitesList') {
      updateBlockedOrder(); // Update blocked site order
    } else if (draggedList.id === 'productiveSitesList') {
      updateProductiveOrder(); // Update productive URLs order
    }
    return false;
  }

  function handleDragEnd() {
    this.style.opacity = '1';
    draggedItem = null;

    // Save the new order after drag ends
    saveProductiveSites();
  }

  function updateBlockedOrder() {
    const newOrder = Array.from(blockedList.children).map(li => {
      const itemText = li.querySelector('.text').textContent;
      return itemText.slice(2).trim(); // Remove emoji and trim
    });

    chrome.storage.sync.get(['blocked', 'enabled', 'favorites'], (data) => {
      const oldBlocked = data.blocked || [];
      const enabled = data.enabled || [];
      const favorites = data.favorites || [];

      // Create a map of display text to original pattern
      const patternMap = new Map(oldBlocked.map(pattern => [getDisplayText(pattern), pattern]));

      // Create the new blocked array based on the new order
      const newBlocked = newOrder.map(displayText => patternMap.get(displayText));

      favorites.sort((a, b) => newBlocked.indexOf(a) - newBlocked.indexOf(b));

      chrome.storage.sync.set({ blocked: newBlocked, enabled, favorites }, () => {
        console.log('Blocked list order updated');
      });
    });
  }

  function updateProductiveOrder() {
    const newOrder = Array.from(document.getElementById('productiveSitesList').children).map(li => {
      return li.querySelector('.text').textContent.trim(); // Get URL text
    });

    // Save the new productive URL order to chrome storage
    chrome.storage.sync.get(['productive'], (data) => {
      const productive = data.productive || [];
      // Assuming the productive list is just a flat array of URLs, reorder it based on the new order
      productive.sort((a, b) => newOrder.indexOf(a) - newOrder.indexOf(b));

      chrome.storage.sync.set({ productive }, () => {
        console.log('Productive URLs order updated');
      });
    });
  }

  function loadAnalytics() {
    chrome.storage.local.get(['blockedCounts'], (data) => {
      const blockedCounts = data.blockedCounts || {};
  
      // Convert the blockedCounts object to an array for sorting
      const blockedCountsArray = [];
      Object.keys(blockedCounts).forEach(date => {
        const countsForDate = blockedCounts[date];
        Object.keys(countsForDate).forEach(pattern => {
          blockedCountsArray.push({
            date: date,
            pattern: pattern,
            count: countsForDate[pattern]
          });
        });
      });
  
      // Function to remove "www." and "\b" from the display text
      function removeWwwB(pattern) {
        return pattern.replace(/^www\./, '').replace(/^\\b/, '');
      }
  
      // Sort the array by date in descending order, then by count in descending order, then by pattern ignoring "\b" and "www."
      blockedCountsArray.sort((a, b) => {
        const dateComparison = new Date(b.date) - new Date(a.date);
        if (dateComparison !== 0) return dateComparison;
  
        const countComparison = b.count - a.count;
        if (countComparison !== 0) return countComparison;
  
        // Use getDisplayText and removeWww for the final pattern comparison
        const patternA = removeWwwB(getDisplayText(a.pattern));
        const patternB = removeWwwB(getDisplayText(b.pattern));
        return patternA.localeCompare(patternB);
      });
  
      // Set table
      const tableBody = document.getElementById('analyticsTableBody');
      tableBody.innerHTML = '';
  
      blockedCountsArray.forEach(entry => {
        const row = document.createElement('tr');
        const patternCell = document.createElement('td');
        const dateCell = document.createElement('td');
        const countCell = document.createElement('td');
  
        patternCell.textContent = getDisplayText(entry.pattern);
        dateCell.textContent = entry.date;
        countCell.textContent = entry.count;
  
        row.appendChild(patternCell);
        row.appendChild(dateCell);
        row.appendChild(countCell);
        tableBody.appendChild(row);
      });
    });
  }

  // Load analytics when the Analytics tab is opened
  analyticsTab.addEventListener('click', loadAnalytics);

  function loadSavedUrls() {
    chrome.storage.local.get(['savedUrls'], (data) => {
      let savedUrls = data.savedUrls || {};

      // Remove entries older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

      savedUrls = Object.fromEntries(
        Object.entries(savedUrls).filter(([date]) => date >= cutoffDate)
      );

      const savedUrlsBody = document.getElementById('savedUrlsBody');
      savedUrlsBody.innerHTML = ''; // Clear any existing rows

      // Convert savedUrls object to an array of {date, url, patterns, reason} objects
      const savedUrlsArray = [];
      Object.keys(savedUrls).forEach(date => {
        savedUrls[date].forEach(entry => {
          savedUrlsArray.push({ date, ...entry });
        });
      });

      // Sort the array by date in descending order
      savedUrlsArray.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Populate the table
      savedUrlsArray.forEach(entry => {
        const row = document.createElement('tr');
        
        const urlCell = document.createElement('td');
        urlCell.textContent = entry.url;
        
        const patternsCell = document.createElement('td');
        patternsCell.textContent = entry.patterns.map(getDisplayText).join(', ');
        
        const dateCell = document.createElement('td');
        dateCell.textContent = entry.date;
        
        const reasonsCell = document.createElement('td');
        reasonsCell.innerText = entry.reason.replace(/; /g, '\n');
        
        const deleteCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', () => {
          deleteSavedUrl(entry.date, entry.url);
        });
        deleteCell.appendChild(deleteButton);

        row.appendChild(urlCell);
        row.appendChild(patternsCell);
        row.appendChild(dateCell);
        row.appendChild(reasonsCell);
        row.appendChild(deleteCell);

        savedUrlsBody.appendChild(row);
      });
    });
  }

  // Function to delete a saved URL
  function deleteSavedUrl(date, url) {
    chrome.storage.local.get(['savedUrls'], (data) => {
      let savedUrls = data.savedUrls || {};
      if (savedUrls[date]) {
        savedUrls[date] = savedUrls[date].filter(entry => entry.url !== url);
        if (savedUrls[date].length === 0) {
          delete savedUrls[date];
        }
        chrome.storage.local.set({ savedUrls }, () => {
          loadSavedUrls(); // Reload the table after deletion
        });
      }
    });
  }

  // Function to delete all saved URLs
  document.getElementById('deleteAllUrlsButton').addEventListener('click', () => {
    if(confirm(`Are you sure you want to delete all saved URLs? This cannot be undone.`)) {
      chrome.storage.local.remove('savedUrls', () => {
        loadSavedUrls(); // Reload the table after deletion
      });
    }
  });

  // Load saved URLs when the Saved URLs tab is opened
  savedUrlsTab.addEventListener('click', loadSavedUrls);

  addProductiveButton.addEventListener('click', () => {
    const url = addProductiveInput.value.trim();
    if (url.startsWith('https://')) {
      // Add the valid URL to the list
      let name = prompt("Name this site.", "Productive Site");
      addProductiveUrlToList(url, name, true);
    } else {
      alert('Please enter a valid URL that starts with https://');
    }
  });

  function addProductiveUrlToList(url, name = '', adding) {
    const productiveSitesList = document.getElementById('productiveSitesList');

    // Create a new list item for the URL
    const listItem = document.createElement('li');
    listItem.draggable = true;

    // Drag handle for reordering
    const dragHandle = document.createElement('span');
    dragHandle.textContent = '☰';
    dragHandle.className = 'drag-handle';

    // Display URL
    const itemText = document.createElement('span');
    itemText.textContent = url;
    itemText.classList.add('text');

    // Optional name
    const nameText = document.createElement('span');
    nameText.textContent = name || 'Productive Site';
    nameText.classList.add('name');

    // Group buttons in a flex container
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group'

    // Edit URL button
    const editUrlButton = document.createElement('button');
    editUrlButton.textContent = 'Edit URL';
    editUrlButton.addEventListener('click', () => {
      const newUrl = prompt('Enter new URL:', url);
      if (newUrl && newUrl.startsWith('https://')) {
        itemText.textContent = newUrl;
        url = newUrl; // Update the URL in this list item
        saveProductiveSites(); // Save changes to chrome.storage.sync
      } else {
        alert('Please enter a valid URL that starts with https://');
      }
    });

    // Edit Name button
    const editNameButton = document.createElement('button');
    editNameButton.textContent = 'Edit Name';
    editNameButton.addEventListener('click', () => {
      const newName = prompt('Enter new name:', nameText.textContent);
      if (newName) {
        nameText.textContent = newName;
        name = newName; // Update the name in this list item
        saveProductiveSites(); // Save changes to chrome.storage.sync
      }
    });

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete ${url}?`)) {
        listItem.remove();
        saveProductiveSites(); // Save changes to chrome.storage.sync after deletion
      }
    });

    //Append buttons to the button group
    buttonGroup.appendChild(editUrlButton);
    buttonGroup.appendChild(editNameButton);
    buttonGroup.appendChild(deleteButton);

    // Append all elements to the list item
    listItem.appendChild(dragHandle);
    listItem.appendChild(itemText);
    listItem.appendChild(nameText);
    listItem.appendChild(buttonGroup)

    // Add drag and drop event listeners for reordering
    listItem.addEventListener('dragstart', handleDragStart);
    listItem.addEventListener('dragover', handleDragOver);
    listItem.addEventListener('drop', handleDrop);
    listItem.addEventListener('dragend', handleDragEnd);

    // Append the new list item to the productiveSitesList
    productiveSitesList.appendChild(listItem);

    // Save to chrome.storage.sync after adding
    if(adding) saveProductiveSites();
    else adjustColumnWidths();
  }

  function saveProductiveSites() {
    const productiveSitesList = document.getElementById('productiveSitesList');
    const productiveSitesArray = Array.from(productiveSitesList.children).map(li => {
      return {
        url: li.querySelector('.text').textContent.trim(), // URL
        name: li.querySelector('.name').textContent.trim()  // Name
      };
    });

    // Save to chrome.storage.sync
    chrome.storage.sync.set({ productiveSites: productiveSitesArray }, () => {
      console.log('Productive sites saved:', productiveSitesArray);
    });

    adjustColumnWidths();
  }

  function loadProductiveSites() {
    chrome.storage.sync.get(['productiveSites'], (data) => {
      const productiveSitesArray = data.productiveSites || [];
      const productiveSitesList = document.getElementById('productiveSitesList');
      
      // Clear current list
      productiveSitesList.innerHTML = '';

      // Add each productive site back to the list
      productiveSitesArray.forEach(site => {
        addProductiveUrlToList(site.url, site.name, false);
      });
    });
  }

  // Load productive sites when the Productive URLs tab is clicked
  document.getElementById('productiveUrlsTab').addEventListener('click', loadProductiveSites);

  function adjustColumnWidths() {
    const productiveSitesList = document.getElementById('productiveSitesList');
    
    let longestUrl = 0;
    let longestName = 0;
  
    // Calculate the longest URL and Name widths
    Array.from(productiveSitesList.children).forEach(li => {
      const url = li.querySelector('.text').textContent;
      const name = li.querySelector('.name').textContent;
  
      const urlWidth = getTextWidth(url, '12px Arial'); // Adjust the font and size if needed
      const nameWidth = getTextWidth(name, '12px Arial');
  
      if (urlWidth > longestUrl) longestUrl = urlWidth;
      if (nameWidth > longestName) longestName = nameWidth;
    });
  
    // Add some padding (n + m pixels) to the calculated widths
    longestUrl += 20;  // Add extra space for padding
    longestName += 20; // Add extra space for padding
  
    // Apply the calculated width to all URL and Name columns
    Array.from(productiveSitesList.children).forEach(li => {
      li.style.gridTemplateColumns = `20px ${longestUrl}px ${longestName}px auto`;
    });
    console.log(longestUrl + ' ' + longestName);
  }
  
  function getTextWidth(text, font) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;
    const metrics = context.measureText(text);
    return metrics.width;
  }

  document.getElementById('exportButton').addEventListener('click', exportData);
  document.getElementById('importButton').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importData);

  function exportData() {
    chrome.storage.sync.get(null, (syncData) => {
      chrome.storage.local.get(null, (localData) => {
        const data = {
          sync: syncData,
          local: localData
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'websiteBlockerUserData.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = JSON.parse(e.target.result);
      if (data.sync) {
        chrome.storage.sync.set(data.sync, () => {
          console.log('Sync data imported');
        });
      }
      if (data.local) {
        chrome.storage.local.set(data.local, () => {
          console.log('Local data imported');
        });
      }
    };
    reader.readAsText(file);
  }
});