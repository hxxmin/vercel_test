const SHEET_ID = '1deEPZBc5Hl5zGZllZ6gSIjwYhmH_WpSxciyh9X0g9nA';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

const CATEGORY_COLORS = {
  exam: { color: '#e03131', bg: '#fff5f5', label: '시험·성적' },
  apply: { color: '#3b5bdb', bg: '#edf2ff', label: '신청·등록' },
  break: { color: '#12b886', bg: '#e6fcf5', label: '방학·휴학' },
  return: { color: '#7950f2', bg: '#f3f0ff', label: '복학·수강' },
  other: { color: '#f59f00', bg: '#fff9db', label: '기타' },
};

const FALLBACK_EVENTS = [
  { start: '2026-06-09', end: '2026-06-15', title: '기말고사' },
  { start: '2026-06-16', end: '2026-06-22', title: '보강기간' },
  { start: '2026-06-22', end: '2026-07-03', title: '재입학 신청기간' },
  { start: '2026-06-23', end: '2026-07-06', title: '하계 계절학기' },
  { start: '2026-06-23', end: '2026-08-31', title: '미등록 휴학기간' },
  { start: '2026-06-23', end: '2026-06-23', title: '하계방학' },
  { start: '2026-06-25', end: '2026-06-30', title: '성적공시 및 정정' },
  { start: '2026-07-13', end: '2026-08-31', title: '휴학연기 신청기간' },
  { start: '2026-07-13', end: '2026-07-17', title: '복학기간' },
  { start: '2026-07-29', end: '2026-07-31', title: '예비수강 신청기간' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

let events = [];
let currentFilter = 'all';
let searchQuery = '';
let calYear = 2026;
let calMonth = 6;
let selectedDay = null;

const today = startOfDay(new Date());

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(d) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000) + 1;
}

function getCategory(title) {
  if (/고사|성적/.test(title)) return 'exam';
  if (/신청|등록|수강/.test(title)) return 'apply';
  if (/방학|휴학/.test(title)) return 'break';
  if (/복학|보강|계절/.test(title)) return 'return';
  return 'other';
}

function getStatus(event) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  if (today >= start && today <= end) return 'ongoing';
  if (today < start) return 'upcoming';
  return 'past';
}

function enrichEvent(raw, index) {
  const start = parseDate(raw.start);
  const end = parseDate(raw.end);
  const cat = getCategory(raw.title);
  const status = getStatus(raw);
  const duration = daysBetween(start, end);
  const daysLeft = status === 'ongoing' ? daysBetween(today, end) : status === 'upcoming' ? daysBetween(today, start) - 1 : 0;

  return {
    ...raw,
    id: index,
    startDate: start,
    endDate: end,
    category: cat,
    color: CATEGORY_COLORS[cat].color,
    status,
    duration,
    daysLeft,
  };
}

function cellToDateStr(cell) {
  if (!cell) return null;
  if (cell.f) return cell.f.replace(/\./g, '-').slice(0, 10);
  const val = cell.v;
  if (typeof val === 'string') {
    const dateMatch = val.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (dateMatch) {
      return formatDate(new Date(+dateMatch[1], +dateMatch[2], +dateMatch[3]));
    }
    return val.slice(0, 10);
  }
  return formatDate(new Date(val));
}

async function fetchEvents() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows.slice(1);
    const parsed = rows
      .map((row) => {
        const cells = row.c;
        if (!cells?.[0] || !cells?.[1] || !cells?.[2]?.v) return null;
        const start = cellToDateStr(cells[0]);
        const end = cellToDateStr(cells[1]);
        const title = String(cells[2].v).trim();
        if (!start || !end || !title) return null;
        return { start, end, title };
      })
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  } catch (_) {
    /* fallback */
  }
  return FALLBACK_EVENTS;
}

function eventsOnDate(dateStr) {
  const d = parseDate(dateStr);
  return events.filter((e) => d >= e.startDate && d <= e.endDate);
}

function renderHeader() {
  document.getElementById('todayDate').textContent = formatDisplay(today);
  document.getElementById('todayWeekday').textContent = `${WEEKDAYS[today.getDay()]}요일`;
}

function renderStats() {
  const ongoing = events.filter((e) => e.status === 'ongoing');
  const upcoming = events.filter((e) => e.status === 'upcoming');
  const past = events.filter((e) => e.status === 'past');

  document.getElementById('statTotal').textContent = events.length;
  document.getElementById('statOngoing').textContent = ongoing.length;
  document.getElementById('statUpcoming').textContent = upcoming.length;
  document.getElementById('statPast').textContent = past.length;
}

