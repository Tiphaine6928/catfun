const button = document.getElementById('meow') as HTMLButtonElement;
const output = document.getElementById('output') as HTMLParagraphElement;

button.addEventListener('click', () => {
  output.textContent = 'Miaouuu 🐾 Tu viens de cliquer !';
});
