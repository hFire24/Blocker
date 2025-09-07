let numProblems = 1;
let correctAnswers = [];

chrome.storage.sync.get(['enabled', 'hardMode'], (data) => {
  const enabled = data.enabled || [];
  const hardMode = data.hardMode || [];
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

document.getElementById('confirmUnblockButton').addEventListener('click', () => {
  const answers = Array.from(document.getElementsByClassName('answer-input')).map(input => parseInt(input.value));
  const allCorrect = answers.length === correctAnswers.length && answers.every((ans, idx) => ans === correctAnswers[idx]);
  if (allCorrect) {
    alert('All answers are correct. The blocker will be disabled.');
    chrome.storage.sync.set({ 'blockerEnabled': false }, () => {
      window.close();
    });
  } else {
    alert('Some answers are incorrect. Please try again.');
  }
});