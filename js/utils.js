// js/utils.js — Formatting and date utilities

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekRange(referenceISO) {
  const ref = new Date(referenceISO + 'T00:00:00');
  const dow = ref.getDay(); // 0=Sun
  const diffToMon = (dow === 0) ? -6 : 1 - dow;
  const mon = new Date(ref);
  mon.setDate(ref.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: mon.toISOString().slice(0, 10),
    end: sun.toISOString().slice(0, 10)
  };
}

function isInRange(dateISO, startISO, endISO) {
  return dateISO >= startISO && dateISO <= endISO;
}

function getMonthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getThisWeekRange() {
  return getWeekRange(todayISO());
}

function getThisMonthRange() {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth() + 1);
}
