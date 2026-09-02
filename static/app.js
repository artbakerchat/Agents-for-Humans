const form = document.getElementById('promptForm');
const promptInput = document.getElementById('promptInput');
const statusA = document.getElementById('statusA');
const statusB = document.getElementById('statusB');
const responseA = document.getElementById('responseA');
const responseB = document.getElementById('responseB');
const playA = document.getElementById('playA');
const playB = document.getElementById('playB');
const copyA = document.getElementById('copyA');
const copyB = document.getElementById('copyB');

const setResponseState = (element, text) => {
  element.textContent = text || '';
  element.parentElement?.querySelector('button')?.toggleAttribute('disabled', !text);
};

const enableButtons = (aText, bText) => {
  playA.disabled = !aText;
  playB.disabled = !bText;
  copyA.disabled = !aText;
  copyB.disabled = !bText;
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) {
    statusA.textContent = 'Model A: Please enter a prompt.';
    statusB.textContent = 'Model B: Please enter a prompt.';
    return;
  }

  statusA.textContent = 'Model A: Thinking...';
  statusB.textContent = 'Model B: Thinking...';
  responseA.textContent = '';
  responseB.textContent = '';
  enableButtons('', '');

  try {
    const response = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');

    responseA.textContent = data.modelA || 'No response returned.';
    responseB.textContent = data.modelB || 'No response returned.';
    statusA.textContent = `Model A: ${data.source === 'bedrock' ? 'Bedrock response' : 'Local fallback'}`;
    statusB.textContent = `Model B: ${data.source === 'bedrock' ? 'Bedrock response' : 'Local fallback'}`;
    enableButtons(responseA.textContent, responseB.textContent);
  } catch (error) {
    statusA.textContent = 'Model A: Error';
    statusB.textContent = 'Model B: Error';
    responseA.textContent = error.message || 'Something went wrong.';
    responseB.textContent = error.message || 'Something went wrong.';
    enableButtons(responseA.textContent, responseB.textContent);
  }
});

playA?.addEventListener('click', () => {
  const text = responseA.textContent.trim();
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
});

playB?.addEventListener('click', () => {
  const text = responseB.textContent.trim();
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
});

copyA?.addEventListener('click', async () => {
  const text = responseA.textContent.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  statusA.textContent = 'Model A: Copied';
});

copyB?.addEventListener('click', async () => {
  const text = responseB.textContent.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  statusB.textContent = 'Model B: Copied';
});

const board = document.getElementById('pinballBoard');
const ball = document.getElementById('pinballBall');
const statusEl = document.getElementById('pinballStatus');

if (board && ball) {
  let x = 60;
  let y = 50;
  let dx = 2.6;
  let dy = 1.8;
  let animationId = null;

  const animateBall = () => {
    const rect = board.getBoundingClientRect();
    const radius = 10;
    x += dx;
    y += dy;

    if (x <= 0 || x >= rect.width - radius * 2) dx *= -1;
    if (y <= 0 || y >= rect.height - radius * 2) dy *= -1;

    ball.style.left = `${x}px`;
    ball.style.top = `${y}px`;
    animationId = requestAnimationFrame(animateBall);
  };

  const startMotion = () => {
    if (animationId) cancelAnimationFrame(animationId);
    statusEl.textContent = 'Pinball live.';
    animationId = requestAnimationFrame(animateBall);
  };

  board.addEventListener('click', startMotion);
  document.querySelector('[data-flipper="left"]').addEventListener('click', () => {
    statusEl.textContent = 'Left flipper engaged.';
    dx = -Math.abs(dx) - 0.8;
    dy = -Math.abs(dy) + 0.6;
  });
  document.querySelector('[data-flipper="right"]').addEventListener('click', () => {
    statusEl.textContent = 'Right flipper engaged.';
    dx = Math.abs(dx) + 0.8;
    dy = -Math.abs(dy) + 0.6;
  });
}
