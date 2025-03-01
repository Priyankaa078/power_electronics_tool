// static/js/circuit_editor.js

// Global variables
let jsPlumbInstance;
let currentCircuit = {
    id: generateUUID(),
    name: "Untitled Circuit",
    components: {},
    connections: []
};
let selectedComponent = null;
let nextComponentId = 1;
let componentCounter = {};

// Initialize the editor
document.addEventListener('DOMContentLoaded', function() {
    // Initialize jsPlumb
    jsPlumbInstance = jsPlumb.getInstance({
        Connector: ["Bezier", { curviness: 50 }],
        PaintStyle: { stroke: "#333", strokeWidth: 2 },
        EndpointStyle: { radius: 5, fill: "#333" },
        HoverPaintStyle: { stroke: "#0d6efd", strokeWidth: 3 },
        ConnectionOverlays: [
            ["Arrow", { location: 1, width: 10, length: 10, foldback: 0.7 }]
        ],
        Container: "circuit-canvas"
    });
    
    // Load component palette
    loadComponentPalette();
    
    // Set up event listeners
    setupEventListeners();
    
    // Make the canvas droppable
    makeCanvasDroppable();
});

// Load component palette
function loadComponentPalette() {
    fetch('/get_components')
        .then(response => response.json())
        .then(data => {
            const palette = document.getElementById('component-palette');
            palette.innerHTML = '';
            
            // Create component categories
            for (const category in data) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'component-category';
                categoryDiv.innerHTML = `<h6 class="mt-3">${capitalizeFirstLetter(category)}</h6>`;
                palette.appendChild(categoryDiv);
                
                // Create components in this category
                data[category].forEach(component => {
                    const componentDiv = document.createElement('div');
                    componentDiv.className = 'component';
                    componentDiv.setAttribute('data-component-type', component.type);
                    componentDiv.setAttribute('data-component-params', JSON.stringify(component.params));
                    
                    componentDiv.innerHTML = `
                        <div class="component-icon ${component.type}-icon"></div>
                        <div class="component-name">${component.name}</div>
                    `;
                    
                    // Make the component draggable
                    componentDiv.setAttribute('draggable', 'true');
                    componentDiv.addEventListener('dragstart', onPaletteDragStart);
                    
                    categoryDiv.appendChild(componentDiv);
                });
            }
        })
        .catch(error => {
            console.error('Error loading components:', error);
            document.getElementById('component-palette').innerHTML = 'Error loading components.';
        });
}

// Make the canvas droppable
function makeCanvasDroppable() {
    const canvas = document.getElementById('circuit-canvas');
    
    canvas.addEventListener('dragover', function(event) {
        event.preventDefault();
    });
    
    canvas.addEventListener('drop', function(event) {
        event.preventDefault();
        
        const componentType = event.dataTransfer.getData('component-type');
        const componentParams = JSON.parse(event.dataTransfer.getData('component-params'));
        
        // Calculate position based on drop location
        const canvasRect = canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left - 40; // Center the component
        const y = event.clientY - canvasRect.top - 40;
        
        addComponentToCanvas(componentType, x, y, componentParams);
    });
    
    // Canvas click to deselect
    canvas.addEventListener('click', function(event) {
        // Only deselect if clicking directly on the canvas, not on a component
        if (event.target === canvas) {
            deselectComponent();
        }
    });
}

// Add component to canvas
function addComponentToCanvas(componentType, x, y, parameters = {}) {
    // Generate component ID
    componentCounter[componentType] = (componentCounter[componentType] || 0) + 1;
    const componentId = `${componentType}_${componentCounter[componentType]}`;
    
    // Create component element
    const componentDiv = document.createElement('div');
    componentDiv.id = componentId;
    componentDiv.className = 'component on-canvas';
    componentDiv.setAttribute('data-component-type', componentType);
    componentDiv.style.left = `${x}px`;
    componentDiv.style.top = `${y}px`;
    
    componentDiv.innerHTML = `
        <div class="component-icon ${componentType}-icon"></div>
        <div class="component-name">${getComponentName(componentType)} ${componentCounter[componentType]}</div>
    `;
    
    // Add to canvas
    document.getElementById('circuit-canvas').appendChild(componentDiv);
    
    // Add to circuit data
    currentCircuit.components[componentId] = {
        id: componentId,
        type: componentType,
        name: `${getComponentName(componentType)} ${componentCounter[componentType]}`,
        position: { x, y },
        parameters: { ...parameters }
    };
    
    // Make component draggable and selectable
    makeComponentDraggable(componentId);
    makeComponentSelectable(componentId);
    
    // Add endpoints based on component type
    addEndpoints(componentId, componentType);
    
    // Update the properties panel
    selectComponent(componentId);
    
    return componentId;
}

