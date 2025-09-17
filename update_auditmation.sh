#!/bin/bash

# List of all PR numbers
PRS=(78 77 76 75 74 73 72 71 70 69 68 67 66 65 64 63 62 60 59 58 57 56 55 54 53 52 51 50 49 48 47 46 45 44 43 42 41 40 39 38 37 36 35 34 33 32 31 30 29 28 27)

# Function to extract framework name from PR title
get_framework_from_pr() {
    local pr_num=$1
    local title=$(gh pr view $pr_num --json title -q .title)
    # Extract the framework part after the last /
    echo "$title" | sed 's/.*2025_2_1_//'
}

# Function to update package.json
update_package_json() {
    local pr_num=$1
    local framework=$2
    
    echo "Processing PR #$pr_num: $framework"
    
    # Checkout the PR
    gh pr checkout $pr_num
    
    # Find the package.json file
    local pkg_path="package/complianceforge/scf/2025_2_1_${framework}/package.json"
    
    if [ -f "$pkg_path" ]; then
        # Read current package.json
        local current_value=$(grep -A 1 '"auditmation"' "$pkg_path" | grep '"package"' | sed 's/.*"package": "//' | sed 's/",$//')
        
        # Create new value
        local new_value="complianceforge.scf.2025_2_1_${framework}.crosswalk"
        
        # Update the file
        sed -i '' "s|\"package\": \"${current_value}\"|\"package\": \"${new_value}\"|" "$pkg_path"
        
        # Commit and push
        git add "$pkg_path"
        git commit -m "fix: update auditmation.package to follow standard convention"
        git push origin HEAD
        
        echo "✓ PR #$pr_num updated successfully"
    else
        echo "✗ PR #$pr_num: package.json not found at $pkg_path"
    fi
}

# Process all PRs
for pr in "${PRS[@]}"; do
    # Skip PR 78 as it's already done
    if [ "$pr" -eq 78 ]; then
        echo "Skipping PR #78 (already updated)"
        continue
    fi
    
    framework=$(get_framework_from_pr $pr)
    update_package_json $pr "$framework"
done

echo "All PRs processed!"