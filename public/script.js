// script.js - Pro UI behaviour: parsing API response, SGPA/CGPA calc, chart, accordion & theme toggle

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resultsForm');
  form.addEventListener('submit', onSubmit);

  initTheme(); // apply saved theme
  const themeBtn = document.getElementById('themeToggle');
  themeBtn.addEventListener('click', toggleTheme);
});

async function onSubmit(e) {
  e.preventDefault();
  clearUI();
  const rollNo = document.getElementById('rollNo').value.trim();
  if (!rollNo) return showError('Please enter a roll number.');

  showLoading(true);
  try {
    const resp = await fetch(`/api/results?rollNo=${encodeURIComponent(rollNo)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    // Accept both direct and wrapped responses
    let payload = null;
    if (data && data.details && Array.isArray(data.results)) {
      payload = data;
    } else if (data && data.data && data.data.details && Array.isArray(data.data.results)) {
      payload = data.data;
    } else {
      // try to detect other possible shapes (best-effort)
      if (data && (data.details || data.results)) {
        payload = Object.assign({}, data);
        if (!Array.isArray(payload.results)) payload.results = payload.results || [];
      }
    }

    if (!payload || !payload.details) {
      throw new Error('Unexpected API response structure.');
    }

    renderAll(payload);
  } catch (err) {
    showError(`Error fetching the academic result data: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

/* ---------- UI helpers ---------- */
function showLoading(on) {
  document.getElementById('loading').style.display = on ? 'block' : 'none';
}
function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.style.display = 'block';
}
function clearUI() {
  document.getElementById('error').style.display = 'none';
  document.getElementById('studentArea').style.display = 'none';
  document.getElementById('studentDetails').innerHTML = '';
  document.getElementById('semestersContainer').innerHTML = '';
  document.getElementById('cgpaValue').textContent = '—';
  document.getElementById('backlogCount').textContent = '0';
  document.getElementById('totalCredits').textContent = 'Credits: —';
  const chartCanvas = document.getElementById('sgpaChart');
  if (chartCanvas && chartCanvas._chartInstance) {
    chartCanvas._chartInstance.destroy();
    chartCanvas._chartInstance = null;
  }
}

/* ---------- Grade mapping ---------- */
const gradePoints = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'D': 4, 'F': 0
};

/* ---------- Main render flow ---------- */
function renderAll(data) {
  document.getElementById('studentArea').style.display = 'block';
  renderStudentDetails(data.details);
  const semesterSummaries = computeSemesterSgpa(data.results || []);
  renderSemesters(data.results || [], semesterSummaries);
  renderSummaryPanel(semesterSummaries);
  drawChart(semesterSummaries);
}

function renderStudentDetails(d) {
  const div = document.getElementById('studentDetails');
  div.innerHTML = `
    <div>
      <p><strong>${escapeHtml(d.name || '—')}</strong></p>
      <p class="muted small">${escapeHtml(d.branch || '')} • Roll: ${escapeHtml(d.rollNumber || '—')}</p>
    </div>
    <div class="small-note">
      <p><strong>College Code:</strong> ${escapeHtml(d.collegeCode || '—')}</p>
      <p><strong>Father's Name:</strong> ${escapeHtml(d.fatherName || '—')}</p>
    </div>
  `;
}

/* ---------- SGPA/CGPA calculations ---------- */
function computeSemesterSgpa(resultsArray) {
  const summaries = [];

  resultsArray.forEach(semObj => {
    let totalCredits = 0;
    let totalWeightedPoints = 0;
    let backlogs = 0;
    const allSubjects = [];

    if (Array.isArray(semObj.exams)) {
      semObj.exams.forEach(exam => {
        if (Array.isArray(exam.subjects)) exam.subjects.forEach(s => allSubjects.push(s));
      });
    }

    allSubjects.forEach(sub => {
      const creditsRaw = sub.credits ?? sub.CREDITS ?? sub.subject_credits ?? 0;
      const credits = Number(creditsRaw) || 0;
      const grade = String(sub.grades ?? sub.grade ?? sub.subject_grade ?? '').trim();
      const gp = gradePoints[grade] ?? (isNumeric(grade) ? Number(grade) : 0);

      if (credits === 0) {
        if (grade === 'F') backlogs++;
        return;
      }

      totalCredits += credits;
      totalWeightedPoints += gp * credits;
      if (grade === 'F' || gp === 0) backlogs++;
    });

    const sgpa = totalCredits > 0 ? roundTo(totalWeightedPoints / totalCredits, 2) : null;
    summaries.push({ semester: semObj.semester || 'Unknown', totalCredits, totalWeightedPoints, sgpa, backlogs });
  });

  // CGPA as weighted average of SGPAs by credits
  let cgpaNum = 0, cgpaDen = 0;
  summaries.forEach(s => {
    if (s.totalCredits > 0 && s.sgpa !== null) {
      cgpaNum += s.sgpa * s.totalCredits;
      cgpaDen += s.totalCredits;
    }
  });
  const cgpa = cgpaDen > 0 ? roundTo(cgpaNum / cgpaDen, 2) : null;

  return { perSemester: summaries, cgpa };
}

/* ---------- Render semesters ---------- */
function renderSemesters(resultsArray, summariesObj) {
  const container = document.getElementById('semestersContainer');
  container.innerHTML = '';

  resultsArray.forEach((sem, idx) => {
    const summary = summariesObj.perSemester[idx] || {};
    const semCard = document.createElement('div');
    semCard.className = 'sem-card';

    semCard.innerHTML = `
      <div class="sem-header" data-idx="${idx}">
        <div>
          <h3>${escapeHtml(sem.semester || 'Semester')}</h3>
          <div class="small-note">SGPA: <strong>${summary.sgpa ?? '—'}</strong> • Credits: ${summary.totalCredits}</div>
        </div>
        <div>
          ${summary.backlogs && summary.backlogs > 0 ? `<span class="fail">Backlogs: ${summary.backlogs}</span>` : `<span class="badge">OK</span>`}
        </div>
      </div>
      <div class="sem-body" style="display:none; margin-top:12px;">
        ${generateSubjectsTableHtml(sem)}
      </div>
    `;

    container.appendChild(semCard);

    const header = semCard.querySelector('.sem-header');
    const body = semCard.querySelector('.sem-body');
    header.addEventListener('click', () => {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });
  });
}

function generateSubjectsTableHtml(sem) {
  const rows = [];
  if (Array.isArray(sem.exams)) {
    sem.exams.forEach(exam => {
      if (Array.isArray(exam.subjects)) {
        exam.subjects.forEach(s => {
          const code = s.subjectCode ?? s.subject_code ?? '—';
          const name = s.subjectName ?? s.subject_name ?? '—';
          const internal = s.internalMarks ?? s.subject_internal ?? '—';
          const external = s.externalMarks ?? s.subject_external ?? '—';
          const total = s.totalMarks ?? s.subject_total ?? '—';
          const grade = s.grades ?? s.subject_grade ?? '—';
          const credits = s.credits ?? s.subject_credits ?? 0;
          rows.push({ code, name, internal, external, total, grade, credits });
        });
      }
    });
  }

  if (rows.length === 0) return `<div class="small-note">No subject data available.</div>`;

  let html = `<table class="subjects-table"><thead>
    <tr><th>Code</th><th>Subject</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th><th>Credits</th></tr>
  </thead><tbody>`;

  rows.forEach(r => {
    html += `<tr>
      <td>${escapeHtml(r.code)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.internal)}</td>
      <td>${escapeHtml(r.external)}</td>
      <td>${escapeHtml(r.total)}</td>
      <td>${escapeHtml(r.grade)}</td>
      <td>${escapeHtml(r.credits)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

/* ---------- Summary panel ---------- */
function renderSummaryPanel(summariesObj) {
  const cgpa = summariesObj.cgpa;
  const per = summariesObj.perSemester;
  const totalCredits = per.reduce((acc, s) => acc + (s.totalCredits || 0), 0);
  const totalBacklogs = per.reduce((acc, s) => acc + (s.backlogs || 0), 0);

  document.getElementById('cgpaValue').textContent = cgpa !== null ? cgpa : '—';
  document.getElementById('totalCredits').textContent = `Credits: ${totalCredits}`;
  document.getElementById('backlogCount').textContent = `${totalBacklogs}`;
}

/* ---------- Chart ---------- */
function drawChart(summariesObj) {
  const per = summariesObj.perSemester;
  const labels = per.map(p => p.semester);
  const data = per.map(p => (p.sgpa !== null ? p.sgpa : 0));
  const ctx = document.getElementById('sgpaChart').getContext('2d');

  const canvas = document.getElementById('sgpaChart');
  if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'SGPA',
        data,
        fill: true,
        tension: 0.3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        y: { beginAtZero: false, suggestedMin: 0, suggestedMax: 10 }
      }
    }
  });

  canvas._chartInstance = chart;
}

/* ---------- Utilities ---------- */
function roundTo(num, decimals = 2) {
  return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
function isNumeric(n) { return !isNaN(parseFloat(n)) && isFinite(n); }
function escapeHtml(t) {
  if (t === null || t === undefined) return '';
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- Theme toggle (Light + Dark) ---------- */
function initTheme() {
  const saved = localStorage.getItem('jr_theme') || 'light';
  applyTheme(saved);
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('theme-dark');
    document.getElementById('themeLabel').textContent = 'Light';
    document.getElementById('themeIcon').textContent = '☀️';
    document.getElementById('themeToggle').setAttribute('aria-pressed', 'true');
    localStorage.setItem('jr_theme', 'dark');
  } else {
    root.classList.remove('theme-dark');
    document.getElementById('themeLabel').textContent = 'Dark';
    document.getElementById('themeIcon').textContent = '🌙';
    document.getElementById('themeToggle').setAttribute('aria-pressed', 'false');
    localStorage.setItem('jr_theme', 'light');
  }
}

function toggleTheme() {
  const current = localStorage.getItem('jr_theme') || 'light';
  applyTheme(current === 'light' ? 'dark' : 'light');
}