// Add endpoints to a component based on its type
function addEndpoints(componentId, componentType) {
    const component = document.getElementById(componentId);
    
    // Get endpoint configuration based on component type
    const endpoints = getComponentEndpoints(componentType);
    
    // Add endpoints
    endpoints.forEach(endpoint => {
        const params = {
            anchors: [endpoint.position],
            isSource: endpoint.isSource,
            isTarget: endpoint.isTarget,
            maxConnections: endpoint.maxConnections || -1,
            connector: ["Bezier", { curviness: 50 }],
            endpointStyle: { fill: endpoint.color || "#333", radius: 5 },
            uniqueEndpoint: false,
            cssClass: `${endpoint.type}-endpoint`,
            parameters: {
                endpointType: endpoint.type,
                direction: endpoint.direction
            }
        };
        
        jsPlumbInstance.addEndpoint(componentId, params);
    });
}

// Get component name
function getComponentName(componentType) {
    const componentNames = {
        'resistor': 'Resistor',
        'capacitor': 'Capacitor',
        'inductor': 'Inductor',
        'mosfet': 'MOSFET',
        'igbt': 'IGBT',
        'diode': 'Diode',
        'voltage_source': 'Voltage Source',
        'current_source': 'Current Source',
        'ground': 'Ground',
        'buck_converter': 'Buck Converter',
        'boost_converter': 'Boost Converter',
        'buck_boost_converter': 'Buck-Boost Converter',
        'flyback_converter': 'Flyback Converter',
        'forward_converter': 'Forward Converter'
    };
    
    return componentNames[componentType] || capitalizeFirstLetter(componentType);
}

