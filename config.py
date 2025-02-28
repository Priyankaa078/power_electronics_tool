class Config:
    SECRET_KEY = 'your-secret-key-here'  # Change this to a random string in production
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'json', 'xml'}
    DEBUG = True
    # Simulation settings
    MAX_SIMULATION_TIME = 1.0  # seconds
    DEFAULT_STEP_SIZE = 1e-6   # seconds
    MAX_ITERATIONS = 10000