const scratchText = document.querySelector('#scratchText');
const chooseOneButton = document.querySelector('#chooseOne');
const boxMessages = document.querySelector('#boxMessages');
const boxes = [...document.querySelectorAll('.mystery-box')];
const messageSources = Object.values(import.meta.glob('../resource/box/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}));
let boxClickCount = 0;
let clicksUntilBubble = randomClickThreshold();
const maxBubbles = 3;

function randomClickThreshold() {
  return Math.floor(Math.random() * 6) + 5;
}

const clearScratchPad = () => {
  scratchText.value = '';
  window.LavenderPreferences?.set('scratchText', '');
};

const savedScratchText = window.LavenderPreferences?.get('scratchText', '');
if (savedScratchText) scratchText.value = savedScratchText;
scratchText.addEventListener('input', () => window.LavenderPreferences?.set('scratchText', scratchText.value));

const selectBox = (box) => {
  boxes.forEach((item) => item.classList.toggle('mystery-box--selected', item === box));
  clearScratchPad();
};

const showRandomBoxMessage = () => {
  if (!messageSources.length) return;

  const source = messageSources[Math.floor(Math.random() * messageSources.length)];
  const line = source.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  if (!line) return;

  const bubble = document.createElement('p');
  bubble.className = 'box-message';
  bubble.textContent = line.replace(/^#{1,6}\s+/, '').replace(/^[-*+]\s+/, '');
  boxMessages.append(bubble);

  if (boxMessages.children.length > maxBubbles) {
    boxMessages.firstElementChild.remove();
  }

  requestAnimationFrame(() => bubble.classList.add('box-message--visible'));
  setTimeout(() => {
    bubble.classList.remove('box-message--visible');
    bubble.addEventListener('transitionend', () => bubble.remove(), { once: true });
  }, 3000);
};

boxes.forEach((box) => {
  box.addEventListener('click', () => {
    selectBox(box);
    boxClickCount += 1;

    if (boxClickCount >= clicksUntilBubble) {
      showRandomBoxMessage();
      boxClickCount = 0;
      clicksUntilBubble = randomClickThreshold();
    }
  });
});

chooseOneButton.addEventListener('click', () => {
  const box = boxes[Math.floor(Math.random() * boxes.length)];
  selectBox(box);
  box.classList.remove('mystery-box--shaking');
  requestAnimationFrame(() => box.classList.add('mystery-box--shaking'));
});
