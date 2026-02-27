// js/installments.js — PayLater / Installment feature

// ── Weekly Cycle Helper ───────────────────────────────────────
// Returns the current week number (1-based) relative to a start date.
// Returns null if no start date set.
function _getCurrentWeekNum(weeklyStartDate) {
  if (!weeklyStartDate) return null;
  const start = new Date(weeklyStartDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null; // start date is in the future
  return Math.floor(diffDays / 7) + 1;
}

// ── Render ────────────────────────────────────────────────────
async function renderInstallments() {
  const list = await getInstallments();
  const container = document.getElementById('inst-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>
      <p>Wala pang installment. Mag-dagdag ng PayLater item!</p>
    </div>`;
    return;
  }

  list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const iconPay  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>`;
  const iconDel  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`;

  container.innerHTML = list.map(inst => {
    const pct     = Math.min(100, (inst.paidAmount / inst.total) * 100);
    const done    = inst.paidAmount >= inst.total;
    const remain  = inst.total - inst.paidAmount;

    // FEATURE: weekly cycle display (inline - no modal)
    const weekNum = _getCurrentWeekNum(inst.weeklyStartDate);
    const weekBadge = weekNum
      ? `<div style="font-size:0.73rem;color:var(--accent);margin-top:6px;opacity:0.85">📅 Week ${weekNum} <span style="color:var(--text3)">(since ${inst.weeklyStartDate})</span></div>`
      : ``;

    return `
    <div class="inst-card ${done ? 'done' : ''}" data-id="${inst.id}">
      ${done ? '<div class="inst-done-badge">✓ PAID</div>' : ''}
      <div class="inst-name">${escapeHtml(inst.name)}</div>
      <div class="inst-meta">${inst.months} months × ${formatMoney(inst.monthlyAmount)}/mo &bull; Total: ${formatMoney(inst.total)}</div>
      ${weekBadge}
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;margin-bottom:2px">
        <label style="font-size:0.73rem;color:var(--text3);white-space:nowrap">📅 Weekly start:</label>
        <input type="date" class="inst-date-inline" data-id="${inst.id}" value="${inst.weeklyStartDate || ''}"
          style="font-size:0.73rem;background:var(--bg3,#1a1a2e);color:var(--text1);border:1px solid var(--border2,#333);border-radius:6px;padding:3px 7px;cursor:pointer;max-width:160px"/>
      </div>
      <div class="inst-amounts">
        <div>
          <div class="inst-amt-label">Paid</div>
          <div class="inst-amt-val" style="color:var(--accent)">${formatMoney(inst.paidAmount)}</div>
        </div>
        <div>
          <div class="inst-amt-label">Remaining</div>
          <div class="inst-amt-val" style="color:${done ? 'var(--text3)' : 'var(--danger)'}">` + formatMoney(remain) + `</div>
        </div>
        <div>
          <div class="inst-amt-label">Weekly Suggested</div>
          <div class="inst-amt-val" style="color:var(--text2)">${formatMoney(inst.weeklySuggested)}</div>
        </div>
        <div>
          <div class="inst-amt-label">Progress</div>
          <div class="inst-amt-val">${pct.toFixed(0)}%</div>
        </div>
      </div>
      <div class="inst-progress-bar">
        <div class="inst-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="inst-actions">
        ${!done ? `<button class="btn btn-sm inst-pay-btn" data-id="${inst.id}" style="background:#00F5C422;color:var(--accent);border:1px solid #00F5C433;gap:5px">${iconPay} Pay</button>` : ''}
        <button class="btn btn-icon btn-sm inst-del-btn" data-id="${inst.id}" data-name="${escapeHtml(inst.name)}" style="color:var(--danger)">${iconDel}</button>
      </div>
    </div>`;
  }).join('');
}

// ── Pay modal ─────────────────────────────────────────────────
async function openInstPayModal(instId) {
  const inst    = (await getInstallments()).find(i => i.id === instId);
  const wallets = await getWallets();
  if (!inst) return;

  document.getElementById('inst-pay-id').value    = instId;
  document.getElementById('inst-pay-amount').value = inst.weeklySuggested;

  document.getElementById('inst-pay-info').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:700;font-size:0.95rem">${escapeHtml(inst.name)}</div>
        <div style="font-size:0.78rem;color:var(--text2);margin-top:2px">Remaining: ${formatMoney(inst.total - inst.paidAmount)}</div>
      </div>
      <div style="font-size:0.78rem;color:var(--text3)">Weekly: ${formatMoney(inst.weeklySuggested)}</div>
    </div>`;

  const sel = document.getElementById('inst-pay-wallet');
  sel.innerHTML = wallets.length
    ? wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)} — ${formatMoney(w.balance)}</option>`).join('')
    : '<option value="">No wallets</option>';

  updateInstWalletInfo();
  sel.onchange = updateInstWalletInfo;

  openModal('inst-pay-modal');
  setTimeout(() => document.getElementById('inst-pay-amount').focus(), 120);
}

function updateInstWalletInfo() {
  const walletId = document.getElementById('inst-pay-wallet').value;
  getWallet(walletId).then(w => {
    const el = document.getElementById('inst-pay-bal');
    if (el) el.textContent = w ? `Balance: ${formatMoney(w.balance)}` : '';
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupModalClose('inst-pay-modal');
  setupModalClose('inst-add-modal');

  // Add installment form
  // PATCH: mark form as __instBound so the inline fallback in budget.html does NOT double-bind
  const addForm = document.getElementById('add-inst-form');
  if (addForm) {
    addForm.__bound = true;  // ← prevents inline fallback from rebinding
    addForm.addEventListener('submit', async e => {
      e.preventDefault();
      const nameEl = document.getElementById('inst-name');
      const moAmt  = document.getElementById('inst-monthly-amt');
      const mos    = document.getElementById('inst-months');

      if (!nameEl.value.trim()) { nameEl.classList.add('error'); nameEl.addEventListener('input', () => nameEl.classList.remove('error'), {once:true}); return; }
      if (!moAmt.value || Number(moAmt.value) <= 0) { moAmt.classList.add('error'); moAmt.addEventListener('input', () => moAmt.classList.remove('error'), {once:true}); return; }

      // PATCH: pass wantId if present (set by wants → PayLater flow)
      const wantId = addForm.dataset.wantId || undefined;
      const weeklyStartEl = document.getElementById('inst-weekly-start');
      const weeklyStartDate = weeklyStartEl ? weeklyStartEl.value || null : null;
      await addInstallment({
        name: nameEl.value,
        monthlyAmount: moAmt.value,
        months: mos.value || 1,
        wantId,
        weeklyStartDate
      });
      // Clean up wantId after use
      delete addForm.dataset.wantId;

      showToast('Installment added!', 'success');
      closeModal('inst-add-modal');
      addForm.reset();
      const wsEl = document.getElementById('inst-weekly-start');
      if (wsEl) wsEl.value = '';
      await renderInstallments();
    });

    // Auto-compute total preview
    ['inst-monthly-amt', 'inst-months'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        const mo  = parseFloat(document.getElementById('inst-monthly-amt').value) || 0;
        const mos = parseFloat(document.getElementById('inst-months').value) || 1;
        const totalEl = document.getElementById('inst-total-preview');
        if (totalEl) totalEl.innerHTML = `Total: ${formatMoney(mo * mos)} &bull; Weekly: ${formatMoney(mo / 4)}`;
      });
    });
  }

    // Pay form
  const payForm = document.getElementById('inst-pay-form');
  if (payForm) {
    payForm.addEventListener('submit', async e => {
      e.preventDefault();
      const instId   = document.getElementById('inst-pay-id').value;
      const walletId = document.getElementById('inst-pay-wallet').value;
      const amount   = parseFloat(document.getElementById('inst-pay-amount').value);

      if (!walletId) { showToast('Select a wallet', 'error'); return; }
      if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

      const result = await payInstallment(instId, amount, walletId);
      if (result.error) { showToast(result.error, 'error'); return; }

      if (result.completed) {
        showToast(`"${result.inst.name}" fully paid! 🎉`, 'success');
      } else {
        showToast(`Payment recorded — ${formatMoney(result.amount)} deducted 💳`, 'success');
      }
      closeModal('inst-pay-modal');
      await renderInstallments();
    });
  }

  // Event delegation on list
  const instList = document.getElementById('inst-list');
  if (instList) {
    // Inline date change handler
    instList.addEventListener('change', async e => {
      const dateInput = e.target.closest('.inst-date-inline');
      if (!dateInput) return;
      const instId  = dateInput.dataset.id;
      const dateVal = dateInput.value || null;
      await updateInstallmentStartDate(instId, dateVal);
      showToast(dateVal ? '📅 Weekly start date saved!' : 'Date cleared', 'success');
      await renderInstallments();
    });

    instList.addEventListener('click', async e => {
      const payBtn = e.target.closest('.inst-pay-btn');
      const delBtn = e.target.closest('.inst-del-btn');

      if (payBtn) await openInstPayModal(payBtn.dataset.id);

      if (delBtn) {
        showConfirm(`Delete "${delBtn.dataset.name}" installment?`, 'Delete Installment').then(async ok => {
          if (!ok) return;
          await deleteInstallment(delBtn.dataset.id);
          showToast('Installment deleted', 'success');
          await renderInstallments();
        });
      }
    });
  }
});

// Called by auth.js after login
window._renderInstallments = renderInstallments;