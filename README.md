# Project structure
power_electronics_tool/
│
├── app.py                     # Main Flask application
├── config.py                  # Configuration settings
├── requirements.txt           # Project dependencies
│
├── static/                    # Static files
│   ├── css/
│   │   └── style.css          # Custom styling
│   ├── js/
│   │   ├── circuit_editor.js  # Circuit editor functionality
│   │   └── simulation.js      # Simulation visualization
│   └── img/                   # Images and icons
│
├── templates/                 # HTML templates
│   ├── base.html              # Base template with common elements
│   ├── index.html             # Home page
│   ├── editor.html            # Circuit editor page
│   ├── simulation.html        # Simulation results page
│   └── library.html           # Component library page
│
├── models/                    # Data models
│   ├── __init__.py
│   ├── circuit.py             # Circuit model
│   ├── component.py           # Component models
│   └── simulation.py          # Simulation models
│
└── simulation/                # Simulation engine
    ├── __init__.py
    ├── engine.py              # Main simulation engine
    ├── solvers.py             # Numerical solvers
    └── components/            # Component simulation models
        ├── __init__.py
        ├── switch.py          # Switch models (MOSFET, IGBT, etc.)
        ├── passive.py         # Passive components (R, L, C)
        └── converters.py      # Converter topologies
'''

# requirements.txt
'''
Flask==2.3.3
Flask-WTF==1.1.1
numpy==1.24.3
scipy==1.10.1
matplotlib==3.7.2
networkx==3.1
sympy==1.12
pandas==2.0.3
plotly==5.16.0
'''