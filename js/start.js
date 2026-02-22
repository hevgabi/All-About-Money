// js/start.js

document.addEventListener('DOMContentLoaded', () => {
  const existing = loadData();
  const hasData = existing.wallets.length > 0 || existing.transactions.length > 0;
  if (hasData) {
    document.getElementById('existing-notice').style.display = 'block';
    document.querySelector('#fresh-btn .loader-btn-text span').textContent = 'I-continue ang existing data sa device na ito';
  }

  document.getElementById('load-btn').addEventListener('click', () => {
    document.getElementById('json-file-input').click();
  });

  function loadJsonFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.json')) { showToast('JSON file lang ang accepted!', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.wallets && !parsed.transactions && !parsed.goals) {
          showToast('Invalid file — hindi ito PesoTracker data', 'error');
          return;
        }
        localStorage.setItem('moneyTrackerData', JSON.stringify(parsed));
        showToast('Data loaded! Redirecting...', 'success');
        setTimeout(() => {
          sessionStorage.setItem('pesotracker_session', '1');
          window.location.href = 'index.html';
        }, 1000);
      } catch {
        showToast('Error reading file. Siguraduhing valid JSON ito.', 'error');
      }
    };
    reader.readAsText(file);
  }

  document.getElementById('json-file-input').addEventListener('change', e => loadJsonFile(e.target.files[0]));

  document.getElementById('fresh-btn').addEventListener('click', () => {
    sessionStorage.setItem('pesotracker_session', '1');
    window.location.href = 'index.html';
  });

  const loadBtn = document.getElementById('load-btn');
  loadBtn.addEventListener('dragover', e => { e.preventDefault(); loadBtn.classList.add('dragover'); });
  loadBtn.addEventListener('dragleave', () => loadBtn.classList.remove('dragover'));
  loadBtn.addEventListener('drop', e => {
    e.preventDefault();
    loadBtn.classList.remove('dragover');
    loadJsonFile(e.dataTransfer.files[0]);
  });
});
