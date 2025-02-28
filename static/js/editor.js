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
    componentDiv.className = 'component';
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
        parameters: parameters // Ensure parameters are included
    };
}

