document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('resultsForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        document.getElementById('results').style.display = 'none'; // Hide results container initially

        const rollNo = document.getElementById('rollNo').value;

        try {
            const response = await fetch(`/api/results?rollNo=${encodeURIComponent(rollNo)}`, {
                method: 'GET', // Use GET if the API is expecting a GET request
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            renderStudentDetails(data);
            renderResults(data);
            document.getElementById('results').style.display = 'block'; // Show results container
        } catch (error) {
            document.getElementById('error').textContent = `Error fetching the academic result data: ${error.message}`;
            document.getElementById('error').style.display = 'block';
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    });
});

function renderStudentDetails(data) {
    const details = data['data']['Details'] || {};
    const detailsDiv = document.getElementById('studentDetails');
    detailsDiv.innerHTML = `
        <p><strong>Name:</strong> ${details.NAME || 'N/A'}</p>
        <p><strong>Roll Number:</strong> ${details.Roll_No || 'N/A'}</p>
        <p><strong>College Code:</strong> ${details.COLLEGE_CODE || 'N/A'}</p>
        <p><strong>Father's Name:</strong> ${details.FATHER_NAME || 'N/A'}</p>
    `;
}

function renderResults(data) {
    const resultsTable = document.getElementById("results_table");
    const tbody = resultsTable.getElementsByTagName('tbody')[0];
    
    tbody.innerHTML = '';

    const results = data['data']['Results'] || {};
    
    for (const semester in results) {
        const courses = results[semester];

        for (const courseId in courses) {
            const subjectsArray = courses[courseId];

            if (Array.isArray(subjectsArray)) {
                subjectsArray.forEach(subjectObj => {
                    for (const subjectKey in subjectObj) {
                        const subject = subjectObj[subjectKey];
                        const row = document.createElement("tr");
                        row.innerHTML = `
                            <td>${subject.subject_code || 'N/A'}</td>
                            <td>${subject.subject_name || 'N/A'}</td>
                            <td>${subject.subject_internal || 'N/A'}</td>
                            <td>${subject.subject_external || 'N/A'}</td>
                            <td>${subject.subject_total || 'N/A'}</td>
                            <td>${subject.subject_grade || 'N/A'}</td>
                            <td>${subject.subject_credits || 'N/A'}</td>
                        `;
                        tbody.appendChild(row);
                    }
                });
            }
        }
    }

    resultsTable.style.display = 'table';
}
