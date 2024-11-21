const statusSection = document.getElementById('status-section');
const socket = io();

// Mapping of statuses to CSS classes and icons
const statusDetails = {
    'online': {
        class: 'status-online',
        icon: 'images/icons/online.png'
    },
    'offline': {
        class: 'status-offline',
        icon: 'images/icons/offline.png'
    },
    'crashed': {
        class: 'status-crashed',
        icon: 'images/icons/crashed.png'
    },
    'restarting': {
        class: 'status-restarting',
        icon: 'images/icons/restarting.png'
    }
};

let serverStatuses = {};
let uptimeChart = null;

// Fetch statuses every 60 seconds
fetchStatuses();
setInterval(fetchStatuses, 60000);

// Handle real-time updates
socket.on('statusUpdate', (data) => {
    serverStatuses[data.serverId] = data;
    displayStatuses();
});

// Fetch latest statuses from the server
async function fetchStatuses() {
    try {
        const response = await fetch('/api/status/latest');
        const data = await response.json();
        serverStatuses = {};
        data.forEach(status => {
            serverStatuses[status.serverId] = status;
        });
        displayStatuses();
    } catch (error) {
        console.error('Error fetching statuses:', error);
    }
}

// Display server statuses
function displayStatuses() {
    statusSection.innerHTML = ''; // Clear existing content

    Object.values(serverStatuses).forEach(status => {
        const serverCard = document.createElement('div');
        serverCard.classList.add('server-card');

        const statusIcon = document.createElement('img');
        statusIcon.src = statusDetails[status.status]?.icon || '';
        statusIcon.alt = status.status;
        statusIcon.classList.add('status-icon');

        const serverName = document.createElement('h2');
        serverName.textContent = status.serverId;

        const serverStatus = document.createElement('p');
        serverStatus.textContent = `Status: ${status.status}`;
        serverStatus.classList.add(statusDetails[status.status]?.class || '');

        const playerCount = document.createElement('p');
        playerCount.textContent = `Players: ${status.playerCount}/${status.maxPlayers || 'N/A'}`;

        serverCard.appendChild(statusIcon);
        serverCard.appendChild(serverName);
        serverCard.appendChild(serverStatus);
        serverCard.appendChild(playerCount);

        statusSection.appendChild(serverCard);
    });

    populateServerSelect();
}

// Populate server select dropdown
function populateServerSelect() {
    const serverSelect = document.getElementById('server-select');
    serverSelect.innerHTML = ''; // Clear existing options

    Object.keys(serverStatuses).forEach(serverId => {
        const option = document.createElement('option');
        option.value = serverId;
        option.textContent = serverId;
        serverSelect.appendChild(option);
    });
}

// Handle chart loading
document.getElementById('load-chart').addEventListener('click', () => {
    const serverId = document.getElementById('server-select').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!serverId || !startDate || !endDate) {
        alert('Please select a server and specify both start and end dates.');
        return;
    }

    fetchHistoricalData(serverId, startDate, endDate);
});

// Fetch historical data and render chart
async function fetchHistoricalData(serverId, startTime, endTime) {
    try {
        const response = await fetch(`/api/status/history/${serverId}?startTime=${startTime}&endTime=${endTime}`);
        const data = await response.json();

        // Prepare data for Chart.js
        const labels = data.map(entry => new Date(entry.timestamp).toLocaleString());
        const statuses = data.map(entry => {
            switch (entry.status) {
                case 'online':
                    return 1;
                case 'restarting':
                    return 0.5;
                case 'offline':
                case 'crashed':
                default:
                    return 0;
            }
        });

        renderChart(labels, statuses);
    } catch (error) {
        console.error('Error fetching historical data:', error);
    }
}

// Render the uptime chart
function renderChart(labels, dataPoints) {
    const ctx = document.getElementById('uptimeChart').getContext('2d');

    if (uptimeChart) {
        uptimeChart.destroy();
    }

    uptimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Server Uptime',
                data: dataPoints,
                backgroundColor: 'rgba(0, 170, 255, 0.2)',
                borderColor: 'rgba(0, 170, 255, 1)',
                borderWidth: 2,
                pointRadius: 2,
                fill: true,
                stepped: true
            }]
        },
        options: {
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#f5f5f5'
                    },
                    ticks: {
                        color: '#f5f5f5',
                        maxTicksLimit: 10
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Status',
                        color: '#f5f5f5'
                    },
                    ticks: {
                        color: '#f5f5f5',
                        callback: function(value) {
                            switch (value) {
                                case 1:
                                    return 'Online';
                                case 0.5:
                                    return 'Restarting';
                                case 0:
                                    return 'Offline';
                                default:
                                    return '';
                            }
                        },
                        stepSize: 0.5,
                        min: 0,
                        max: 1
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#f5f5f5'
                    }
                }
            }
        }
    });
}
