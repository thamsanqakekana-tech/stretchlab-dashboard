#!/bin/bash
# Setup script for StretchLab Pipeline

echo "=========================================="
echo "StretchLab B2C Pipeline - Setup"
echo "=========================================="
echo ""

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python version: $python_version"

# Create virtual environment
echo ""
echo "[1/5] Creating virtual environment..."
python3 -m venv venv
echo "✓ Virtual environment created"

# Activate virtual environment
echo ""
echo "[2/5] Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"

# Install dependencies
echo ""
echo "[3/5] Installing dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "✓ Dependencies installed"

# Create directory structure
echo ""
echo "[4/5] Creating directory structure..."
mkdir -p data/stretchlab/raw
mkdir -p data/stretchlab/validation
mkdir -p logs
mkdir -p output
echo "✓ Directories created"

# Create sample env file
echo ""
echo "[5/5] Creating sample environment file..."
cat > .env.sample << 'EOF'
# Google Sheets Configuration (Optional)
# If not set, pipeline will export to CSV instead

STRETCHLAB_SHEETS_ID=your_google_sheets_id_here
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
EOF
echo "✓ Sample .env file created"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Place your daily export file in: data/stretchlab/raw/"
echo "   Format: Stretchlab_B2C_DB_Phiwe_YYYY-MM-DD.xlsx"
echo ""
echo "2. (Optional) Place manual tracker in: data/stretchlab/validation/"
echo ""
echo "3. Run the pipeline:"
echo "   python run_pipeline.py"
echo ""
echo "For Google Sheets integration:"
echo "  - Edit .env.sample and rename to .env"
echo "  - Run: source .env"
echo ""
echo "See README.md for detailed documentation"
echo ""
