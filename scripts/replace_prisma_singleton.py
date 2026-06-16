#!/usr/bin/env python3
"""Replace all `const prisma = new PrismaClient()` with imports from shared singleton."""
import os
import re
from pathlib import Path

BACKEND = Path("backend/src")

changes = []
errors = []

for ts_file in BACKEND.rglob("*.ts"):
    if "__tests__" in str(ts_file) and "integration" in str(ts_file):
        # Skip integration tests — they may need their own client
        continue
    
    content = ts_file.read_text()
    if "new PrismaClient()" not in content:
        continue
    
    # Skip the singleton itself
    if str(ts_file).endswith("lib/prisma.ts") or str(ts_file).endswith("utils/prisma.ts"):
        continue
    
    # Calculate relative path from this file to utils/prisma.ts
    rel_parts = ts_file.relative_to(BACKEND).parts
    depth = len(rel_parts) - 1  # Number of directories deep
    prefix = "../" * depth if depth > 0 else "./"
    import_path = f"{prefix}utils/prisma"
    
    # Replace the instantiation with import
    # Pattern 1: const prisma = new PrismaClient();
    new_content = re.sub(
        r'const\s+prisma\s*=\s*new\s+PrismaClient\s*\(\s*\)\s*;',
        f'import prisma from \'{import_path}\';',
        content
    )
    
    # Pattern 2: const prisma = new PrismaClient({ ... });
    new_content = re.sub(
        r'const\s+prisma\s*=\s*new\s+PrismaClient\s*\(\s*\{[^}]*\}\s*\)\s*;',
        f'import prisma from \'{import_path}\';',
        new_content
    )
    
    if new_content != content:
        # Check if there's already an import from utils/prisma
        if f"from '{import_path}'" in new_content and new_content.count(f"from '{import_path}'") > 1:
            # Duplicate import — remove the new one we just added since old one exists
            # Actually, let's just keep one import
            lines = new_content.split('\n')
            seen_import = False
            filtered = []
            for line in lines:
                if f"from '{import_path}'" in line:
                    if not seen_import:
                        seen_import = True
                        filtered.append(line)
                    # Skip duplicate
                else:
                    filtered.append(line)
            new_content = '\n'.join(filtered)
        
        # Remove unused PrismaClient import if no longer needed
        if "PrismaClient" not in new_content.replace("import prisma from", ""):
            # Remove the import line for PrismaClient from @prisma/client
            new_content = re.sub(
                r"import\s+\{\s*PrismaClient\s*\}\s*from\s*['\"]@prisma/client['\"]\s*;\s*\n",
                "",
                new_content
            )
            # Also handle: import { PrismaClient, ... } from '@prisma/client'
            new_content = re.sub(
                r"import\s+\{\s*PrismaClient\s*,\s*",
                "import { ",
                new_content
            )
        
        # Check if PrismaClient is still used (for types etc.)
        if "PrismaClient" in new_content and f"from '{import_path}'" in new_content:
            # Need to keep @prisma/client import for PrismaClient type
            pass
        
        ts_file.write_text(new_content)
        changes.append(str(ts_file.relative_to(Path("."))))

print(f"Updated {len(changes)} files:")
for c in changes:
    print(f"  {c}")
if errors:
    print(f"\nErrors: {errors}")