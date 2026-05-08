(function () {
  // ── Chat Widget ──────────────────────────
  const fab = document.getElementById('chatFab');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const messages = document.getElementById('chatMessages');

  fab.addEventListener('click', () => panel.classList.toggle('open'));
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  function addBubble(text, type) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + type;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    addBubble(text, 'user');
    input.value = '';

    setTimeout(() => {
      addBubble('Got it! I\'ll create a ' + text + ' module for you. 🌿', 'ai');
    }, 1000);
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  // ── Timeline data (kept from original pattern) ──
  const timelineEl = document.getElementById('timeline');
  if (timelineEl) {
    // Timeline is already populated in HTML; could be overridden by fetched data
    fetch('/dashboard/timeline.json')
      .then((r) => r.json())
      .then((items) => {
        if (Array.isArray(items) && items.length) {
          timelineEl.innerHTML = '';
          items.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item;
            timelineEl.appendChild(li);
          });
        }
      })
      .catch(() => {
        // Keep the static HTML items as fallback
      });
  }
})();
