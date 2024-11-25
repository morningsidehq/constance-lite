// Initialize Supabase client with public key (not anon key)
const supabaseClient = supabase.createClient(
    'https://apzyykplpafkatrlsklz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwenl5a3BscGFma2F0cmxza2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0NDIwNDMsImV4cCI6MjA0NTAxODA0M30.9SO4NP8G_Lh64Y54bgmHN0GSARaLGIO3beV7FmZidug'
);

window.data = [];
let currentPage = 1;
const rowsPerPage = 25;
const hiddenColumns = ['company_name', 'street_address', 'city', 'state', 'country', 'zip', 'attachments', 'client_type', 'email', 'phone'];
let sortDirection = 'desc';
let currentSortColumn = 'open_balance';
let session = null;

// Add authentication handling
document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data: { session: newSession }, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert('Login failed: ' + error.message);
        return;
    }

    session = newSession;
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    loadData();
    document.getElementById('logoutContainer').style.display = 'block';
});

async function loadData() {
    try {
        // Get the most recent date's data from foundry_lite table
        const { data: foundryData, error } = await supabaseClient
            .from('foundry_lite')
            .select('feed, date')
            .order('date', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (foundryData && foundryData.length > 0) {
            // Parse the JSONB feed column
            window.data = foundryData[0].feed;
            renderTable();
            updatePagination();
        }
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data. Please try again.');
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    if (dateString === 'Never') return dateString;
    return new Date(dateString).toLocaleDateString('en-US');
}

// Add this helper function
function isDateOver90Days(dateString) {
    if (dateString === 'Never') return true;
    const date = new Date(dateString);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return date < ninetyDaysAgo;
}

function renderTable(filteredData = window.data) {
    const table = document.getElementById('dataTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (filteredData.length > 0) {
        const headerRow = document.createElement('tr');
        
        // Add all regular columns
        Object.keys(filteredData[0]).forEach(key => {
            if (!hiddenColumns.includes(key)) {
                const th = document.createElement('th');
                th.textContent = key.replace(/_/g, ' ').toUpperCase();
                
                if (['open_balance', 'total_payments', 'most_recent_date', 'last_payment_amount'].includes(key)) {
                    const sortButton = document.createElement('button');
                    sortButton.className = 'btn btn-link p-0';
                    sortButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-sm icon-thick">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M6 15l6 -6l6 6" />
                        </svg>
                    `;
                    sortButton.addEventListener('click', () => sortData(key));
                    th.appendChild(sortButton);
                }
                headerRow.appendChild(th);
            }
        });

        // Add the Contacts column header
        const contactsHeader = document.createElement('th');
        contactsHeader.textContent = 'CONTACTS';
        headerRow.appendChild(contactsHeader);

        thead.appendChild(headerRow);
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    pageData.forEach(item => {
        const row = document.createElement('tr');
        if (item.isGrouped) {
            row.classList.add('grouped-row');
        }
        
        // Add all regular columns
        Object.entries(item).forEach(([key, value]) => {
            if (!hiddenColumns.includes(key) && key !== 'isGrouped' && key !== 'groupCount' && key !== '_groupedItems') {
                const td = document.createElement('td');
                if (key === 'open_balance' || key === 'total_payments' || key === 'last_payment_amount') {
                    td.textContent = formatCurrency(value || 0);
                }
                else if (key === 'most_recent_date') {
                    const formattedDate = formatDate(value);
                    if (isDateOver90Days(value)) {
                        td.innerHTML = `
                            <div class="d-flex align-items-center">
                                <svg class="me-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-exclamation-circle">
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                    <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                                    <path d="M12 9v4" />
                                    <path d="M12 16v.01" />
                                </svg>
                                ${formattedDate}
                            </div>
                        `;
                    } else {
                        td.textContent = formattedDate;
                    }
                }
                else if (key === 'name' && item.isGrouped) {
                    td.innerHTML = `${value} (${item.groupCount})`;
                }
                else {
                    td.textContent = value !== null ? value : '';
                }
                row.appendChild(td);
            }
        });

        // Add the contacts column
        const contactsTd = document.createElement('td');
        const email = item.email || '';
        const phone = item.phone || '';
        
        contactsTd.innerHTML = `
            <div class="d-flex flex-column">
                ${email ? `<div>${email}</div>` : ''}
                ${phone ? `<div>${phone}</div>` : ''}
            </div>
        `;
        row.appendChild(contactsTd);

        tbody.appendChild(row);

        // If this is a grouped row, add the expandable details
        if (item.isGrouped && item._groupedItems) {
            const detailsRow = createExpandableRow(item._groupedItems, row);
            tbody.appendChild(detailsRow);
            addRowClickHandler(row, item._groupedItems);
        }
    });
}

function sortData(column) {
    currentSortColumn = column;
    
    window.data.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        if (valueA === null) valueA = column === 'most_recent_date' ? '1900-01-01' : 0;
        if (valueB === null) valueB = column === 'most_recent_date' ? '1900-01-01' : 0;

        if (column === 'most_recent_date') {
            valueA = valueA === 'Never' ? '1900-01-01' : valueA;
            valueB = valueB === 'Never' ? '1900-01-01' : valueB;
            valueA = new Date(valueA).getTime();
            valueB = new Date(valueB).getTime();
        }

        const sortMultiplier = sortDirection === 'asc' ? 1 : -1;
        return (valueA - valueB) * sortMultiplier;
    });

    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    
    renderTable();
    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(window.data.length / rowsPerPage);
    const controls = document.querySelectorAll('.pagination-controls');
    controls.forEach(control => {
        control.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <button id="prevPage" class="btn btn-primary">Previous</button>
                <div class="d-flex align-items-center">
                    <span class="me-2">Page</span>
                    <input type="number" id="pageInput" class="form-control" style="width: 70px;" min="1" max="${totalPages}" value="${currentPage}">
                    <span class="ms-2">of ${totalPages}</span>
                    <span class="ms-4">Total records: ${window.data.length}</span>
                </div>
                <button id="nextPage" class="btn btn-primary">Next</button>
            </div>
        `;
    });

    document.querySelectorAll('#prevPage').forEach(btn => {
        btn.disabled = currentPage === 1;
        btn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
                updatePagination();
            }
        });
    });

    document.querySelectorAll('#nextPage').forEach(btn => {
        btn.disabled = currentPage === totalPages;
        btn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
                updatePagination();
            }
        });
    });

    document.querySelectorAll('#pageInput').forEach(input => {
        input.addEventListener('change', (e) => {
            const newPage = parseInt(e.target.value);
            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                renderTable();
                updatePagination();
            }
        });
    });
}
function search() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filteredData = window.data.filter(item => 
        Object.entries(item).some(([key, value]) => 
            !hiddenColumns.includes(key) && value !== null && value.toString().toLowerCase().includes(searchTerm)
        )
    );
    currentPage = 1;
    renderTable(filteredData);
    updatePagination();
}

