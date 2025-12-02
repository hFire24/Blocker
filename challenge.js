let numProblems = 1;
let correctAnswers = [];
let enableNightMode = true;
let quoteStageStarted = false;
let quoteCompleted = false;

chrome.storage.sync.get(['enabled', 'hardMode', 'enableNightMode'], (data) => {
  const enabled = data.enabled || [];
  const hardMode = data.hardMode || [];
  enableNightMode = data.enableNightMode !== undefined ? data.enableNightMode : true;
  const overlap = enabled.filter(site => hardMode.includes(site));
  numProblems = overlap.length;

  for(let i = 0; i < numProblems; i++) {
    const problem = document.createElement('p');
    problem.classList.add('math-problem');
    problem.innerHTML = `Problem ${i + 1}: ${generateMathProblem()}`;
    const answerInput = document.createElement('input');
    answerInput.type = 'number';
    answerInput.classList.add('answer-input');
    problem.appendChild(answerInput);
    document.getElementById('mathProblems').appendChild(problem);
  }

  function generateMathProblem() {
    const num1 = Math.floor(Math.random() * 900) + 100;
    const num2 = Math.floor(Math.random() * 90) + 10;
    const num3 = Math.floor(Math.random() * 9000) + 1000;
    correctAnswers.push(num1 * num2 + num3);
    return `${num1} × ${num2} + ${num3} = `;
  }
});

function isNightTime() {
  const now = new Date();
  const currentHour = now.getHours();
  // Night time is between 9PM (21:00) and 4AM (04:00)
  return currentHour >= 21 || currentHour < 4;
}

function startQuoteStage() {
  // Pick random quote object (same structure as blocked.js expects)
  const quoteObj = quotes[Math.floor(Math.random() * quotes.length)];
  // Normalize characters similar to blocked.js
  const challengeQuote = quoteObj.quote
    .replace(/—|–/g, ', ')
    .replace(/…/g, '...')
    .replace(/[“”]/g, '"');
  const quoteTextElem = document.getElementById('quoteText');
  quoteTextElem.innerText = challengeQuote;
  quoteTextElem.title = 'Quote from ' + (quoteObj.author ? quoteObj.author : 'the developer, me!');

  const quoteInput = document.getElementById('quoteInput');
  quoteInput.value = '';
  quoteInput.onpaste = (e) => e.preventDefault();
  quoteInput.ondragover = (e) => e.preventDefault();
  quoteInput.ondrop = (e) => e.preventDefault();

  document.getElementById('confirmUnblockButton').innerText = '✅ Submit Quote';
  document.getElementById('quoteChallenge').style.display = 'block';
  quoteStageStarted = true;
}

document.getElementById('confirmUnblockButton').addEventListener('click', () => {
  // If quote already completed, safeguard: do nothing.
  if (quoteCompleted) return;

  if (!quoteStageStarted) {
    // First stage: math answers
    const answers = Array.from(document.getElementsByClassName('answer-input')).map(input => parseInt(input.value));
    const allCorrect = answers.length === correctAnswers.length && answers.every((ans, idx) => ans === correctAnswers[idx]);
    if (!allCorrect) {
      alert('Some answers are incorrect. Please try again.');
      return;
    }
    // Proceed to quote stage (night mode check deferred until quote completed)
    // Hide math problems & heading text update
    document.getElementById('mathProblems').style.display = 'none';
    document.getElementById('message').innerText = 'Final Step: Type the quote exactly as shown:';
    document.getElementById('flavorText').style.display = 'none';
    startQuoteStage();
    return;
  }

  // Second stage: quote typing
  const userQuote = document.getElementById('quoteInput').value.trim();
  const expectedQuote = document.getElementById('quoteText').innerText.replace(/’/g, "'");
  const feedbackElem = document.getElementById('quoteFeedback');
  if (userQuote !== expectedQuote) {
    feedbackElem.innerText = "That doesn't match. Please try again.";
    return;
  }
  // Success
  quoteCompleted = true;
  document.getElementById('challengeButtons').style.display = 'none';
  document.getElementById('successButton').style.display = 'block';
  let authorText = document.getElementById('quoteText').title.replace(/^Quote from /, '');
  if (authorText === 'the developer, me!') authorText = 'The developer, me!';
  document.getElementById('quoteText').innerText += ' – ' + authorText;
  if (isNightTime() && enableNightMode) {
    feedbackElem.innerText = 'Quote correct. However, it is currently nighttime, so the blocker will remain enabled. Please focus on winding down instead of unblocking websites.';
    return;
  }
  feedbackElem.innerText = 'Challenge completed. The blocker has been disabled.';
  chrome.storage.sync.set({ 'blockerEnabled': false });
});
document.getElementById('focusButton').addEventListener('click', () => {
  document.querySelector('.challenge-box').style.display = 'none';
  document.querySelector('.closing-box').style.display = 'block';
  chrome.storage.sync.get(['productiveSites'], (data) => {
    const productiveSites = data.productiveSites || [];
    const container = document.getElementById('productiveSites');
    if(productiveSites.length > 0) {
      container.innerHTML = '';
      productiveSites.forEach(site => {
        const link = document.createElement('a');
        link.href = site.url;
        link.textContent = site.name;
        container.appendChild(link);
      });
    }
  });
});

function closeCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.remove(tabs[0].id);
  });
}

document.getElementById('closeButton').addEventListener('click', closeCurrentTab);
document.getElementById('closeButtonSuccess').addEventListener('click', closeCurrentTab);