function renderHighlightCard(event, type) {
  const isNow = type === 'now';
  const badgeClass = isNow ? 'badge-now' : 'badge-soon';
  const badgeText = isNow ? '진행 중' : `D-${event.daysLeft}`;
  const dateRange = event.start === event.end
    ? formatDisplay(event.startDate)
    : `${formatDisplay(event.startDate)} ~ ${formatDisplay(event.endDate)}`;

  return `
    <div class="highlight-card ${isNow ? 'highlight-card--now' : ''}" data-id="${event.id}">
      <div class="highlight-dot" style="background:${event.color}"></div>
      <div class="highlight-content">
        <div class="highlight-title">${event.title}</div>
        <div class="highlight-meta">${dateRange} · ${event.duration}일</div>
        <span class="highlight-badge ${badgeClass}">${badgeText}</span>
      </div>
    </div>`;
}

function renderHighlights() {
  const ongoing = events.filter((e) => e.status === 'ongoing');
  const upcoming = events
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, 3);

  const nowEl = document.getElementById('nowList');
  const soonEl = document.getElementById('soonList');

  nowEl.innerHTML = ongoing.length
    ? ongoing.map((e) => renderHighlightCard(e, 'now')).join('')
    : '<div class="empty-state">현재 진행 중인 일정이 없습니다</div>';

  soonEl.innerHTML = upcoming.length
    ? upcoming.map((e) => renderHighlightCard(e, 'soon')).join('')
    : '<div class="empty-state">예정된 일정이 없습니다</div>';
}

function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  label.textContent = `${calYear}년 ${MONTHS[calMonth]}`;

  const grid = document.getElementById('calGrid');
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  let html = WEEKDAYS.map((d, i) => {
    const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
    return `<div class="cal-weekday ${cls}">${d}</div>`;
  }).join('');

  for (let i = 0; i < startPad; i++) {
    html += '<div class="cal-day cal-day--empty"></div>';
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(calYear, calMonth, day);
    const dateStr = formatDate(date);
    const dayEvents = eventsOnDate(dateStr);
    const dow = date.getDay();
    const isToday = dateStr === formatDate(today);
    const isSelected = selectedDay === dateStr;

    let cls = 'cal-day';
    if (dayEvents.length) cls += ' cal-day--has-event';
    if (isToday) cls += ' cal-day--today';
    if (dow === 0) cls += ' cal-day--sun';
    if (dow === 6) cls += ' cal-day--sat';
    if (isSelected) cls += ' cal-day--selected';

    const dots = dayEvents.slice(0, 4).map((e) =>
      `<span class="cal-dot" style="background:${e.color}"></span>`
    ).join('');

    html += `
      <div class="${cls}" data-date="${dateStr}" title="${dayEvents.map((e) => e.title).join(', ')}">
        <span class="cal-day-num">${day}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day--has-event').forEach((el) => {
    el.addEventListener('click', () => {
      selectedDay = el.dataset.date;
      renderCalendar();
      renderDayDetail(selectedDay);
    });
    el.addEventListener('mouseenter', (e) => showTooltip(e, el.dataset.date));
    el.addEventListener('mouseleave', hideTooltip);
  });
}

function renderDayDetail(dateStr) {
  const panel = document.getElementById('dayDetail');
  const dayEvents = eventsOnDate(dateStr);
  const d = parseDate(dateStr);

  if (!dayEvents.length) {
    panel.innerHTML = `<div class="empty-state">${formatDisplay(d)}에 일정이 없습니다</div>`;
    return;
  }

  panel.innerHTML = `
    <div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:12px;font-weight:600">
      ${formatDisplay(d)} (${WEEKDAYS[d.getDay()]}요일)
    </div>
    ${dayEvents.map((e) => `
      <div class="highlight-card" style="margin-bottom:8px">
        <div class="highlight-dot" style="background:${e.color}"></div>
        <div class="highlight-content">
          <div class="highlight-title">${e.title}</div>
          <div class="highlight-meta">${formatDisplay(e.startDate)} ~ ${formatDisplay(e.endDate)}</div>
        </div>
      </div>`).join('')}`;
}

function renderTimeline() {
  if (!events.length) return;

  const minDate = new Date(Math.min(...events.map((e) => e.startDate)));
  const maxDate = new Date(Math.max(...events.map((e) => e.endDate)));
  const rangeStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const rangeEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
  const totalMs = rangeEnd - rangeStart;

  const months = [];
  let cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    months.push({ label: MONTHS[cur.getMonth()], year: cur.getFullYear() });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const axisHtml = months.map((m) =>
    `<div class="timeline-month">${m.year !== 2026 || m.label !== '6월' ? '' : ''}${m.label}</div>`
  ).join('');

  document.getElementById('timelineAxis').innerHTML = axisHtml;

  const todayPct = ((today - rangeStart) / totalMs) * 100;
  const showToday = today >= rangeStart && today <= rangeEnd;

  const rowsHtml = events.map((e) => {
    const left = ((e.startDate - rangeStart) / totalMs) * 100;
    const width = ((e.endDate - e.startDate) / totalMs) * 100 + (86400000 / totalMs) * 100;
    return `
      <div class="timeline-row">
        <div class="timeline-label" title="${e.title}">${e.title}</div>
        <div class="timeline-track">
          ${showToday ? `<div class="timeline-today" style="left:${todayPct}%"></div>` : ''}
          <div class="timeline-bar" style="left:${left}%;width:${Math.max(width, 0.5)}%;background:${e.color}"
               title="${e.title}: ${formatDisplay(e.startDate)} ~ ${formatDisplay(e.endDate)}"></div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('timelineRows').innerHTML = rowsHtml;
}

