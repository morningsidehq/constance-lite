let isGrouped = false;

function createExpandableRow(items, mainRow) {
    const detailsDiv = document.createElement('tr');
    detailsDiv.className = 'expandable-details';
    detailsDiv.style.display = 'none';
    
    // Create a td that spans all columns
    const detailsTd = document.createElement('td');
    detailsTd.colSpan = mainRow.cells.length; // Span all columns including contacts
    
    // Create inner table for the details
    const detailsTable = document.createElement('table');
    detailsTable.className = 'table table-sm m-0';
    
    // Add each item as a row in the details table
    items.forEach(item => {
        const itemRow = document.createElement('tr');
        Object.entries(item).forEach(([key, value]) => {
            if (!hiddenColumns.includes(key) && key !== 'isGrouped' && key !== 'groupCount') {
                const td = document.createElement('td');
                if (key === 'open_balance' || key === 'total_payments' || key === 'last_payment_amount') {
                    td.textContent = formatCurrency(value || 0);
                } else if (key === 'most_recent_date') {
                    td.textContent = formatDate(value);
                } else {
                    td.textContent = value || '';
                }
                itemRow.appendChild(td);
            }
        });
        detailsTable.appendChild(itemRow);
    });
    
    detailsTd.appendChild(detailsTable);
    detailsDiv.appendChild(detailsTd);
    
    return detailsDiv;
}

function groupData(dataToGroup) {
    const groupedData = {};
    
    dataToGroup.forEach(item => {
        const name = item.name;
        if (!groupedData[name]) {
            groupedData[name] = [];
        }
        groupedData[name].push(item);
    });

    return Object.entries(groupedData).map(([name, items]) => {
        if (items.length === 1) {
            return items[0];
        }
        
        return {
            name: name,
            job_number: 'MULTIPLE',
            open_balance: items.reduce((sum, item) => sum + (item.open_balance || 0), 0),
            total_payments: items.reduce((sum, item) => sum + (item.total_payments || 0), 0),
            last_payment_amount: items.reduce((sum, item) => sum + (item.last_payment_amount || 0), 0),
            most_recent_date: items.reduce((latest, item) => {
                if (item.most_recent_date === 'Never') return latest;
                if (latest === 'Never') return item.most_recent_date;
                return new Date(item.most_recent_date) > new Date(latest) ? 
                    item.most_recent_date : latest;
            }, 'Never'),
            email: items.map(item => item.email).filter(Boolean).join(', '),
            phone: items.map(item => item.phone).filter(Boolean).join(', '),
            isGrouped: true,
            groupCount: items.length,
            _groupedItems: items
        };
    });
}

// Add click handler for expandable rows
function addRowClickHandler(row, items) {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
        const nextRow = row.nextElementSibling;
        if (nextRow && nextRow.classList.contains('expandable-details')) {
            nextRow.style.display = nextRow.style.display === 'none' ? 'table-row' : 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('toggleGroup').addEventListener('click', () => {
        isGrouped = !isGrouped;
        const button = document.getElementById('toggleGroup');
        button.textContent = isGrouped ? 'Ungroup' : 'Group';
        
        const groupedData = isGrouped ? groupData(window.data) : window.data;
        renderTable(groupedData);
        updatePagination();
    });
}); 