document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.font-size-button');
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
      document.body.style.fontSize = button.getAttribute('data-size');
    });
  });
});
