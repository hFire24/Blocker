// blocked.js
document.getElementById('unblockButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'unblockSite' });
});
