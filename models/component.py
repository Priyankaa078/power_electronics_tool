import uuid

class Component:
    """Base class for all circuit components."""
    
    def __init__(self, component_type, name=None, position=(0, 0), rotation=0):
        self.id = str(uuid.uuid4())
        self.type = component_type
        self.name = name or f"{component_type}_{self.id[:8]}"
        self.position = position
        self.rotation = rotation
        self.terminals = []
        self.parameters = {}
    
    def to_json(self):
        """Convert component to JSON representation."""
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "position": self.position,
            "rotation": self.rotation,
            "terminals": self.terminals,
            "parameters": self.parameters
        }
    
    @classmethod
    def from_json(cls, data):
        """Create component from JSON representation."""
        component = cls(
            component_type=data.get("type", "unknown"),
            name=data.get("name"),
            position=data.get("position", (0, 0)),
            rotation=data.get("rotation", 0)
        )
        component.id = data.get("id", str(uuid.uuid4()))
        component.terminals = data.get("terminals", [])
        component.parameters = data.get("parameters", {})
        return component

class Resistor(Component):
    """Resistor component."""
    
    def __init__(self, resistance=1000, **kwargs):
        super().__init__(component_type="resistor", **kwargs)
        self.terminals = ["t1", "t2"]
        self.parameters = {"resistance": resistance}

class Capacitor(Component):
    """Capacitor component."""
    
    def __init__(self, capacitance=1e-6, **kwargs):
        super().__init__(component_type="capacitor", **kwargs)
        self.terminals = ["t1", "t2"]
        self.parameters = {"capacitance": capacitance}

class Inductor(Component):
    """Inductor component."""
    
    def __init__(self, inductance=1e-3, **kwargs):
        super().__init__(component_type="inductor", **kwargs)
        self.terminals = ["t1", "t2"]
        self.parameters = {"inductance": inductance}

class Diode(Component):
    """Diode component."""
    
    def __init__(self, forward_voltage=0.7, reverse_current=1e-6, **kwargs):
        super().__init__(component_type="diode", **kwargs)
        self.terminals = ["anode", "cathode"]
        self.parameters = {
            "forward_voltage": forward_voltage,
            "reverse_current": reverse_current
        }

class MOSFET(Component):
    """MOSFET component."""
    
    def __init__(self, rds_on=0.1, threshold_voltage=3.0, **kwargs):
        super().__init__(component_type="mosfet", **kwargs)
        self.terminals = ["drain", "gate", "source"]
        self.parameters = {
            "rds_on": rds_on,
            "threshold_voltage": threshold_voltage
        }

class IGBT(Component):
    """IGBT component."""
    
    def __init__(self, vce_sat=2.0, threshold_voltage=5.0, **kwargs):
        super().__init__(component_type="igbt", **kwargs)
        self.terminals = ["collector", "gate", "emitter"]
        self.parameters = {
            "vce_sat": vce_sat,
            "threshold_voltage": threshold_voltage
        }

class VoltageSource(Component):
    """Voltage source component."""
    
    def __init__(self, voltage=12, **kwargs):
        super().__init__(component_type="voltage_source", **kwargs)
        self.terminals = ["positive", "negative"]
        self.parameters = {"voltage": voltage}

class PWMSource(Component):
    """PWM source component."""
    
    def __init__(self, amplitude=5, frequency=10000, duty_cycle=0.5, **kwargs):
        super().__init__(component_type="pwm_source", **kwargs)
        self.terminals = ["output", "reference"]
        self.parameters = {
            "amplitude": amplitude,
            "frequency": frequency,
            "duty_cycle": duty_cycle
        }

def create_component_from_json(data):
    """Factory function to create appropriate component from JSON data."""
    component_type = data.get("type", "").lower()
    
    component_classes = {
        "resistor": Resistor,
        "capacitor": Capacitor,
        "inductor": Inductor,
        "diode": Diode,
        "mosfet": MOSFET,
        "igbt": IGBT,
        "voltage_source": VoltageSource,
        "pwm_source": PWMSource
    }
    
    if component_type in component_classes:
        parameters = data.get("parameters", {})
        cls = component_classes[component_type]
        instance = cls(**parameters)
        
        # Set other properties
        if "id" in data:
            instance.id = data["id"]
        if "name" in data:
            instance.name = data["name"]
        if "position" in data:
            instance.position = data["position"]
        if "rotation" in data:
            instance.rotation = data["rotation"]
            
        return instance
    else:
        # Create generic component
        return Component.from_json(data)