// Get endpoints configuration for a component type
function getComponentEndpoints(componentType) {
    const endpointConfigs = {
        'resistor': [
            { position: [0, 0.5, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' }
        ],
        'capacitor': [
            { position: [0, 0.5, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' }
        ],
        'inductor': [
            { position: [0, 0.5, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' }
        ],
        'mosfet': [
            { position: [0, 0.25, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'gate' },
            { position: [0, 0.75, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'source' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'drain' }
        ],
        'igbt': [
            { position: [0, 0.25, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'gate' },
            { position: [0, 0.75, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'emitter' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'collector' }
        ],
        'diode': [
            { position: [0, 0.5, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'anode' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'cathode' }
        ],
        'voltage_source': [
            { position: [0, 0.5, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'negative' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'positive' }
        ],
        'current_source': [
            { position: [0, 0.5, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
            { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' }
        ],
        'ground': [
            { position: [0.5, 0, 0, -1], isSource: true, isTarget: true, type: 'electrical', direction: 'ground' }
        ],
        'buck_converter': [
            { position: [0, 0.25, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
            { position: [1, 0.25, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' },
            { position: [0.5, 1, 0, 1], isSource: true, isTarget: true, type: 'control', direction: 'control', color: '#0d6efd' }
        ],
        'boost_converter': [
            { position: [0, 0.25, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
            { position: [1, 0.25, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' },
            { position: [0.5, 1, 0, 1], isSource: true, isTarget: true, type: 'control', direction: 'control', color: '#0d6efd' }
        ],
        'buck_boost_converter': [
            { position: [0, 0.25, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
            { position: [1, 0.25, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' },
            { position: [0.5, 1, 0, 1], isSource: true, isTarget: true, type: 'control', direction: 'control', color: '#0d6efd' }
        ]
    };
    
    return endpointConfigs[componentType] || [
        { position: [0, 0.5, -1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'input' },
        { position: [1, 0.5, 1, 0], isSource: true, isTarget: true, type: 'electrical', direction: 'output' }
    ];
}

// Make component draggable
function makeComponentDraggable(componentId) {
    jsPlumbInstance.draggable(componentId, {
        grid: [10, 10],
        containment: 'parent',
        stop: function(event) {
            // Update component position in the circuit data
            const component = document.getElementById(componentId);
            const position = {
                x: parseInt(component.style.left),
                y: parseInt(component.style.top)
            };
            
            currentCircuit.components[componentId].position = position;
            
            // Update properties panel if this is the selected component
            if (selectedComponent === componentId) {
                updatePropertiesPanel(componentId);
            }
        }
    });
}

// Make component selectable
function makeComponentSelectable(componentId) {
    const component = document.getElementById(componentId);
    
    component.addEventListener('click', function(event) {
        // Prevent the canvas click handler from being triggered
        event.stopPropagation();
        
        // Select this component
        selectComponent(componentId);
    });
}

// Select a component
function selectComponent(componentId) {
    // Deselect previously selected component
    deselectComponent();
    
    // Highlight the new selected component
    const component = document.getElementById(componentId);
    component.classList.add('selected');
    
    // Update the selection state
    selectedComponent = componentId;
    
    // Update properties panel
    updatePropertiesPanel(componentId);
}

// Deselect the current component
function deselectComponent() {
    if (selectedComponent) {
        const component = document.getElementById(selectedComponent);
        if (component) {
            component.classList.remove('selected');
        }
        
        // Clear the properties panel
        document.getElementById('properties-panel').innerHTML = '<div class="text-center p-3">No component selected</div>';
        
        // Update the selection state
        selectedComponent = null;
    }
}

// Update properties panel for a component
function updatePropertiesPanel(componentId) {
    const component = currentCircuit.components[componentId];
    const propertiesPanel = document.getElementById('properties-panel');
    
    // Clear the panel
    propertiesPanel.innerHTML = '';
    
    // Create the header
    const header = document.createElement('div');
    header.className = 'properties-header';
    header.innerHTML = `
        <h5>${component.name}</h5>
        <p class="text-muted">Type: ${getComponentName(component.type)}</p>
    `;
    propertiesPanel.appendChild(header);
    
    // Create form for component properties
    const form = document.createElement('form');
    form.id = 'component-properties-form';
    form.className = 'mt-3';
    
    // Add name field
    const nameGroup = document.createElement('div');
    nameGroup.className = 'mb-3';
    nameGroup.innerHTML = `
        <label for="component-name" class="form-label">Name</label>
        <input type="text" class="form-control" id="component-name" value="${component.name}">
    `;
    form.appendChild(nameGroup);
    
    // Add parameters based on component type
    const parameters = getComponentParameters(component.type);
    
    parameters.forEach(param => {
        const value = component.parameters[param.id] !== undefined ? component.parameters[param.id] : param.default;
        
        const paramGroup = document.createElement('div');
        paramGroup.className = 'mb-3';
        
        let inputHtml = '';
        
        if (param.type === 'select') {
            inputHtml = `
                <label for="param-${param.id}" class="form-label">${param.name}</label>
                <select class="form-select" id="param-${param.id}" data-param-id="${param.id}">
                    ${param.options.map(option => 
                        `<option value="${option.value}" ${value === option.value ? 'selected' : ''}>${option.label}</option>`
                    ).join('')}
                </select>
                <small class="form-text text-muted">${param.description || ''}</small>
            `;
        } else if (param.type === 'checkbox') {
            inputHtml = `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="param-${param.id}" data-param-id="${param.id}" ${value ? 'checked' : ''}>
                    <label class="form-check-label" for="param-${param.id}">${param.name}</label>
                </div>
                <small class="form-text text-muted">${param.description || ''}</small>
            `;
        } else {
            // Default to text input
            inputHtml = `
                <label for="param-${param.id}" class="form-label">${param.name} ${param.unit ? `(${param.unit})` : ''}</label>
                <input type="${param.type || 'text'}" class="form-control" id="param-${param.id}" data-param-id="${param.id}" value="${value}">
                <small class="form-text text-muted">${param.description || ''}</small>
            `;
        }
        
        paramGroup.innerHTML = inputHtml;
        form.appendChild(paramGroup);
    });
    
    // Add buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'd-flex justify-content-between mt-4';
    buttonGroup.innerHTML = `
        <button type="button" class="btn btn-primary" id="save-properties-btn">Apply</button>
        <button type="button" class="btn btn-danger" id="delete-component-btn">Delete</button>
    `;
    form.appendChild(buttonGroup);
    
    propertiesPanel.appendChild(form);
    
    // Add event listeners for the buttons
    document.getElementById('save-properties-btn').addEventListener('click', function() {
        saveComponentProperties(componentId);
    });
    
    document.getElementById('delete-component-btn').addEventListener('click', function() {
        deleteComponent(componentId);
    });
}

// Get component parameters based on component type
function getComponentParameters(componentType) {
    const paramConfigs = {
        'resistor': [
            { id: 'resistance', name: 'Resistance', type: 'number', unit: 'Ω', default: 1000, description: 'Resistance value in ohms' }
        ],
        'capacitor': [
            { id: 'capacitance', name: 'Capacitance', type: 'number', unit: 'F', default: 0.000001, description: 'Capacitance value in farads' }
        ],
        'inductor': [
            { id: 'inductance', name: 'Inductance', type: 'number', unit: 'H', default: 0.001, description: 'Inductance value in henries' }
        ],
        'mosfet': [
            { id: 'rdson', name: 'RDS(on)', type: 'number', unit: 'Ω', default: 0.1, description: 'On-state resistance in ohms' },
            { id: 'vth', name: 'Threshold Voltage', type: 'number', unit: 'V', default: 3, description: 'Gate threshold voltage' }
        ],
        'igbt': [
            { id: 'vce_sat', name: 'VCE(sat)', type: 'number', unit: 'V', default: 2, description: 'Collector-emitter saturation voltage' },
            { id: 'vge_th', name: 'VGE(th)', type: 'number', unit: 'V', default: 5, description: 'Gate-emitter threshold voltage' }
        ],
        'diode': [
            { id: 'vf', name: 'Forward Voltage', type: 'number', unit: 'V', default: 0.7, description: 'Forward voltage drop' }
        ],
        'voltage_source': [
            { id: 'voltage', name: 'Voltage', type: 'number', unit: 'V', default: 12, description: 'Source voltage' },
            { id: 'source_type', name: 'Source Type', type: 'select', default: 'dc', description: 'Type of voltage source',
              options: [
                  { value: 'dc', label: 'DC' },
                  { value: 'ac', label: 'AC' },
                  { value: 'pulse', label: 'Pulse' }
              ]
            },
            { id: 'frequency', name: 'Frequency', type: 'number', unit: 'Hz', default: 50, description: 'AC frequency (for AC source)' },
            { id: 'amplitude', name: 'Amplitude', type: 'number', unit: 'V', default: 12, description: 'Peak amplitude (for AC source)' }
        ],
        'current_source': [
            { id: 'current', name: 'Current', type: 'number', unit: 'A', default: 1, description: 'Source current' }
        ],
        'buck_converter': [
            { id: 'duty_cycle', name: 'Duty Cycle', type: 'number', unit: '%', default: 50, description: 'PWM duty cycle (0-100)' },
            { id: 'frequency', name: 'Switching Frequency', type: 'number', unit: 'kHz', default: 100, description: 'Switching frequency in kHz' },
            { id: 'inductance', name: 'Inductance', type: 'number', unit: 'H', default: 0.0001, description: 'Inductor value in henries' },
            { id: 'capacitance', name: 'Capacitance', type: 'number', unit: 'F', default: 0.0000047, description: 'Output capacitor value in farads' }
        ],
        'boost_converter': [
            { id: 'duty_cycle', name: 'Duty Cycle', type: 'number', unit: '%', default: 50, description: 'PWM duty cycle (0-100)' },
            { id: 'frequency', name: 'Switching Frequency', type: 'number', unit: 'kHz', default: 100, description: 'Switching frequency in kHz' },
            { id: 'inductance', name: 'Inductance', type: 'number', unit: 'H', default: 0.0001, description: 'Inductor value in henries' },
            { id: 'capacitance', name: 'Capacitance', type: 'number', unit: 'F', default: 0.0000047, description: 'Output capacitor value in farads' }
        ]
    };
    
    return paramConfigs[componentType] || [];
}

// Save component properties
function saveComponentProperties(componentId) {
    const component = currentCircuit.components[componentId];
    const nameInput = document.getElementById('component-name');
    
    // Update component name
    if (nameInput) {
        component.name = nameInput.value;
        
        // Update the display name
        const componentElement = document.getElementById(componentId);
        const nameElement = componentElement.querySelector('.component-name');
        if (nameElement) {
            nameElement.textContent = component.name;
        }
    }
    
    // Update component parameters
    const paramInputs = document.querySelectorAll('[data-param-id]');
    paramInputs.forEach(input => {
        const paramId = input.getAttribute('data-param-id');
        let value;
        
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = parseFloat(input.value);
        } else {
            value = input.value;
        }
        
        component.parameters[paramId] = value;
    });
    
    // Update the header in the properties panel
    const header = document.querySelector('.properties-header h5');
    if (header) {
        header.textContent = component.name;
    }
    
    // Show a success message
    showNotification('Properties saved successfully', 'success');
}

// Delete a component
function deleteComponent(componentId) {
    // Remove component from the canvas
    const component = document.getElementById(componentId);
    if (component) {
        // Remove all endpoints and connections
        jsPlumbInstance.removeAllEndpoints(componentId);
        
        // Remove the element
        component.remove();
    }
    
    // Remove component from circuit data
    delete currentCircuit.components[componentId];
    
    // Remove connections involving this component
    currentCircuit.connections = currentCircuit.connections.filter(conn => 
        conn.sourceId !== componentId && conn.targetId !== componentId
    );
    
    // Deselect if this was the selected component
    if (selectedComponent === componentId) {
        selectedComponent = null;
        document.getElementById('properties-panel').innerHTML = '<div class="text-center p-3">No component selected</div>';
    }
    
    // Show a success message
    showNotification('Component deleted', 'info');
}

// Palette drag start handler
function onPaletteDragStart(event) {
    const componentType = event.target.getAttribute('data-component-type');
    const componentParams = event.target.getAttribute('data-component-params');
    
    event.dataTransfer.setData('component-type', componentType);
    event.dataTransfer.setData('component-params', componentParams);
    event.dataTransfer.effectAllowed = 'copy';
}

// Set up event listeners
function setupEventListeners() {
    // Save circuit button
    document.getElementById('save-circuit-btn').addEventListener('click', saveCircuit);
    
    // Load circuit button
    document.getElementById('load-circuit-btn').addEventListener('click', function() {
        // Show the load dialog
        document.getElementById('load-circuit-modal').classList.add('show');
        document.getElementById('load-circuit-modal').style.display = 'block';
        loadCircuitList();
    });
    
    // New circuit button
    document.getElementById('new-circuit-btn').addEventListener('click', newCircuit);
    
    // Run simulation button
    document.getElementById('run-simulation-btn').addEventListener('click', runSimulation);
    
    // Circuit name input
    document.getElementById('circuit-name').addEventListener('change', function() {
        currentCircuit.name = this.value;
    });
    
    // Load dialog close button
    document.querySelector('#load-circuit-modal .btn-secondary').addEventListener('click', function() {
        document.getElementById('load-circuit-modal').classList.remove('show');
        document.getElementById('load-circuit-modal').style.display = 'none';
    });
    
    // Load circuit button in dialog
    document.getElementById('load-selected-circuit-btn').addEventListener('click', loadCircuit);
    
    // jsPlumb connection listeners
    jsPlumbInstance.bind('connection', function(info) {
        // Add connection to circuit data
        const connection = {
            id: generateUUID(),
            sourceId: info.sourceId,
            targetId: info.targetId,
            sourceEndpoint: info.sourceEndpoint.getParameters(),
            targetEndpoint: info.targetEndpoint.getParameters()
        };
        
        currentCircuit.connections.push(connection);
        
        // Log connection
        console.log('Connection created:', connection);
    });
    
    jsPlumbInstance.bind('connectionDetached', function(info) {
        // Remove connection from circuit data
        const sourceId = info.sourceId;
        const targetId = info.targetId;
        
        currentCircuit.connections = currentCircuit.connections.filter(conn => 
            !(conn.sourceId === sourceId && conn.targetId === targetId)
        );
        
        // Log disconnection
        console.log('Connection detached:', sourceId, targetId);
    });
}

// Save the current circuit
function saveCircuit() {
    // Ensure the circuit has a name
    const nameInput = document.getElementById('circuit-name');
    if (!nameInput.value.trim()) {
        showNotification('Please enter a circuit name', 'warning');
        nameInput.focus();
        return;
    }
    
    // Update the circuit name
    currentCircuit.name = nameInput.value;
    
    // Save to server
    fetch('/save_circuit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentCircuit)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Circuit saved successfully', 'success');
        } else {
            showNotification('Error saving circuit: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error saving circuit', 'error');
    });
}

// Load circuit list
function loadCircuitList() {
    fetch('/get_circuits')
        .then(response => response.json())
        .then(data => {
            const circuitList = document.getElementById('circuit-list');
            circuitList.innerHTML = '';
            
            if (data.length === 0) {
                circuitList.innerHTML = '<div class="text-center p-3">No saved circuits found</div>';
                return;
            }
            
            data.forEach(circuit => {
                const item = document.createElement('div');
                item.className = 'circuit-list-item';
                item.setAttribute('data-circuit-id', circuit.id);
                item.innerHTML = `
                    <div class="circuit-name">${circuit.name}</div>
                    <div class="circuit-meta">
                        <small>${circuit.components_count} components</small>
                        <small>${new Date(circuit.last_modified).toLocaleString()}</small>
                    </div>
                `;
                
                item.addEventListener('click', function() {
                    // Highlight the selected circuit
                    document.querySelectorAll('.circuit-list-item').forEach(el => {
                        el.classList.remove('selected');
                    });
                    this.classList.add('selected');
                    
                    // Enable the load button
                    document.getElementById('load-selected-circuit-btn').disabled = false;
                });
                
                circuitList.appendChild(item);
            });
        })
        .catch(error => {
            console.error('Error loading circuits:', error);
            document.getElementById('circuit-list').innerHTML = 'Error loading circuits.';
        });
}

//