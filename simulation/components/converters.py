# simulation/components/converters.py
import numpy as np

class BuckConverter:
    """Buck converter simulation model."""
    
    def __init__(self, components, connections):
        self.components = components
        self.connections = connections
        self.state_vars = []
        self.switch_component = None
        self.diode_component = None
        self.inductor_component = None
        self.capacitor_component = None
        self.source_component = None
        self.load_resistance = 100.0  # Default load resistance
        
        self.initialize_model()
    
    def initialize_model(self):
        """Identify components and set up the model."""
        # Find the key components
        for comp_id, component in self.components.items():
            if component.type in ["mosfet", "igbt"]:
                self.switch_component = component
            elif component.type == "diode":
                self.diode_component = component
            elif component.type == "inductor":
                self.inductor_component = component
            elif component.type == "capacitor":
                self.capacitor_component = component
            elif component.type == "voltage_source":
                self.source_component = component
            elif component.type == "resistor":
                # Assume this is the load resistor
                self.load_resistance = component.parameters["resistance"]
        
        # Set up state variables (inductor current and capacitor voltage)
        if self.inductor_component:
            self.state_vars.append({
                "name": "inductor_current",
                "component_id": self.inductor_component.id,
                "type": "current",
                "initial_value": 0.0
            })
        
        if self.capacitor_component:
            self.state_vars.append({
                "name": "capacitor_voltage",
                "component_id": self.capacitor_component.id,
                "type": "voltage",
                "initial_value": 0.0
            })
    
    def get_initial_state(self):
        """Get initial state vector for simulation."""
        return np.array([var["initial_value"] for var in self.state_vars])
    
    def derivatives(self, t, y):
        """Calculate derivatives for buck converter state variables."""
        dy = np.zeros_like(y)
        
        # Extract state variables
        inductor_current = y[0]
        capacitor_voltage = y[1] if len(y) > 1 else 0.0
        
        # Circuit parameters
        inductance = self.inductor_component.parameters["inductance"]
        capacitance = self.capacitor_component.parameters["capacitance"] if self.capacitor_component else 1e-6
        input_voltage = self.source_component.parameters["voltage"] if self.source_component else 12.0
        
        # Determine switch state (simplified PWM model)
        # For a real implementation, we'd use the actual PWM signal
        # For now, use a simple duty cycle model
        duty_cycle = 0.5  # 50% duty cycle
        switching_frequency = 10000  # 10 kHz
        switch_period = 1.0 / switching_frequency
        switch_on = (t % switch_period) / switch_period < duty_cycle
        
        # Calculate derivatives
        if switch_on:
            # Switch ON: inductor charges from input
            di_dt = (input_voltage - capacitor_voltage) / inductance
        else:
            # Switch OFF: inductor discharges through diode
            di_dt = -capacitor_voltage / inductance
        
        # Capacitor voltage derivative
        dv_dt = (inductor_current - capacitor_voltage / self.load_resistance) / capacitance
        
        dy[0] = di_dt
        if len(y) > 1:
            dy[1] = dv_dt
        
        return dy
    
    def process_results(self, t, y):
        """Process raw simulation results into named variables."""
        variables = {}
        
        # Extract state variables
        inductor_current = y[0, :]
        capacitor_voltage = y[1, :] if y.shape[0] > 1 else np.zeros_like(t)
        
        # Store basic state variables
        variables["inductor_current"] = inductor_current
        variables["capacitor_voltage"] = capacitor_voltage
        
        # Calculate derived variables
        input_voltage = self.source_component.parameters["voltage"] if self.source_component else 12.0
        variables["input_voltage"] = np.ones_like(t) * input_voltage
        
        # Output current (same as load current)
        variables["output_current"] = capacitor_voltage / self