function getFilteredEvents() {
  let list = [...events];
  if (currentFilter !== 'all') {
    list = list.filter((e) => e.status === currentFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter((e) => e.title.toLowerCase().includes(q));
  }
  return list.sort((a, b) => a.startDate - b.startDate);
}

function statusLabel(status) {
  return { ongoing: '진행 중', upcoming: '예정', past: '종료' }[status];
}

function renderTable() {
  const filtered = getFilteredEvents();
  const tbody = document.getElementById('scheduleBody');

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">일정이 없습니다</td></tr>`;
    return;
  }

  const maxDuration = Math.max(...events.map((e) => e.duration));

  tbody.innerHTML = filtered.map((e) => {
    const pct = (e.duration / maxDuration) * 100;
    const dateRange = e.start === e.end
      ? formatDisplay(e.startDate)
      : `${formatDisplay(e.startDate)} ~ ${formatDisplay(e.endDate)}`;

    return `
      <tr class="${e.status === 'ongoing' ? 'row-now' : ''}">
        <td>
          <span class="event-tag">
            <span class="event-color" style="background:${e.color}"></span>
            ${e.title}
          </span>
        </td>
        <td>${dateRange}</td>
        <td>${e.duration}일</td>
        <td>
          <div class="duration-bar-wrap" title="${e.duration}일">
            <div class="duration-bar" style="width:${pct}%;background:${e.color}"></div>
          </div>
        </td>
        <td><span class="status-pill status-${e.status}">${statusLabel(e.status)}</span></td>
      </tr>`;
  }).join('');
}

function showTooltip(e, dateStr) {
  const tooltip = document.getElementById('dayTooltip');
  const dayEvents = eventsOnDate(dateStr);
  if (!dayEvents.length) return;

  const d = parseDate(dateStr);
  tooltip.innerHTML = `
    <div class="day-tooltip-title">${formatDisplay(d)} (${WEEKDAYS[d.getDay()]})</div>
    ${dayEvents.map((ev) => `
      <div class="day-tooltip-item">
        <span class="event-color" style="background:${ev.color};margin-top:5px"></span>
        <span>${ev.title}</span>
      </div>`).join('')}`;

  tooltip.classList.add('visible');
  const x = Math.min(e.clientX + 12, window.innerWidth - 300);
  const y = Math.min(e.clientY + 12, window.innerHeight - 120);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip() {
  document.getElementById('dayTooltip').classList.remove('visible');
}

function renderAll() {
  renderHeader();
  renderStats();
  renderHighlights();
  renderCalendar();
  renderTimeline();
  renderTable();
  if (selectedDay) renderDayDetail(selectedDay);
}

function setupEvents() {
  document.getElementById('calPrev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTable();
  });
}

async function init() {
  const overlay = document.getElementById('loading');
  calMonth = today.getMonth();
  calYear = today.getFullYear();
  selectedDay = formatDate(today);

  try {
    const raw = await fetchEvents();
    events = raw.map(enrichEvent);
  } catch {
    events = FALLBACK_EVENTS.map(enrichEvent);
  }

  setupEvents();
  renderAll();
  renderDayDetail(selectedDay);

  setTimeout(() => overlay.classList.add('hidden'), 400);
}

init();
