document.addEventListener('DOMContentLoaded', () => {
  const blockedList = document.getElementById('blockedSitesList');
  const addUrlInput = document.getElementById('addUrlInput');
  const addUrlButton = document.getElementById('addUrlButton');
  const typeSelect = document.getElementById('typeSelect');
  const openHelpButton = document.getElementById('openHelp');
  const loadExample1Button = document.getElementById('loadExample1');
  const loadExample2Button = document.getElementById('loadExample2');

  // Load blocked items from storage
  chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
    const blocked = data.blocked || [];
    const enabled = data.enabled || [];

    blocked.forEach(item => {
      addItemToList(item, enabled.includes(item));
    });
  });

  addUrlButton.addEventListener('click', () => {
    const url = addUrlInput.value.trim();
    const type = typeSelect.value;
    if (url) {
      addBlockedPattern(url, type);
    }
  });

  openHelpButton.addEventListener('click', () => {
    window.open('help.html', '_blank');
  });

  loadExample1Button.addEventListener('click', () => {
    addUrlInput.value = 'example.com';
    typeSelect.value = 'website';
  });

  loadExample2Button.addEventListener('click', () => {
    addUrlInput.value = 'example';
    typeSelect.value = 'keyword';
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
    return pattern.length < 3 || pattern === '.*' || pattern === '.*?' || pattern === '.+';
  }
  
  function addBlockedPattern(pattern, type) {
    pattern = formatPattern(pattern, type);

    if (!validateRegex(pattern)) {
      alert("Invalid regular expression. Please try again.");
      return;
    }
    if (isPatternTooBroad(pattern)) {
      alert("This pattern is too broad and may block unintended URLs. Please make it more specific.");
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
        chrome.storage.sync.set({ blocked, enabled }, () => {
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

  function addItemToList(pattern, isEnabled) {
    const listItem = document.createElement('li');

    const itemText = document.createElement('span');
    const type = pattern.includes('^https?://') ? '🌐' : '🔍';
    const displayText = getDisplayText(pattern);
    itemText.textContent = `${type} ${displayText}`;
    if (!isEnabled) {
      itemText.classList.add('disabled');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => {
      toggleItem(pattern, checkbox.checked, itemText);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      deleteItem(pattern, listItem);
    });

    listItem.prepend(checkbox);
    listItem.appendChild(itemText);
    listItem.appendChild(deleteButton);
    blockedList.appendChild(listItem);
  }

  function toggleItem(pattern, isEnabled, itemText) {
    chrome.storage.sync.get('enabled', (data) => {
      let enabled = data.enabled || [];
      if (isEnabled) {
        if (!enabled.includes(pattern)) {
          enabled.push(pattern);
        }
        itemText.classList.remove('disabled');
      } else {
        enabled = enabled.filter(item => item !== pattern);
        itemText.classList.add('disabled');
      }
      chrome.storage.sync.set({ enabled });
    });
  }

  function deleteItem(pattern, listItem) {
    chrome.storage.sync.get(['blocked', 'enabled'], (data) => {
      const blocked = data.blocked.filter(item => item !== pattern);
      const enabled = data.enabled.filter(item => item !== pattern);
      chrome.storage.sync.set({ blocked, enabled }, () => {
        listItem.remove();
      });
    });
  }
});
