#!/usr/bin/env python3
"""
Badge Database Generator for Football Badge Attack Game

This script scans the Logos folder structure and generates a comprehensive JSON file
containing all available soccer team badges with their file paths.

Usage:
    python generate_badge_database.py

The script will:
1. Scan all subdirectories in the Logos folder
2. Find all PNG/JPG image files
3. Generate a JSON file with team names and file paths
4. Create a comprehensive database for the game
"""

import os
import json
import re
from pathlib import Path

def clean_team_name(filename):
    """Clean filename to create a readable team name"""
    # Remove file extension
    name = os.path.splitext(filename)[0]
    
    # Remove common suffixes
    suffixes_to_remove = [' FC', ' AFC', ' United', ' City', ' Town', ' Athletic', ' Atletico']
    for suffix in suffixes_to_remove:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    
    # Clean up multiple spaces
    name = re.sub(r'\s+', ' ', name).strip()
    
    return name

def scan_logos_folder(logos_path):
    """Scan the Logos folder and build a database of all badges"""
    badges = []
    
    if not os.path.exists(logos_path):
        print(f"Error: Logos folder not found at {logos_path}")
        return badges
    
    print(f"Scanning Logos folder: {logos_path}")
    
    # Walk through all subdirectories
    for root, dirs, files in os.walk(logos_path):
        # Skip the root Logos folder itself
        if root == logos_path:
            continue
            
        # Extract league name from path
        league_name = os.path.basename(root)
        print(f"  Processing league: {league_name}")
        
        # Process each image file
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                # Create relative path from Logos folder
                relative_path = os.path.relpath(os.path.join(root, file), logos_path)
                
                # Clean team name
                team_name = clean_team_name(file)
                
                # Create badge entry
                badge = {
                    "team": team_name,
                    "badgeUrl": f"Logos/{relative_path.replace(os.sep, '/')}",
                    "league": league_name,
                    "filename": file
                }
                
                badges.append(badge)
                print(f"    Added: {team_name} ({file})")
    
    print(f"\nTotal badges found: {len(badges)}")
    return badges

def generate_json_database(badges, output_file="Logos/badge-list.json"):
    """Generate JSON file with all badge data"""
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # Create the database structure
    database = {
        "metadata": {
            "total_badges": len(badges),
            "generated_at": str(Path().cwd()),
            "description": "Auto-generated badge database for Football Badge Attack game"
        },
        "badges": badges
    }
    
    # Write to JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(database, f, indent=2, ensure_ascii=False)
    
    print(f"\nDatabase saved to: {output_file}")
    print(f"Database contains {len(badges)} badges")

def main():
    """Main function to scan logos and generate database"""
    print("Football Badge Attack - Database Generator")
    print("=" * 50)
    
    # Scan the Logos folder
    logos_path = "Logos"
    badges = scan_logos_folder(logos_path)
    
    if not badges:
        print("No badges found. Please check your Logos folder structure.")
        return
    
    # Generate JSON database
    generate_json_database(badges)
    
    # Show some statistics
    leagues = {}
    for badge in badges:
        league = badge["league"]
        leagues[league] = leagues.get(league, 0) + 1
    
    print(f"\nLeague breakdown:")
    for league, count in sorted(leagues.items()):
        print(f"  {league}: {count} badges")
    
    print(f"\nDatabase generation complete!")
    print("You can now use this database in your Football Badge Attack game.")

if __name__ == "__main__":
    main() 