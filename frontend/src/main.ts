const button = document.getElementById('meow');
const output = document.getElementById('output');

if (button instanceof HTMLButtonElement && output) {
  button.addEventListener('click', () => {
    output.textContent = 'Miaouuu 🐾 Tu viens de cliquer !';
  });
} else {
  console.error('CatFun : éléments #meow ou #output introuvables dans la page.');
}
