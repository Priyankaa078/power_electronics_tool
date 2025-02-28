# models/simulation.py
import json
import numpy as np
import matplotlib.pyplot as plt
from io import BytesIO
import base64

class SimulationResult:
    """Class to store and process simulation results."""
    
    def __init__(self, time_points, variables, circuit_id):
        self.time_points = time_points
        self.variables = variables  # dict of variable_name -> array of values
        self.circuit_id = circuit_id
        
    def get_variable(self, name):
        """Get simulation data for a specific variable."""
        return self.variables.get(name)
    
    def plot(self, variable_names=None):
        """Generate plot for specified variables."""
        if variable_names is None:
            variable_names = list(self.variables.keys())
        
        plt.figure(figsize=(10, 6))
        for name in variable_names:
            if name in self.variables:
                plt.plot(self.time_points, self.variables[name], label=name)
        
        plt.xlabel('Time (s)')
        plt.ylabel('Value')
        plt.grid(True)
        plt.legend()
        
        # Convert plot to base64 for embedding in HTML
        buffer = BytesIO()
        plt.savefig(buffer, format='png')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        plt.close()
        
        return f"data:image/png;base64,{image_base64}"
    
    def to_json(self):
        """Convert simulation results to JSON."""
        # Convert numpy arrays to lists for JSON serialization
        result = {
            "circuit_id": self.circuit_id,
            "time_points": self.time_points.tolist(),
            "variables": {k: v.tolist() for k, v in self.variables.items()},
            # Generate plots for all variables
            "plots": {
                "all": self.plot(),
                "individual": {var: self.plot([var]) for var in self.variables}
            }
        }
        return result