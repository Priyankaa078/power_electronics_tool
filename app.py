from flask import Flask, render_template, request, jsonify, redirect, url_for
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from io import BytesIO
import base64

# Import your simulation models
from models.core import CircuitSimulator
from models.components import Resistor, VoltageSource, Diode, MOSFET, Capacitor, Inductor, PWM
from models.converters import BuckConverter, BoostConverter, BuckBoostConverter
from models.analysis import SwitchLossCalculator, ThermalModel, EfficiencyCalculator, FFTAnalyzer

app = Flask(__name__)

# Home page
@app.route('/')
def index():
    return render_template('index.html')

# Simulation configuration page
@app.route('/simulate', methods=['GET', 'POST'])
def simulate():
    if request.method == 'POST':
        # Get form data and redirect to results
        return redirect(url_for('results'))
    
    # GET request - show simulation form
    return render_template('simulation.html')

# Run simulation and show results
@app.route('/results', methods=['POST'])
def results():
    # Get simulation parameters from form
    circuit_type = request.form.get('circuit_type', 'buck')
    input_voltage = float(request.form.get('input_voltage', 24))
    frequency = float(request.form.get('frequency', 100000))
    duty_cycle = float(request.form.get('duty_cycle', 0.5))
    inductance = float(request.form.get('inductance', 100)) * 1e-6  # Convert to H
    capacitance = float(request.form.get('capacitance', 470)) * 1e-6  # Convert to F
    load_resistance = float(request.form.get('load', 10))
    
    sim_time = float(request.form.get('sim_time', 1)) / 1000  # Convert to seconds
    step_size = float(request.form.get('step_size', 0.1)) / 1000000  # Convert to seconds
    
    # Run simulation based on circuit type
    if circuit_type == 'buck':
        converter = BuckConverter(input_voltage, frequency, duty_cycle)
        results = converter.simulate(sim_time, step_size)
    elif circuit_type == 'boost':
        converter = BoostConverter(input_voltage, frequency, duty_cycle)
        results = converter.simulate(sim_time, step_size)
    elif circuit_type == 'buckboost':
        converter = BuckBoostConverter(input_voltage, frequency, duty_cycle)
        results = converter.simulate(sim_time, step_size)
    else:
        return "Invalid circuit type", 400
    
    # Generate plots
    plots = generate_plots(results)
    
    # Calculate efficiency and other metrics
    metrics = calculate_metrics(results)
    
    return render_template('results.html', 
                           plots=plots, 
                           metrics=metrics,
                           params=request.form)

def generate_plots(results):
    plots = {}
    
    # Voltage and current waveforms
    plt.figure(figsize=(10, 6))
    
    # Convert time to milliseconds for display
    time_ms = results['time'] * 1000
    
    # Plot voltage
    ax1 = plt.gca()
    ax1.plot(time_ms, results['output_voltage'], 'b-', label='Output Voltage (V)')
    ax1.set_xlabel('Time (ms)')
    ax1.set_ylabel('Voltage (V)', color='b')
    ax1.tick_params(axis='y', labelcolor='b')
    
    # Add current on secondary y-axis
    ax2 = ax1.twinx()
    ax2.plot(time_ms, results['inductor_current'], 'r-', label='Inductor Current (A)')
    ax2.set_ylabel('Current (A)', color='r')
    ax2.tick_params(axis='y', labelcolor='r')
    
    # Add switch state markers
    switch_on_times = time_ms[results['switch_state']]
    switch_off_times = time_ms[~results['switch_state']]
    
    if len(switch_on_times) > 0:
        ax1.plot(switch_on_times, np.zeros_like(switch_on_times), 'g|', markersize=10)
    if len(switch_off_times) > 0:
        ax1.plot(switch_off_times, np.zeros_like(switch_off_times), 'k|', markersize=10)
    
    # Add legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper right')
    
    plt.title('Converter Waveforms')
    plt.grid(True)
    plt.tight_layout()
    
    # Save plot to a base64 string
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    plots['waveforms'] = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close()
    
    # Generate FFT plot for output voltage ripple
    plt.figure(figsize=(10, 6))
    
    # Get only the steady-state part of the waveform
    steady_idx = int(len(results['time']) * 0.5)  # Skip first half for startup transients
    steady_voltage = results['output_voltage'][steady_idx:]
    steady_time = results['time'][steady_idx:]
    
    # Calculate average voltage to find ripple
    avg_voltage = np.mean(steady_voltage)
    ripple = steady_voltage - avg_voltage
    
    # Calculate FFT
    time_step = steady_time[1] - steady_time[0]
    freqs, amps = FFTAnalyzer.calculate_fft(ripple, time_step)
    
    # Plot only up to 10x the switching frequency
    max_freq_idx = np.searchsorted(freqs, 10 * results.get('frequency', frequency))
    plt.plot(freqs[:max_freq_idx]/1000, amps[:max_freq_idx])
    plt.xlabel('Frequency (kHz)')
    plt.ylabel('Amplitude (V)')
    plt.title('Output Voltage Ripple Spectrum')
    plt.grid(True)
    plt.tight_layout()
    
    # Save plot to a base64 string
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    plots['fft'] = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close()
    
    return plots

def calculate_metrics(results):
    metrics = {}
    
    # Calculate average values (use only steady-state)
    steady_idx = int(len(results['time']) * 0.5)  # Skip first half
    avg_voltage = np.mean(results['output_voltage'][steady_idx:])
    avg_current = np.mean(results['inductor_current'][steady_idx:])
    
    # Calculate ripple
    voltage_ripple = np.max(results['output_voltage'][steady_idx:]) - np.min(results['output_voltage'][steady_idx:])
    current_ripple = np.max(results['inductor_current'][steady_idx:]) - np.min(results['inductor_current'][steady_idx:])
    
    voltage_ripple_percent = (voltage_ripple / avg_voltage) * 100
    current_ripple_percent = (current_ripple / avg_current) * 100
    
    metrics['avg_voltage'] = round(avg_voltage, 2)
    metrics['avg_current'] = round(avg_current, 2)
    metrics['voltage_ripple'] = round(voltage_ripple, 3)
    metrics['voltage_ripple_percent'] = round(voltage_ripple_percent, 2)
    metrics['current_ripple'] = round(current_ripple, 3)
    metrics['current_ripple_percent'] = round(current_ripple_percent, 2)
    
    # Calculate output power
    output_power = avg_voltage * avg_current
    metrics['output_power'] = round(output_power, 2)
    
    return metrics

# API endpoint to run simulation and return JSON results
@app.route('/api/simulate', methods=['POST'])
def api_simulate():
    # Get parameters from JSON request
    params = request.json
    
    # Run simulation
    # ... (similar to results route but returning JSON)
    
    return jsonify({"status": "success", "results": {}})

if __name__ == '__main__':
    app.run(debug=True)