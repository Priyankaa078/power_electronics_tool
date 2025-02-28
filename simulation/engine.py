# simulation/engine.py
import numpy as np
from scipy.integrate import solve_ivp
from models.simulation import SimulationResult
from models.circuit import Circuit

def simulate_circuit(circuit, end_time=1.0, step_size=1e-6):
    """Run simulation for the given circuit."""
    # Get circuit components and connections
    components = circuit.components
    connections = circuit.connections
    
    # Build the simulation model
    model = build_circuit_model(components, connections)
    
    # Set up initial conditions
    initial_state = model.get_initial_state()
    
    # Set up time points
    t_span = (0, end_time)
    t_eval = np.arange(0, end_time, step_size)
    
    # Solve the differential equations
    solution = solve_ivp(
        model.derivatives,
        t_span,
        initial_state,
        method='RK45',
        t_eval=t_eval
    )
    
    # Process results
    variables = model.process_results(solution.t, solution.y)
    
    return SimulationResult(solution.t, variables, circuit.id)

def build_circuit_model(components, connections):
    """Build appropriate simulation model based on circuit topology."""
    # First identify the circuit topology
    topology = identify_topology(components, connections)
    
    # Based on topology, create the appropriate model
    if topology == "buck_converter":
        from simulation.components.converters import BuckConverter
        return BuckConverter(components, connections)
        
    elif topology == "boost_converter":
        from simulation.components.converters import BoostConverter
        return BoostConverter(components, connections)
    
    elif topology == "buck_boost_converter":
        from simulation.components.converters import BuckBoostConverter
        return BuckBoostConverter(components, connections)
    
    # If no specific topology identified, use a generic circuit model
    from simulation.components.generic import GenericCircuitModel
    return GenericCircuitModel(components, connections)

def identify_topology(components, connections):
    """Identify circuit topology based on component types and connections."""
    # Count component types
    component_counts = {}
    for component in components.values():
        component_type = component.type
        component_counts[component_type] = component_counts.get(component_type, 0) + 1
    
    # Check for common converter topologies
    
    # Buck converter typically has: 
    # - One switch (MOSFET/IGBT)
    # - One diode
    # - One inductor
    # - One capacitor
    if (component_counts.get("mosfet", 0) + component_counts.get("igbt", 0) >= 1 and
        component_counts.get("diode", 0) >= 1 and
        component_counts.get("inductor", 0) >= 1 and
        component_counts.get("capacitor", 0) >= 1):
        
        # We also need to check connectivity to confirm it's a buck converter
        # This would require more detailed analysis of the connections
        # For simplicity, we're making an assumption based on component count
        
        return "buck_converter"
    
    # Boost converter has similar components but different topology
    elif (component_counts.get("mosfet", 0) + component_counts.get("igbt", 0) >= 1 and
          component_counts.get("diode", 0) >= 1 and
          component_counts.get("inductor", 0) >= 1 and
          component_counts.get("capacitor", 0) >= 1):
          
        # For a more accurate identification, we would check connections
        # For now, let's differentiate based on user naming or parameters
        
        # This is a simplified approach - in practice, we would analyze connections
        for component in components.values():
            if "boost" in component.name.lower():
                return "boost_converter"
        
        # Default to buck if we can't differentiate
        return "buck_converter"
    
    # Default to generic circuit model
    return "generic"

