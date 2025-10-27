// script.js - Pro UI behaviour: parsing API response, SGPA/CGPA calc, chart, accordion
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resultsForm');
    form.addEventListener('submit', onSubmit);
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

        // Validate structure
        if (!data || !data.details || !Array.isArray(data.results)) {
            // Some APIs wrap in data.data
            if (data && data.data && data.data.details && Array.isArray(data.data.results)) {
                renderAll(data.data);
            } else {
                throw new Error('Unexpected API response structure.');
            }
        } else {
            renderAll(data);
        }
    } catch (err) {
        showError(`Error fetching the academic result data: ${err.message}`);
    } finally {
        showLoading(false);
    }
}

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
    const chartCanvas = document.getElementById('sgpaChart');
    if (chartCanvas && chartCanvas._chartInstance) {
        chartCanvas._chartInstance.destroy();
        chartCanvas._chartInstance = null;
    }
}

/**
 * Grade to point mapping
 * O=10, A+=9, A=8, B+=7, B=6, C=5, D=4, F=0
 * (Adjust if your university uses a different scale)
 */
const gradePoints = {
    'O': 10,
    'A+': 9,
    'A': 8,
    'B+': 7,
    'B': 6,
    'C': 5,
    'D': 4,
    'F': 0
};

function renderAll(data) {
    document.getElementById('studentArea').style.display = 'block';
    renderStudentDetails(data.details);
    const semesterSummaries = computeSemesterSgpa(data.results);
    renderSemesters(data.results, semesterSummaries);
    renderSummaryPanel(semesterSummaries);
    drawChart(semesterSummaries);
}

/* Student details */
function renderStudentDetails(d) {
    const div = document.getElementById('studentDetails');
    div.innerHTML = `
        <div>
            <p><strong>${d.name || '—'}</strong></p>
            <p class="muted small">${d.branch || ''} • Roll: ${d.rollNumber || '—'}</p>
        </div>
        <div class="small-note">
            <p><strong>College Code:</strong> ${d.collegeCode || '—'}</p>
            <p><strong>Father's Name:</strong> ${d.fatherName || '—'}</p>
        </div>
    `;
}

/* Compute SGPA per semester and overall CGPA */
function computeSemesterSgpa(resultsArray) {
    // returns array of { semester, totalCredits, earnedPoints, sgpa, backlogsCount }
    const summaries = [];

    resultsArray.forEach(semObj => {
        let totalCredits = 0;
        let totalWeightedPoints = 0;
        let backlogs = 0;

        // Some semesters have multiple exams (reappear etc). Combine all subjects
        const allSubjects = [];
        if (Array.isArray(semObj.exams)) {
            semObj.exams.forEach(exam => {
                if (Array.isArray(exam.subjects)) {
                    exam.subjects.forEach(s => allSubjects.push(s));
                }
            });
        }

        allSubjects.forEach(sub => {
            // credits may be numeric or string
            const credits = Number(sub.credits ?? sub.credits === 0 ? sub.credits : sub.CREDITS || 0);
            const grade = (sub.grades || sub.grade || sub.subject_grade || '').toString().trim();
            const gp = gradePoints[grade] ?? (isNumeric(grade) ? Number(grade) : 0);

            // treat 0 credits (like environmental) as non-contributing to GPA
            if (!isFinite(credits) || credits === 0) {
                if (grade === 'F' || gp === 0) backlogs += (grade === 'F' ? 1 : 0);
                return;
            }

            totalCredits += credits;
            totalWeightedPoints += gp * credits;

            if (grade === 'F' || gp === 0) backlogs++;
        });

        const sgpa = totalCredits > 0 ? roundTo(totalWeightedPoints / totalCredits, 2) : null;

        summaries.push({
            semester: semObj.semester || 'Unknown',
            totalCredits,
            totalWeightedPoints,
            sgpa,
            backlogs
        });
    });

    // calculate CGPA across semesters (weighted)
    let cgpaNumerator = 0;
    let cgpaDenominator = 0;
    summaries.forEach(s => {
        if (s.totalCredits > 0 && s.sgpa !== null) {
            cgpaNumerator += s.sgpa * s.totalCredits;
            cgpaDenominator += s.totalCredits;
        }
    });

    const cgpa = cgpaDenominator > 0 ? roundTo(cgpaNumerator / cgpaDenominator, 2) : null;

    return { perSemester: summaries, cgpa };
}

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
                    <h3>${sem.semester || 'Semester'}</h3>
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

        // toggle
        const header = semCard.querySelector('.sem-header');
        const body = semCard.querySelector('.sem-body');
        header.addEventListener('click', () => {
            body.style.display = body.style.display === 'none' ? 'block' : 'none';
        });
    });
}

function generateSubjectsTableHtml(sem) {
    // Combine all exams' subjects in order
    const rows = [];
    if (Array.isArray(sem.exams)) {
        sem.exams.forEach(exam => {
            if (Array.isArray(exam.subjects)) {
                exam.subjects.forEach(s => {
                    const code = s.subjectCode || s.subject_code || s.subjectCode || '—';
                    const name = s.subjectName || s.subject_name || s.subjectName || '—';
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
        <tr>
            <th>Code</th><th>Subject</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th><th>Credits</th>
        </tr></thead><tbody>`;

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

/* render summary (CGPA, backlog) */
function renderSummaryPanel(summariesObj) {
    const cgpa = summariesObj.cgpa;
    const per = summariesObj.perSemester;

    const totalCredits = per.reduce((acc, s) => acc + (s.totalCredits || 0), 0);
    const totalBacklogs = per.reduce((acc, s) => acc + (s.backlogs || 0), 0);

    document.getElementById('cgpaValue').textContent = cgpa !== null ? cgpa : '—';
    document.getElementById('totalCredits').textContent = `Credits: ${totalCredits}`;
    document.getElementById('backlogCount').textContent = `${totalBacklogs}`;
}

/* Chart drawing using Chart.js */
function drawChart(summariesObj) {
    const per = summariesObj.perSemester;
    const labels = per.map(p => p.semester);
    const data = per.map(p => (p.sgpa !== null ? p.sgpa : 0));

    const ctx = document.getElementById('sgpaChart').getContext('2d');

    // Destroy previous chart if exists
    const canvas = document.getElementById('sgpaChart');
    if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
    }

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
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    suggestedMin: 0,
                    suggestedMax: 10
                }
            }
        }
    });

    // attach instance so we can destroy later
    canvas._chartInstance = chart;
}

/* Utility functions */
function roundTo(num, decimals = 2) {
    return Math.round((num + Number.EPSILON) * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function escapeHtml(t) {
    if (t === null || t === undefined) return '';
    return String(t)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
