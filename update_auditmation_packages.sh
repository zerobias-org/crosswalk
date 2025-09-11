#!/bin/bash

cd /Users/danielrojas/local_nfa/zerobias-workspace/repos/crosswalk

# Get all open PR numbers
PRS=$(gh pr list --state open --limit 100 --json number -q '.[].number' | sort -rn)

echo "Found $(echo $PRS | wc -w) open PRs to update"

for pr in $PRS; do
    echo ""
    echo "========================================="
    echo "Processing PR #$pr"
    echo "========================================="
    
    # Skip PR 78 as it's already done
    if [ "$pr" -eq 78 ]; then
        echo "✓ PR #78 already updated"
        continue
    fi
    
    # Checkout the PR
    gh pr checkout $pr
    
    # Find all package.json files in this PR's changes
    pkg_files=$(git diff --name-only origin/main...HEAD | grep "package.json$")
    
    if [ -z "$pkg_files" ]; then
        echo "✗ No package.json files found in PR #$pr"
        continue
    fi
    
    for pkg_file in $pkg_files; do
        if [ -f "$pkg_file" ]; then
            echo "  Updating: $pkg_file"
            
            # Extract the framework name from the path
            # Example path: package/complianceforge/scf/2025_2_1_cn_csl_v1/package.json
            framework=$(echo "$pkg_file" | sed 's|.*/2025_2_1_\([^/]*\)/.*|\1|')
            
            # Convert hyphens to underscores in framework name
            framework_clean=$(echo "$framework" | sed 's/-/_/g')
            
            # Create the new auditmation.package value
            new_package_value="complianceforge.scf.2025_2_1_${framework_clean}.crosswalk"
            
            # Update the package.json file using sed
            # This handles the auditmation.package field
            sed -i '' "s|\"package\": \"[^\"]*_complianceforge_scf_2025_2_1_crosswalk\.crosswalk\"|\"package\": \"${new_package_value}\"|" "$pkg_file"
            
            echo "  ✓ Updated auditmation.package to: $new_package_value"
        fi
    done
    
    # Check if there are changes to commit
    if git diff --quiet; then
        echo "  No changes needed for PR #$pr"
    else
        # Commit and push the changes
        git add -A
        git commit -m "fix: update auditmation.package to follow standard convention"
        git push origin HEAD
        echo "✓ PR #$pr updated and pushed successfully"
    fi
done

echo ""
echo "========================================="
echo "All PRs processed!"
echo "========================================="