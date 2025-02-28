# app.py
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
import os
import json
import numpy as np
from config import Config
from models.circuit import Circuit
from models.component import Component, Resistor, Capacitor, Inductor, Diode, MOSFET, IGBT
from models.simulation import SimulationResult
from simulation.engine import simulate_circuit

app = Flask(__name__)
app.config.from_object(Config)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Store current circuit in session
current_circuit = None

@app.route('/')
def index():
    """Home page with introduction and navigation."""
    return render_template('index.html')

@app.route('/editor', methods=['GET', 'POST'])
def editor():
    """Circuit editor page."""
    global current_circuit
    
    if request.method == 'POST':
        # Process circuit data from the editor
        circuit_data = request.json
        current_circuit = Circuit.from_json(circuit_data)
        return jsonify({"status": "success"})
    
    return render_template('editor.html')

@app.route('/simulate', methods=['POST'])
def simulate():
    """Run simulation based on current circuit."""
    global current_circuit
    
    if not current_circuit:
        flash("No circuit to simulate.")
        return redirect(url_for('editor'))
    
    # Get simulation parameters
    simulation_params = request.json
    
    # Run simulation
    try:
        result = simulate_circuit(
            current_circuit,
            end_time=simulation_params.get('end_time', app.config['MAX_SIMULATION_TIME']),
            step_size=simulation_params.get('step_size', app.config['DEFAULT_STEP_SIZE'])
        )
        
        # Convert result to JSON for the frontend
        result_data = result.to_json()
        return jsonify(result_data)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/save_circuit', methods=['POST'])
def save_circuit():
    """Save current circuit to file."""
    global current_circuit
    
    if not current_circuit:
        return jsonify({"error": "No circuit to save"}), 400
    
    try:
        filename = request.json.get('filename', 'circuit.json')
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        with open(filepath, 'w') as f:
            json.dump(current_circuit.to_json(), f, indent=2)
        
        return jsonify({"status": "success", "message": f"Saved as {filename}"})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/load_circuit', methods=['POST'])
def load_circuit():
    """Load circuit from file."""
    global current_circuit
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    if file and '.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']:
        try:
            circuit_data = json.load(file)
            current_circuit = Circuit.from_json(circuit_data)
            return jsonify({"status": "success", "circuit": circuit_data})
        
        except Exception as e:
            return jsonify({"error": str(e)}), 400
    
    return jsonify({"error": "Invalid file format"}), 400

@app.route('/component_library')
def component_library():
    """Component library page."""
    return render_template('library.html')

@app.route('/get_components')
def get_components():
    """Return available components for the editor."""
    components = {
        "passive": [
            {"type": "resistor", "name": "Resistor", "params": {"resistance": 1000}},
            {"type": "capacitor", "name": "Capacitor", "params": {"capacitance": 1e-6}},
            {"type": "inductor", "name": "Inductor", "params": {"inductance": 1e-3}}
        ],
        "semiconductor": [
            {"type": "diode", "name": "Diode", "params": {"forward_voltage": 0.7, "reverse_current": 1e-6}},
            {"type": "mosfet", "name": "MOSFET", "params": {"rds_on": 0.1, "threshold_voltage": 3.0}},
            {"type": "igbt", "name": "IGBT", "params": {"vce_sat": 2.0, "threshold_voltage": 5.0}}
        ],
        "sources": [
            {"type": "voltage_source", "name": "DC Voltage Source", "params": {"voltage": 12}},
            {"type": "pwm_source", "name": "PWM Source", "params": {"amplitude": 5, "frequency": 10000, "duty_cycle": 0.5}}
        ],
        "converters": [
            {"type": "buck_converter", "name": "Buck Converter", "params": {}},
            {"type": "boost_converter", "name": "Boost Converter", "params": {}},
            {"type": "buck_boost_converter", "name": "Buck-Boost Converter", "params": {}}
        ]
    }
    
    return jsonify(components)

if __name__ == '__main__':
    app.run(debug=True)