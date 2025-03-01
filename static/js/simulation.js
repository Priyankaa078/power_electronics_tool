// static/js/simulation.js

// Global variables
let simulationResults = null;
let currentPlot = null;
let circuitId = null;
let chartInstances = {};
let timeStep = 0.0001; // Default time step
let endTime = 0.01; // Default simulation end time
let selectedNodes = [];
let selectedVariables = [];

// Initialize the simulation page
document.addEventListener('DOMContentLoaded', function() {
    // Get circuit ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    circuitId = urlParams.get('circuit_id');
    
    if (circuitId) {
        // Load circuit details
        loadCircuitDetails(circuitId);
    } else {
        showNotification('No circuit specified', 'error');
    }
    
    // Set up event listeners
    setupEventListeners();
});

// Load circuit details
function loadCircuitDetails(id) {
    fetch(`/get_circuit/${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Display circuit name
                document.getElementById('circuit-name').textContent = data.circuit.name;
                
                // Populate node selection dropdown
                populateNodeSelection(data.circuit);
                
                // Show circuit preview
                showCircuitPreview(data.circuit);
            } else {
                showNotification('Error loading circuit: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error loading circuit details', 'error');
        });
}

// Populate node selection dropdown
function populateNodeSelection(circuit) {
    const nodeSelect = document.getElementById('node-selection');
    nodeSelect.innerHTML = '';
    
    // Get unique nodes from the circuit
    const nodes = getCircuitNodes(circuit);
    
    // Add options for each node
    nodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node;
        option.textContent = `Node ${node}`;
        nodeSelect.appendChild(option);
    });
    
    // Add component-specific variables
    const varSelect = document.getElementById('variable-selection');
    varSelect.innerHTML = '';
    
    // Add voltage and current options for components
    Object.values(circuit.components).forEach(component => {
        // Component voltage
        const voltageOption = document.createElement('option');
        voltageOption.value = `${component.id}.v`;
        voltageOption.textContent = `${component.name} Voltage`;
        varSelect.appendChild(voltageOption);
        
        // Component current
        const currentOption = document.createElement('option');
        currentOption.value = `${component.id}.i`;
        currentOption.textContent = `${component.name} Current`;
        varSelect.appendChild(currentOption);
        
        // Add specific variables based on component type
        if (component.type === 'mosfet' || component.type === 'igbt') {
            const gateOption = document.createElement('option');
            gateOption.value = `${component.id}.vgs`;
            gateOption.textContent = `${component.name} Gate Voltage`;
            varSelect.appendChild(gateOption);
        } else if (component.type.includes('converter')) {
            const dutyOption = document.createElement('option');
            dutyOption.value = `${component.id}.duty`;
            dutyOption.textContent = `${component.name} Duty Cycle`;
            varSelect.appendChild(dutyOption);
        }
    });
}

// Get all unique nodes in the circuit
function getCircuitNodes(circuit) {
    const nodes = new Set();
    
    // Add nodes from connections
    circuit.connections.forEach(connection => {
        // For simplicity, using source and target IDs as node names
        // In a real implementation, you would have a proper node identification logic
        nodes.add(connection.sourceId);
        nodes.add(connection.targetId);
    });
    
    return Array.from(nodes);
}

// Show circuit preview
function showCircuitPreview(circuit) {
    const previewContainer = document.getElementById('circuit-preview');
    previewContainer.innerHTML = `<div class="text-center p-3">Circuit: ${circuit.name}</div>`;
    
    // Create a simple component list as preview
    // In a real app, you might want to use a small version of the actual circuit diagram
    if (Object.keys(circuit.components).length > 0) {
        const componentList = document.createElement('ul');
        componentList.className = 'component-list';
        
        Object.values(circuit.components).forEach(component => {
            const item = document.createElement('li');
            item.textContent = `${component.name} (${component.type})`;
            componentList.appendChild(item);
        });
        
        previewContainer.appendChild(componentList);
    } else {
        previewContainer.innerHTML += '<div class="text-center">No components in circuit</div>';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Run simulation button
    document.getElementById('run-simulation-btn').addEventListener('click', runSimulation);
    
    // Add node button
    document.getElementById('add-node-btn').addEventListener('click', function() {
        const nodeSelect = document.getElementById('node-selection');
        const selectedNode = nodeSelect.value;
        
        if (selectedNode && !selectedNodes.includes(selectedNode)) {
            selectedNodes.push(selectedNode);
            updateNodeList();
        }
    });
    
    // Add variable button
    document.getElementById('add-variable-btn').addEventListener('click', function() {
        const varSelect = document.getElementById('variable-selection');
        const selectedVar = varSelect.value;
        
        if (selectedVar && !selectedVariables.includes(selectedVar)) {
            selectedVariables.push(selectedVar);
            updateVariableList();
        }
    });
    
    // Simulation parameters
    document.getElementById('time-step').addEventListener('change', function() {
        timeStep = parseFloat(this.value);
    });
    
    document.getElementById('end-time').addEventListener('change', function() {
        endTime = parseFloat(this.value);
    });
    
    // Plot type selection
    document.querySelectorAll('input[name="plot-type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (simulationResults) {
                updatePlot();
            }
        });
    });
}

// Update node list display
function updateNodeList() {
    const list = document.getElementById('selected-nodes-list');
    list.innerHTML = '';
    
    selectedNodes.forEach((node, index) => {
        const item = document.createElement('div');
        item.className = 'selected-item';
        item.innerHTML = `
            <span>Node ${node}</span>
            <button type="button" class="btn btn-sm btn-danger remove-btn" data-index="${index}" data-type="node">×</button>
        `;
        list.appendChild(item);
    });
    
    // Add remove event listeners
    document.querySelectorAll('#selected-nodes-list .remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            selectedNodes.splice(index, 1);
            updateNodeList();
        });
    });
}

// Update variable list display
function updateVariableList() {
    const list = document.getElementById('selected-variables-list');
    list.innerHTML = '';
    
    selectedVariables.forEach((variable, index) => {
        const item = document.createElement('div');
        item.className = 'selected-item';
        item.innerHTML = `
            <span>${formatVariableName(variable)}</span>
            <button type="button" class="btn btn-sm btn-danger remove-btn" data-index="${index}" data-type="variable">×</button>
        `;
        list.appendChild(item);
    });
    
    // Add remove event listeners
    document.querySelectorAll('#selected-variables-list .remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            selectedVariables.splice(index, 1);
            updateVariableList();
        });
    });
}

// Format variable name for display
function formatVariableName(variable) {
    const parts = variable.split('.');
    if (parts.length === 2) {
        let varType = parts[1];
        if (varType === 'v') varType = 'Voltage';
        else if (varType === 'i') varType = 'Current';
        else if (varType === 'vgs') varType = 'Gate Voltage';
        else if (varType === 'duty') varType = 'Duty Cycle';
        
        return `${parts[0]} ${varType}`;
    }
    return variable;
}

// Run the simulation
function runSimulation() {
    if (!circuitId) {
        showNotification('No circuit loaded', 'error');
        return;
    }
    
    if (selectedNodes.length === 0 && selectedVariables.length === 0) {
        showNotification('Please select at least one node or variable to monitor', 'warning');
        return;
    }
    
    // Show loading state
    document.getElementById('simulation-status').textContent = 'Running simulation...';
    document.getElementById('run-simulation-btn').disabled = true;
    
    // Create simulation parameters
    const params = {
        circuit_id: circuitId,
        nodes: selectedNodes,
        variables: selectedVariables,
        time_step: timeStep,
        end_time: endTime
    };
    
    // Send simulation request
    fetch('/run_simulation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('run-simulation-btn').disabled = false;
        
        if (data.success) {
            simulationResults = data.results;
            document.getElementById('simulation-status').textContent = 'Simulation completed successfully';
            showNotification('Simulation completed successfully', 'success');
            
            // Create plots
            updatePlot();
            enableExport();
        } else {
            document.getElementById('simulation-status').textContent = 'Simulation failed';
            showNotification('Simulation failed: ' + data.message, 'error');
        }
    })
    .catch(error => {
        document.getElementById('run-simulation-btn').disabled = false;
        document.getElementById('simulation-status').textContent = 'Simulation failed';
        console.error('Error:', error);
        showNotification('Error running simulation', 'error');
    });
}

// Update the plot based on current selection
function updatePlot() {
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;
    const resultsContainer = document.getElementById('simulation-results');
    
    // Clear previous plots
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};
    resultsContainer.innerHTML = '';
    
    if (!simulationResults || !simulationResults.time || simulationResults.time.length === 0) {
        resultsContainer.innerHTML = '<div class="text-center p-3">No simulation results available</div>';
        return;
    }
    
    if (plotType === 'time-domain') {
        createTimeDomainPlots(resultsContainer);
    } else if (plotType === 'frequency-domain') {
        createFrequencyDomainPlots(resultsContainer);
    } else if (plotType === 'phase-portrait') {
        createPhasePortraitPlots(resultsContainer);
    }
}

// Create time domain plots
function createTimeDomainPlots(container) {
    const timeData = simulationResults.time;
    
    // Create plot for node voltages
    if (selectedNodes.length > 0 && simulationResults.node_voltages) {
        const nodeVoltageDiv = document.createElement('div');
        nodeVoltageDiv.className = 'plot-container';
        nodeVoltageDiv.innerHTML = '<h5>Node Voltages</h5><canvas id="node-voltage-plot"></canvas>';
        container.appendChild(nodeVoltageDiv);
        
        const datasets = selectedNodes.map(node => {
            // Choose a random color
            const color = getRandomColor();
            
            return {
                label: `Node ${node}`,
                data: simulationResults.node_voltages[node] || [],
                borderColor: color,
                backgroundColor: color + '33', // Add transparency
                borderWidth: 2,
                fill: false,
                tension: 0.1
            };
        });
        
        const ctx = document.getElementById('node-voltage-plot').getContext('2d');
        chartInstances['node-voltage'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeData,
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Node Voltages vs Time'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (s)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Voltage (V)'
                        }
                    }
                }
            }
        });
    }
    
    // Create plots for component variables
    if (selectedVariables.length > 0 && simulationResults.variables) {
        const variableDiv = document.createElement('div');
        variableDiv.className = 'plot-container';
        variableDiv.innerHTML = '<h5>Component Variables</h5><canvas id="component-var-plot"></canvas>';
        container.appendChild(variableDiv);
        
        const datasets = selectedVariables.map(variable => {
            // Choose a random color
            const color = getRandomColor();
            
            return {
                label: formatVariableName(variable),
                data: simulationResults.variables[variable] || [],
                borderColor: color,
                backgroundColor: color + '33', // Add transparency
                borderWidth: 2,
                fill: false,
                tension: 0.1
            };
        });
        
        const ctx = document.getElementById('component-var-plot').getContext('2d');
        chartInstances['component-var'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeData,
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Component Variables vs Time'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (s)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Value'
                        }
                    }
                }
            }
        });
    }
}

// Create frequency domain plots (FFT)
function createFrequencyDomainPlots(container) {
    if (!simulationResults.time || simulationResults.time.length === 0) {
        container.innerHTML = '<div class="text-center p-3">No data available for frequency analysis</div>';
        return;
    }
    
    // Create FFT plot for each selected variable
    const allSelectedVars = [...selectedNodes.map(node => `Node ${node}`), 
                            ...selectedVariables.map(v => formatVariableName(v))];
    
    if (allSelectedVars.length === 0) {
        container.innerHTML = '<div class="text-center p-3">No signals selected for frequency analysis</div>';
        return;
    }
    
    const fftDiv = document.createElement('div');
    fftDiv.className = 'plot-container';
    fftDiv.innerHTML = '<h5>Frequency Spectrum</h5><canvas id="fft-plot"></canvas>';
    container.appendChild(fftDiv);
    
    // Compute sample frequency and prepare FFT data
    const Fs = 1 / (simulationResults.time[1] - simulationResults.time[0]); // Sample frequency
    const datasets = [];
    
    // Process node voltages
    if (simulationResults.node_voltages) {
        selectedNodes.forEach(node => {
            const data = simulationResults.node_voltages[node];
            if (data) {
                const fftResult = computeFFT(data, Fs);
                const color = getRandomColor();
                
                datasets.push({
                    label: `Node ${node}`,
                    data: fftResult.magnitude,
                    borderColor: color,
                    backgroundColor: color + '33',
                    borderWidth: 2,
                    fill: false
                });
            }
        });
    }
    
    // Process component variables
    if (simulationResults.variables) {
        selectedVariables.forEach(variable => {
            const data = simulationResults.variables[variable];
            if (data) {
                const fftResult = computeFFT(data, Fs);
                const color = getRandomColor();
                
                datasets.push({
                    label: formatVariableName(variable),
                    data: fftResult.magnitude,
                    borderColor: color,
                    backgroundColor: color + '33',
                    borderWidth: 2,
                    fill: false
                });
            }
        });
    }
    
    // Create the chart
    if (datasets.length > 0) {
        // Use the first dataset's frequency for X-axis
        const frequencies = datasets[0].data.map((_, i) => i * Fs / (datasets[0].data.length * 2));
        
        const ctx = document.getElementById('fft-plot').getContext('2d');
        chartInstances['fft'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: frequencies,
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Frequency Spectrum'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Frequency (Hz)'
                        },
                        min: 0,
                        max: Fs / 4 // Show only first quarter for better visibility
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Magnitude'
                        },
                        type: 'logarithmic'
                    }
                }
            }
        });
    } else {
        fftDiv.innerHTML = '<div class="text-center p-3">Could not compute frequency spectrum</div>';
    }
}

// Create phase portrait plots
function createPhasePortraitPlots(container) {
    if (selectedVariables.length < 2) {
        container.innerHTML = '<div class="text-center p-3">Select at least two variables for phase portrait</div>';
        return;
    }
    
    const phaseDiv = document.createElement('div');
    phaseDiv.className = 'plot-container';
    phaseDiv.innerHTML = '<h5>Phase Portrait</h5><canvas id="phase-plot"></canvas>';
    container.appendChild(phaseDiv);
    
    // Get data for the first two selected variables
    let xData = [];
    let yData = [];
    let xLabel = '';
    let yLabel = '';
    
    if (selectedVariables.length >= 2 && simulationResults.variables) {
        xData = simulationResults.variables[selectedVariables[0]] || [];
        yData = simulationResults.variables[selectedVariables[1]] || [];
        xLabel = formatVariableName(selectedVariables[0]);
        yLabel = formatVariableName(selectedVariables[1]);
    } else if (selectedNodes.length >= 2 && simulationResults.node_voltages) {
        xData = simulationResults.node_voltages[selectedNodes[0]] || [];
        yData = simulationResults.node_voltages[selectedNodes[1]] || [];
        xLabel = `Node ${selectedNodes[0]}`;
        yLabel = `Node ${selectedNodes[1]}`;
    } else {
        // Mix of nodes and variables
        if (selectedNodes.length > 0 && simulationResults.node_voltages) {
            xData = simulationResults.node_voltages[selectedNodes[0]] || [];
            xLabel = `Node ${selectedNodes[0]}`;
        } else if (selectedVariables.length > 0 && simulationResults.variables) {
            xData = simulationResults.variables[selectedVariables[0]] || [];
            xLabel = formatVariableName(selectedVariables[0]);
        }
        
        if (selectedVariables.length > 0 && simulationResults.variables) {
            yData = simulationResults.variables[selectedVariables[0]] || [];
            yLabel = formatVariableName(selectedVariables[0]);
        } else if (selectedNodes.length > 1 && simulationResults.node_voltages) {
            yData = simulationResults.node_voltages[selectedNodes[1]] || [];
            yLabel = `Node ${selectedNodes[1]}`;
        }
    }
    
    if (xData.length === 0 || yData.length === 0) {
        phaseDiv.innerHTML = '<div class="text-center p-3">No data available for selected variables</div>';
        return;
    }
    
    // Create scatter dataset
    const scatterData = [];
    const minLength = Math.min(xData.length, yData.length);
    
    for (let i = 0; i < minLength; i++) {
        scatterData.push({
            x: xData[i],
            y: yData[i]
        });
    }
    
    const ctx = document.getElementById('phase-plot').getContext('2d');
    chartInstances['phase'] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: `${xLabel} vs ${yLabel}`,
                data: scatterData,
                backgroundColor: 'rgba(13, 110, 253, 0.5)',
                borderColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 1,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Phase Portrait'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yLabel
                    }
                }
            }
        }
    });
}

// Compute FFT of time domain signal
function computeFFT(timeDomainData, sampleFrequency) {
    // In a real application, you would use a proper FFT library
    // For simplicity, we'll use a very basic implementation here
    
    // Make sure we have a power of 2 length for FFT
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(timeDomainData.length)));
    const paddedData = [...timeDomainData];
    
    // Zero padding
    while (paddedData.length < nextPow2) {
        paddedData.push(0);
    }
    
    // Basic single-sided amplitude spectrum calculation
    // In a real app, you would use a proper FFT algorithm
    const N = paddedData.length;
    const magnitude = new Array(Math.floor(N/2) + 1).fill(0);
    
    // Simplified FFT (just for the UI demo)
    // This is NOT a real FFT implementation and should be replaced
    for (let k = 0; k < magnitude.length; k++) {
        let re = 0;
        let im = 0;
        
        for (let n = 0; n < N; n++) {
            const phi = (2 * Math.PI * k * n) / N;
            re += paddedData[n] * Math.cos(phi);
            im -= paddedData[n] * Math.sin(phi);
        }
        
        // Magnitude calculation
        magnitude[k] = Math.sqrt(re*re + im*im) / N;
    }
    
    // Scale first and last point
    magnitude[0] /= 2;
    if (N % 2 === 0) {
        magnitude[magnitude.length - 1] /= 2;
    }
    
    // Double to get single-sided spectrum
    for (let i = 1; i < magnitude.length - 1; i++) {
        magnitude[i] *= 2;
    }
    
    return {
        magnitude,
        frequencies: Array.from({length: magnitude.length}, (_, i) => i * sampleFrequency / N)
    };
}

// Enable export buttons
function enableExport() {
    document.getElementById('export-csv-btn').disabled = false;
    document.getElementById('export-csv-btn').addEventListener('click', exportToCsv);
    
    document.getElementById('export-image-btn').disabled = false;
    document.getElementById('export-image-btn').addEventListener('click', exportToImage);
}

// Export results to CSV
function exportToCsv() {
    if (!simulationResults || !simulationResults.time) {
        showNotification('No simulation results to export', 'warning');
        return;
    }
    
    // Prepare CSV content
    let csvContent = 'Time';
    
    // Add headers for node voltages
    selectedNodes.forEach(node => {
        csvContent += `,Node_${node}`;
    });
    
    // Add headers for variables
    selectedVariables.forEach(variable => {
        csvContent += `,${variable.replace('.', '_')}`;
    });
    
    csvContent += '\n';
    
    // Add data rows
    const timeData = simulationResults.time;
    for (let i = 0; i < timeData.length; i++) {
        csvContent += timeData[i];
        
        // Add node voltage values
        selectedNodes.forEach(node => {
            const values = simulationResults.node_voltages[node] || [];
            csvContent += `,${values[i] || ''}`;
        });
        
        // Add variable values
        selectedVariables.forEach(variable => {
            const values = simulationResults.variables[variable] || [];
            csvContent += `,${values[i] || ''}`;
        });
        
        csvContent += '\n';
    }
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `simulation_results_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export plots to image
function exportToImage() {
    // Get currently visible chart
    const plotType = document.querySelector('input[name="plot-type"]:checked').value;
    let chartId;
    
    if (plotType === 'time-domain') {
        if (chartInstances['node-voltage']) {
            chartId = 'node-voltage-plot';
        } else if (chartInstances['component-var']) {
            chartId = 'component-var-plot';
        }
    } else if (plotType === 'frequency-domain') {
        chartId = 'fft-plot';
    } else if (plotType === 'phase-portrait') {
        chartId = 'phase-plot';
    }
    
    if (!chartId) {
        showNotification('No plot to export', 'warning');
        return;
    }
    
    // Get canvas and create image
    const canvas = document.getElementById(chartId);
    const image = canvas.toDataURL('image/png');
    
    // Download image
    const link = document.createElement('a');
    link.href = image;
    link.download = `${plotType}_plot_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.png`;
    link.click();
}

// Helper: Generate random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Helper: Show notification
function showNotification(message, type) {
    const notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        console.error('Notification container not found');
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}