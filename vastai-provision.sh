#!/bin/bash
set -eo pipefail

# Replace the default SwarmUI clone with your fork
cd /workspace
if [ -d "SwarmUI" ]; then
    echo "Backing up existing SwarmUI installation..."
    mv SwarmUI SwarmUI.backup.$(date +%s)
fi

echo "Cloning modpotato/SwarmUI fork..."
git clone https://github.com/modpotato/SwarmUI
cd SwarmUI

# Optionally checkout a specific branch if needed
# git checkout your-branch-name

echo "SwarmUI fork installed successfully!"
echo "Restarting SwarmUI service..."
supervisorctl restart swarmui
