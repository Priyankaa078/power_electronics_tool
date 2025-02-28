# models/circuit.py
import json
import uuid

class Circuit:
    """Circuit model representing a complete power electronics circuit."""
    
    def __init__(self, name="Untitled Circuit"):
        self.id = str(uuid.uuid4())
        self.name = name
        self.components = {}  # component_id -> Component
        self.connections = []  # list of (component1_id, terminal1, component2_id, terminal2)
        
    def add_component(self, component):
        """Add a component to the circuit."""
        self.components[component.id] = component
        return component.id
    
    def remove_component(self, component_id):
        """Remove a component from the circuit."""
        if component_id in self.components:
            # Remove all connections to this component
            self.connections = [conn for conn in self.connections 
                               if conn[0] != component_id and conn[2] != component_id]
            del self.components[component_id]
            return True
        return False
    
    def connect(self, component1_id, terminal1, component2_id, terminal2):
        """Connect two component terminals."""
        if (component1_id in self.components and 
            component2_id in self.components and
            component1_id != component2_id):  # Prevent connecting to self
            
            # Check if terminals exist on components
            comp1 = self.components[component1_id]
            comp2 = self.components[component2_id]
            
            if terminal1 in comp1.terminals and terminal2 in comp2.terminals:
                connection = (component1_id, terminal1, component2_id, terminal2)
                if connection not in self.connections:
                    self.connections.append(connection)
                    return True
        return False
    
    def disconnect(self, component1_id, terminal1, component2_id, terminal2):
        """Disconnect two component terminals."""
        connection = (component1_id, terminal1, component2_id, terminal2)
        if connection in self.connections:
            self.connections.remove(connection)
            return True
        return False
    
    def to_json(self):
        """Convert circuit to JSON representation."""
        return {
            "id": self.id,
            "name": self.name,
            "components": {id: comp.to_json() for id, comp in self.components.items()},
            "connections": self.connections
        }
    
    @classmethod
    def from_json(cls, data):
        """Create circuit from JSON representation."""
        from models.component import create_component_from_json
        
        circuit = cls(name=data.get("name", "Untitled Circuit"))
        circuit.id = data.get("id", str(uuid.uuid4()))
        
        # Add components
        for comp_id, comp_data in data.get("components", {}).items():
            component = create_component_from_json(comp_data)
            circuit.components[comp_id] = component
        
        # Add connections
        circuit.connections = data.get("connections", [])
        
        return circuit