function downloadCSV() {
    const csvContent = [];
    const headers = Object.keys(window.data[0]).filter(key => !hiddenColumns.includes(key));
    csvContent.push(headers.join(','));

    window.data.forEach(item => {
        const row = headers.map(header => item[header] !== null ? item[header] : '').join(',');
        csvContent.push(row);
    });

    const csvBlob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = csvUrl;
    a.download = 'combined-balance-payments.csv';
    a.click();
    URL.revokeObjectURL(csvUrl);
}

document.getElementById('searchInput').addEventListener('input', search);
document.getElementById('downloadCsv').addEventListener('click', downloadCSV);

async function checkSession() {
    try {
        const { data: { session: currentSession }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        
        if (currentSession) {
            // User is logged in
            session = currentSession;
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            document.getElementById('logoutContainer').style.display = 'block';  
            document.getElementById('navbar-menu').style.display = 'block'; 
            loadData();
        } else {
            // No active session, show login form
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('mainContent').style.display = 'none';
            document.getElementById('logoutContainer').style.display = 'none';
            document.getElementById('navbar-menu').style.display = 'none'; 
        }
    } catch (error) {
        console.error('Error checking session:', error);
        alert('Session check failed');
    }
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
        return;
    }
    
    // Clear session and data
    session = null;
    window.data = [];
    
    // Clear the table
    const table = document.getElementById('dataTable');
    if (table) {
        table.querySelector('thead').innerHTML = '';
        table.querySelector('tbody').innerHTML = '';
    }
    
    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Clear pagination
    const paginationControls = document.querySelectorAll('.pagination-controls');
    paginationControls.forEach(control => {
        control.innerHTML = '';
    });
    
    // Reset page display
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('logoutContainer').style.display = 'none';
}
checkSession();

