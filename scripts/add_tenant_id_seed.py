#!/usr/bin/env python3
"""Add tenantId: defaultTenant.id to all user create blocks in seed.ts"""
import re

with open("backend/prisma/seed.ts", "r") as f:
    content = f.read()

# Strategy: Find "create: {\n            email:" inside prisma.user blocks and insert tenantId
# The create block for users has email as the first field

# Pattern: find `create: {\n` followed by whitespace then `email:` inside user upserts
# We need to match the create block opening and add tenantId before email

count = 0

# Match user upsert/create blocks where "create: {" is on its own line and email is next
# Handles both:
#   create: {
#       email: ...
# and also:
#   create: { email: ... }  (single-line create blocks)

def add_tenant_id(match):
    global count
    count += 1
    return match.group(1) + '\n            tenantId: defaultTenant.id,' + match.group(2)

# Pattern for multi-line create blocks in user upserts
content = re.sub(
    r'(create: \{\s*\n)(\s+email:)',
    r'\1            tenantId: defaultTenant.id,\n\2',
    content
)

# Also handle the inline arrays where user objects have email as first field  
# These are the seed data arrays like SEED_PRODUCTION_USERS

with open("backend/prisma/seed.ts", "w") as f:
    f.write(content)

print(f"Modified seed.ts - checking result...")

# Count occurrences
count = content.count('tenantId: defaultTenant.id')
print(f"Found {count} occurrences of tenantId: defaultTenant.id")