/**
 * Import Device Inventory from Excel (Device_Inventory.xlsx) into the CWC Asset system.
 *
 * Usage:
 *   npx tsx prisma/import-devices.ts [--dry-run] [--update] [--file path/to/file.xlsx]
 *
 * Options:
 *   --dry-run     Parse and show what would be imported, but don't write to DB
 *   --update      Upsert mode: insert new assets + update existing ones by assetTag
 *   --file        Path to the XLSX file (default: ../../docs/Device_Inventory.xlsx)
 *
 * Modes:
 *   Default (insert-only):  Skip rows where assetTag already exists
 *   --update (upsert):      Insert new rows; update existing rows by assetTag
 *
 * Mapping:
 *   Sheet "Laptops | Desktops" → Asset category LAPTOP/DESKTOP
 *     - Device name      → name
 *     - Serial number    → serialNumber
 *     - Manufacturer     → brand
 *     - Model            → model
 *     - Category         → category (Laptop→LAPTOP, Desktop→DESKTOP)
 *     - Asset tag        → assetTag
 *     - Primary user email → user lookup for assignment
 *     - OS, Encrypted, JoinType, Arch., Entities, Remarks2, Previous Used By → notes
 *
 *   Sheet "Printers" → Asset category PRINTER
 *     - Model           → brand
 *     - Printer         → model + combined into name
 *     - Vendor          → vendor
 *     - Contact No.     → notes
 *     - Venue           → notes
 *     - Asset tag       → auto-generated (CG-MY-PRN-NNN)
 */

import * as XLSX from 'xlsx';
import { PrismaClient, AssetCategory, AssetStatus } from '@prisma/client';
import * as path from 'path';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const UPDATE_MODE = process.argv.includes('--update');
const fileArg = process.argv.findIndex(a => a === '--file');
const XLSX_PATH = fileArg >= 0
  ? path.resolve(process.argv[fileArg + 1])
  : path.resolve(__dirname, '../../docs/Device_Inventory.xlsx');

const ADMIN_ID = '65718092-6fed-42fb-b478-96fbf77b58d6'; // admin@test.local

// Category mapping from Excel values to Prisma enum
function mapCategory(excelCategory: string): AssetCategory {
  const lower = excelCategory.toLowerCase().trim();
  if (lower === 'laptop') return AssetCategory.LAPTOP;
  if (lower === 'desktop') return AssetCategory.DESKTOP;
  return AssetCategory.OTHER;
}

// Build notes from extra fields
function buildDeviceNotes(row: Record<string, any>): string {
  const parts: string[] = [];
  if (row['OS']) parts.push(`OS: ${row['OS']}`);
  if (row['SkuFamily']) parts.push(`SKU: ${row['SkuFamily']}`);
  if (row['JoinType']) parts.push(`Join: ${row['JoinType']}`);
  if (row['Arch.']) parts.push(`Arch: ${row['Arch.']}`);
  if (row['Encrypted']) parts.push(`Encrypted: ${row['Encrypted']}`);
  if (row['Entities']) parts.push(`Entity: ${row['Entities']}`);
  if (row['Previous Used By']) parts.push(`Previous user: ${row['Previous Used By']}`);
  if (row['Remarks2']) parts.push(`Remarks: ${row['Remarks2']}`);
  return parts.join(' | ');
}

function buildPrinterNotes(row: Record<string, any>): string {
  const parts: string[] = [];
  if (row['Contact No.']) parts.push(`Contact: ${String(row['Contact No.']).replace(/\n/g, '; ')}`);
  if (row['Venue']) parts.push(`Venue: ${row['Venue']}`);
  return parts.join(' | ');
}

