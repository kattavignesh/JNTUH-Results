// Function to fetch results from backend
async function fetchResults(rollNo) {
    const response = await fetch('/fetchResults', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rollNo })
    });
    return response.json();
}

// Function to render results in the table
function renderResults(data) {
    const resultsTable = document.getElementById("results_table");
    const tbody = resultsTable.getElementsByTagName('tbody')[0];

    // Clear previous results
    tbody.innerHTML = '';

    

    for (const semester in data) {
        for (const courseId in data[semester]) {
            for (const subjectId in data[semester][courseId]) {
                const subject = data[semester][courseId][subjectId];
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${subject.subject_code}</td>
                    <td>${subject.subject_name}</td>
                    <td>${subject.subject_internal}</td>
                    <td>${subject.subject_external}</td>
                    <td>${subject.subject_total}</td>
                    <td>${subject.subject_grade}</td>
                    <td>${subject.subject_credits}</td>
                `;
                tbody.appendChild(row);
            }
        }
    }
    resultsTable.style.display = 'table';
}

// Event listener for form submission
document.getElementById('resultsForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    const rollNo = document.getElementById('rollNo').value;

    try {
        const data = await fetchResults(rollNo);
        renderResults(data);
    } catch (error) {
        document.getElementById('error').textContent = 'Error fetching the academic result data. Please try again.';
        document.getElementById('error').style.display = 'block';
        console.error('Error fetching the academic result data:', error);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
});
