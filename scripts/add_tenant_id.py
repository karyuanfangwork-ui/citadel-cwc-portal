import re

with open("backend/prisma/schema.prisma", "r") as f:
    content = f.read()

models = [
    "Request", "Asset", "CrmLead", "CrmAccount", "CrmOpportunity", "CrmContact", 
    "CrmPipeline", "CreditApplication", "KnowledgeBaseArticle", "Notification",
    "AuditLog", "Announcement", "OnboardingRequest", "OffboardingRequest", 
    "Candidate", "Branch", "Entity", "ServiceDesk", "ServiceCategory", 
    "RequestType", "EscalationRule", "SystemSetting", "FeatureFlag", "NotificationTemplate"
]

for model in models:
    # Find model block start
    model_start = content.find(f'model {model} {{')
    if model_start == -1:
        print(f"WARNING: Could not find model {model}")
        continue
    
    # Find the end of this model block
    next_model = content.find('\nmodel ', model_start + 1)
    model_end = len(content) if next_model == -1 else next_model
    model_block = content[model_start:model_end]
    
    # Check if tenantId already exists in this model
    if 'tenantId' in model_block:
        print(f"SKIP: {model} already has tenantId")
        continue
    
    # Find the id field line and insert tenantId after it
    # Pattern: id followed by type info, at the start of a line within the model
    id_pattern = re.compile(r'(\n  id\s+String\s+@id[^\n]*\n)')
    id_match = id_pattern.search(model_block)
    if id_match:
        # Calculate absolute position
        abs_insert = model_start + id_match.end()
        tenant_line = '  tenantId  String  @map("tenant_id") @db.Uuid\n'
        content = content[:abs_insert] + tenant_line + content[abs_insert:]
        print(f"Added tenantId to {model}")
        # Recalculate positions since content shifted
    else:
        print(f"WARNING: Could not find id field for {model}")

# Now add @@index([tenantId]) before @@map for each model (second pass since positions shifted)
for model in models:
    model_start = content.find(f'model {model} {{')
    if model_start == -1:
        print(f"WARNING: Could not find model {model}")
        continue
    
    next_model = content.find('\nmodel ', model_start + 1)
    model_end = len(content) if next_model == -1 else next_model
    model_block = content[model_start:model_end]
    
    if '@@index([tenantId])' in model_block:
        print(f"SKIP: {model} already has @@index([tenantId])")
        continue
    
    # Find @@map in this block
    map_match = re.search(r'  @@map\("[^"]+"\)', model_block)
    if map_match:
        abs_pos = model_start + map_match.start()
        index_line = '  @@index([tenantId])\n'
        content = content[:abs_pos] + index_line + content[abs_pos:]
        print(f"Added @@index([tenantId]) to {model}")
    else:
        print(f"WARNING: No @@map found for {model}")

with open("backend/prisma/schema.prisma", "w") as f:
    f.write(content)

print("Done!")