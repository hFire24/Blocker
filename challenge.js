let numProblems = 1;
let correctAnswers = [];
let enableNightMode = true;

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

document.getElementById('confirmUnblockButton').addEventListener('click', () => {
  const answers = Array.from(document.getElementsByClassName('answer-input')).map(input => parseInt(input.value));
  const allCorrect = answers.length === correctAnswers.length && answers.every((ans, idx) => ans === correctAnswers[idx]);
  if (allCorrect) {
    if (isNightTime() && enableNightMode) {
      alert('All answers are correct. However, it is currently nighttime, so the blocker will remain enabled. Please focus on winding down instead of unblocking websites.');
      window.close();
      return;
    }
    alert('All answers are correct. The blocker will be disabled.');
    chrome.storage.sync.set({ 'blockerEnabled': false }, () => {
      window.close();
    });
  } else {
    alert('Some answers are incorrect. Please try again.');
  }
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

document.getElementById('closeButton').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.remove(tabs[0].id);
  });
});