const speechBubble = document.getElementById('speechBubble');
const speechBubbleText = document.getElementById('speechBubbleText');
const speechBubbleTail = document.getElementById('speechBubbleTail');

window.focusbuddyBubble.onSetText((text) => {
  speechBubbleText.textContent = text;
  speechBubble.dataset.visible = 'false';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      speechBubble.dataset.visible = 'true';
    });
  });
});

window.focusbuddyBubble.onUpdate(({ tailOffsetX, flipped }) => {
  document.body.dataset.flipped = flipped;
  speechBubbleTail.className = `speech-bubble-tail ${flipped ? 'tail-up' : 'tail-down'}`;
  speechBubbleTail.style.left = `${tailOffsetX}px`;
});