async function main() {
  const modeLabel = DRY_RUN
    ? 'DRY RUN (no writes)'
    : UPDATE_MODE
      ? 'UPSERT (insert + update)'
      : 'INSERT (skip duplicates)';

  console.log(`\n========================================`);
  console.log(`CWC Device Inventory Import`);
  console.log(`========================================`);
  console.log(`File: ${XLSX_PATH}`);
  console.log(`Mode: ${modeLabel}\n`);

  // Read XLSX
  const workbook = XLSX.readFile(XLSX_PATH);

  const results = {
    imported: 0,
    updated: 0,
    skipped: 0,
    warnings: [] as string[],
    errors: [] as string[],
  };

  // ── Sheet 1: Laptops | Desktops ──────────────────────────────────
  const deviceSheet = workbook.Sheets['Laptops | Desktops'];
  if (!deviceSheet) {
    throw new Error('Sheet "Laptops | Desktops" not found');
  }
  const deviceRows = XLSX.utils.sheet_to_json<Record<string, any>>(deviceSheet);

  console.log(`[Laptops | Desktops] ${deviceRows.length} rows found`);

  for (let i = 0; i < deviceRows.length; i++) {
    const row = deviceRows[i];
    const rowLabel = `Row ${i + 2}`;

    const assetTag = String(row['Asset tag'] || '').trim();
    const name = String(row['Device name'] || '').trim();
    const serialNumber = String(row['Serial number'] || '').trim() || null;
    const category = mapCategory(String(row['Category'] || ''));
    const brand = String(row['Manufacturer'] || '').trim() || null;
    const model = String(row['Model'] || '').trim() || null;
    const primaryEmail = String(row['Primary user email address'] || '').trim();
    const primaryDisplayName = String(row['Primary user display name'] || '').trim();
    const notes = buildDeviceNotes(row);

    // Validation
    if (!assetTag) {
      results.errors.push(`${rowLabel}: Missing assetTag — skipped`);
      results.skipped++;
      continue;
    }
    if (!name) {
      results.errors.push(`${rowLabel}: Missing device name — skipped`);
      results.skipped++;
      continue;
    }

    // Resolve user by email (skip non-email values like "Available", "Server Admin")
    const isActualEmail = primaryEmail.includes('@') && primaryEmail.includes('.');
    let resolvedUserId: string | null = null;
    if (primaryEmail && isActualEmail) {
      if (!DRY_RUN) {
        const user = await prisma.user.findFirst({
          where: { email: primaryEmail, isActive: true },
        });
        if (user) {
          resolvedUserId = user.id;
        } else {
          results.warnings.push(`${rowLabel}: Email "${primaryEmail}" not found in system — treated as IN_STOCK`);
        }
      } else {
        results.warnings.push(`${rowLabel}: Would attempt user lookup for "${primaryEmail}"`);
      }
    }

    // Build comprehensive notes including display name for reference
    const enrichedNotes = [
      notes,
      primaryDisplayName && !resolvedUserId ? `Original user: ${primaryDisplayName} (${primaryEmail})` : null,
      primaryDisplayName && resolvedUserId ? `User: ${primaryDisplayName}` : null,
    ].filter(Boolean).join(' | ');

    const targetStatus = resolvedUserId ? AssetStatus.ASSIGNED : AssetStatus.IN_STOCK;

    // ── Check for existing asset ──
    if (!DRY_RUN) {
      const existing = await prisma.asset.findUnique({ where: { assetTag } });

      if (existing && !UPDATE_MODE) {
        // Insert-only mode: skip duplicates
        results.warnings.push(`${rowLabel}: assetTag "${assetTag}" already exists — skipped (use --update to overwrite)`);
        results.skipped++;
        continue;
      }

      if (existing && UPDATE_MODE) {
        // Upsert mode: update existing record
        await prisma.asset.update({
          where: { id: existing.id },
          data: {
            serialNumber,
            name,
            category,
            brand,
            model,
            notes: enrichedNotes || null,
            // Don't overwrite status if asset is in a workflow state (IN_REPAIR, PENDING_RETURN, etc.)
            ...(![AssetStatus.IN_REPAIR, AssetStatus.PENDING_RETURN, AssetStatus.RETIRED, AssetStatus.DISPOSED].includes(existing.status as AssetStatus)
              ? { status: targetStatus }
              : {}),
          },
        });

        // Handle assignment changes
        const openAssignment = await prisma.assetAssignment.findFirst({
          where: { assetId: existing.id, returnedAt: null },
        });

        if (resolvedUserId && !openAssignment) {
          // User found, no existing assignment → create one
          await prisma.assetAssignment.create({
            data: {
              assetId: existing.id,
              userId: resolvedUserId,
              assignedById: ADMIN_ID,
              reason: 'imported/updated from Device_Inventory.xlsx',
            },
          });
        } else if (!resolvedUserId && openAssignment) {
          // No user in Excel, but has assignment → return the asset
          await prisma.assetAssignment.update({
            where: { id: openAssignment.id },
            data: { returnedAt: new Date(), notes: 'Unassigned via import update' },
          });
        } else if (resolvedUserId && openAssignment && openAssignment.userId !== resolvedUserId) {
          // User changed → return old, assign new
          await prisma.assetAssignment.update({
            where: { id: openAssignment.id },
            data: { returnedAt: new Date(), notes: 'Reassigned via import update' },
          });
          await prisma.assetAssignment.create({
            data: {
              assetId: existing.id,
              userId: resolvedUserId,
              assignedById: ADMIN_ID,
              reason: 'reassigned from Device_Inventory.xlsx update',
            },
          });
        }

        console.log(`  [UPD] ${assetTag} | ${name} | ${category} | ${primaryEmail || 'no user'}`);
        results.updated++;
        continue;
      }
    }

    // Duplicate check by serialNumber (for inserts only)
    if (!DRY_RUN && serialNumber) {
      const dupSerial = await prisma.asset.findFirst({ where: { serialNumber } });
      if (dupSerial) {
        results.warnings.push(`${rowLabel}: serialNumber "${serialNumber}" already exists on a different assetTag — skipped`);
        results.skipped++;
        continue;
      }
    }

    console.log(`  ${DRY_RUN ? '[DRY]' : '[NEW]'} ${assetTag} | ${name} | ${category} | ${primaryEmail || 'no user'}`);

    if (DRY_RUN) {
      results.imported++;
      continue;
    }

    // Create asset
    const asset = await prisma.asset.create({
      data: {
        assetTag,
        serialNumber,
        name,
        category,
        brand,
        model,
        status: targetStatus,
        notes: enrichedNotes || null,
        createdById: ADMIN_ID,
      },
    });

    // If user resolved, create assignment
    if (resolvedUserId) {
      await prisma.assetAssignment.create({
        data: {
          assetId: asset.id,
          userId: resolvedUserId,
          assignedById: ADMIN_ID,
          reason: 'imported from Device_Inventory.xlsx',
        },
      });
    }

    results.imported++;
  }

  // ── Sheet 2: Printers ───────────────────────────────────────────
  const printerSheet = workbook.Sheets['Printers'];
  if (printerSheet) {
    const printerRows = XLSX.utils.sheet_to_json<Record<string, any>>(printerSheet);
    console.log(`\n[Printers] ${printerRows.length} rows found`);

    let printerCounter = 1;
    for (let i = 0; i < printerRows.length; i++) {
      const row = printerRows[i];
      const rowLabel = `Printer Row ${i + 2}`;

      const prtBrand = String(row['Model'] || '').trim();
      const prtModel = String(row['Printer'] || '').trim();
      const prtVendor = String(row['Vendor'] || '').trim() || null;
      const prtNotes = buildPrinterNotes(row);

      // Auto-generate asset tag
      const prtAssetTag = `CG-MY-PRN-${String(printerCounter).padStart(3, '0')}`;
      const prtName = `${prtBrand} ${prtModel}`.trim();

      if (!prtName) {
        results.errors.push(`${rowLabel}: Missing printer model/name — skipped`);
        results.skipped++;
        printerCounter++;
        continue;
      }

      if (!DRY_RUN) {
        const existing = await prisma.asset.findFirst({ where: { assetTag: prtAssetTag } });

        if (existing && !UPDATE_MODE) {
          results.warnings.push(`${rowLabel}: assetTag "${prtAssetTag}" already exists — skipped (use --update to overwrite)`);
          results.skipped++;
          printerCounter++;
          continue;
        }

        if (existing && UPDATE_MODE) {
          await prisma.asset.update({
            where: { id: existing.id },
            data: {
              name: prtName,
              brand: prtBrand || null,
              model: prtModel || null,
              vendor: prtVendor,
              notes: prtNotes || null,
            },
          });
          console.log(`  [UPD] ${prtAssetTag} | ${prtName} | PRINTER | ${prtVendor || 'no vendor'}`);
          results.updated++;
          printerCounter++;
          continue;
        }
      }

      console.log(`  ${DRY_RUN ? '[DRY]' : '[NEW]'} ${prtAssetTag} | ${prtName} | PRINTER | ${prtVendor || 'no vendor'}`);

      if (DRY_RUN) {
        results.imported++;
        printerCounter++;
        continue;
      }

      await prisma.asset.create({
        data: {
          assetTag: prtAssetTag,
          serialNumber: null,
          name: prtName,
          category: AssetCategory.PRINTER,
          brand: prtBrand || null,
          model: prtModel || null,
          vendor: prtVendor,
          status: 'IN_STOCK',
          notes: prtNotes || null,
          createdById: ADMIN_ID,
        },
      });

      results.imported++;
      printerCounter++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Import Summary`);
  console.log(`========================================`);
  console.log(`  New     : ${results.imported}`);
  console.log(`  Updated : ${results.updated}`);
  console.log(`  Skipped : ${results.skipped}`);
  console.log(`  Warnings: ${results.warnings.length}`);
  console.log(`  Errors  : ${results.errors.length}`);

  if (results.warnings.length > 0) {
    console.log(`\nWarnings:`);
    results.warnings.forEach(w => console.log(`  - ${w}`));
  }
  if (results.errors.length > 0) {
    console.log(`\nErrors:`);
    results.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (DRY_RUN) {
    console.log(`\n(Dry run — no data was written to the database)`);
  }
}

main()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());