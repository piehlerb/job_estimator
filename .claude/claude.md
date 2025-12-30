# Job Estimator - Development Guide

This document provides guidance for making changes to the Job Estimator application, particularly when adding new fields to data models.

## Architecture Overview

The app uses a three-tier data architecture:
1. **IndexedDB (Local)** - Client-side storage using camelCase naming
2. **Supabase (Remote)** - PostgreSQL database using snake_case naming
3. **JSON Backups** - Full export/import functionality

All three layers are kept in sync automatically through the sync and backup systems.

## Install Day Scheduling

All jobs use per-day scheduling where you specify hours and laborers for each individual install day:

**How it works:**
- Set the number of install days (e.g., 3 days)
- For each day, specify:
  - Hours for that day (e.g., Day 1: 8h, Day 2: 10h, Day 3: 6h)
  - Which laborers work that day
- Calculations use the per-day schedule for all labor and gas costs
- The `jobHours` field stores the sum of all daily hours (for backward compatibility with older code)

**Legacy Data Migration:**
- When loading old jobs without `installSchedule`, the app automatically converts them:
  - Divides total hours evenly across install days
  - Assigns all selected laborers to each day
- Migration happens on-the-fly when editing a job (see `src/lib/jobMigration.ts`)

**Fields:**
- `Job.installSchedule` - Array of `InstallDaySchedule` objects (required for all new/edited jobs)
- Each schedule object contains: `day` (number), `hours` (number), `laborerIds` (string[])
- `Job.jobHours` - Total hours (auto-calculated as sum of daily hours, kept for backward compatibility)

## Adding a New Field to an Existing Type

When adding a new field to any data type (Job, System, Costs, Laborer, etc.), follow this checklist:

### 1. Update TypeScript Type Definition
**File:** `src/types/index.ts`
- Add the field to the appropriate interface
- Use optional fields (`fieldName?: type`) unless the field is required
- Add JSDoc comments if the field needs explanation

Example:
```typescript
export interface Job {
  // ... existing fields ...
  notes?: string; // Optional notes about the job
}
```

### 2. Update the UI (if applicable)
**Files:** `src/pages/*.tsx`, `src/components/*.tsx`
- Add form inputs/displays for the new field
- Update form state initialization
- Update form data loading (for edit mode)
- Update form submission to include the field

### 3. Create Supabase Migration
**Directory:** `supabase/`
- Create a new migration file: `migration_add_<field_name>_column.sql`
- Use `IF NOT EXISTS` to make it safe to re-run
- Add appropriate column type and constraints
- Include helpful comments

Example:
```sql
-- Migration: Add notes field to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN jobs.notes IS 'Additional notes about the job';
```

### 4. Run the Migration
Execute the SQL on your Supabase database:
- **Option A:** Via Supabase Dashboard → SQL Editor
- **Option B:** Via Supabase CLI: `supabase db push`

### 5. Verify Sync and Backup (Usually No Changes Needed!)

The sync and backup systems work at the **object level**, so new fields are automatically included:

**Sync System** (`src/lib/sync.ts`):
- Uses `objectToSnakeCase()` to convert entire objects
- Automatically syncs all fields in the type

**Backup System** (`src/lib/backup.ts`):
- Uses `getAllJobs()`, `getAllSystems()`, etc.
- Exports/imports complete objects with all fields

**When to Update Sync/Backup Code:**
- ❌ Adding a new field to existing type → No changes needed
- ✅ Adding a completely new table/store → Add to sync tables list
- ✅ Changing field names → Update field mapping if needed

### 6. Testing Checklist
After adding a field:
- [ ] Field appears in the UI form
- [ ] Field saves to IndexedDB locally
- [ ] Field syncs to Supabase (check database)
- [ ] Field appears in JSON exports
- [ ] Field restores from JSON imports
- [ ] Existing records work (field should be null/undefined)

## Data Synchronization

### How Sync Works
The sync engine (`src/lib/sync.ts`) automatically handles field-level synchronization:

1. **Push to Supabase:**
   - Reads all local records using `getAll*ForSync()` functions
   - Converts camelCase → snake_case
   - Upserts to Supabase with `user_id`

2. **Pull from Supabase:**
   - Fetches records updated since last sync
   - Converts snake_case → camelCase
   - Resolves conflicts using "last write wins"
   - Updates IndexedDB

3. **Conflict Resolution:**
   - Compares `updatedAt` timestamps
   - Newer timestamp wins
   - Both local and remote updates are preserved

### Field Name Conventions
- **TypeScript/IndexedDB:** Use camelCase (e.g., `googleDriveFolderId`)
- **Supabase:** Use snake_case (e.g., `google_drive_folder_id`)
- **Conversion:** Automatic via `objectToSnakeCase()` and `objectToCamelCase()`

## Backup and Export

### What Gets Backed Up
All data is included in JSON exports:
- Systems, Costs, Laborers, Jobs
- Chip Blends, Inventory (Chip, TopCoat, BaseCoat, Misc)
- All fields on all records (including new fields)

### Export Format
```json
{
  "metadata": {
    "version": 1,
    "exportedAt": "2024-01-01T00:00:00.000Z",
    "appName": "JobEstimator"
  },
  "jobs": [
    {
      "id": "...",
      "name": "...",
      "notes": "...",  // New fields automatically included
      // ... all other fields
    }
  ]
}
```

## Common Patterns

### Optional String Field
```typescript
// Type definition
fieldName?: string;

// Form state
const [formData, setFormData] = useState({
  fieldName: '',
  // ...
});

// Loading existing data
fieldName: record.fieldName || '',

// Saving
fieldName: formData.fieldName || undefined,
```

### Required Field with Default
```typescript
// Type definition
fieldName: string;

// Form state
const [formData, setFormData] = useState({
  fieldName: 'default',
  // ...
});

// Saving
fieldName: formData.fieldName,
```

### JSONB Field (Snapshots)
For complex objects stored in Supabase as JSONB:
```sql
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS snapshot_field JSONB;
```

## Photo Storage

Photos are handled differently:
- **Local:** Base64 in IndexedDB (in `photos` array on Job)
- **Remote:** Uploaded to Google Drive (not Supabase)
- **Sync:** Photo metadata syncs, files upload separately

To disable photo compression (upload full size):
- Photos are converted directly to base64 without the `compressImage()` step
- See `src/components/PhotoCapture.tsx`

## Troubleshooting

### Field Not Syncing
1. Check TypeScript type includes the field
2. Verify Supabase migration ran successfully
3. Check browser console for sync errors
4. Verify field is included when saving: `console.log(job)`

### Field Not in Backup
1. Ensure field is on the TypeScript type
2. Verify backup uses `getAll*()` functions (not manual field lists)
3. Check exported JSON file

### Type Errors After Adding Field
1. Update all places where the type is constructed
2. Check form data initialization
3. Run TypeScript type check: `npm run typecheck`

## File Structure Reference

```
src/
├── types/index.ts           # All TypeScript type definitions
├── lib/
│   ├── db.ts               # IndexedDB operations
│   ├── sync.ts             # Supabase sync engine
│   ├── syncHelpers.ts      # Case conversion utilities
│   └── backup.ts           # JSON export/import
├── pages/
│   ├── JobForm.tsx         # Job creation/editing
│   ├── Dashboard.tsx       # Main jobs list
│   └── ...
└── components/
    └── ...

supabase/
├── schema.sql              # Full database schema
├── policies.sql            # Row-level security
└── migration_*.sql         # Migration files
```

## Best Practices

1. **Always use optional fields** unless truly required (prevents issues with existing data)
2. **Use descriptive migration names** that indicate what changed
3. **Test both new and existing records** after adding fields
4. **Document complex fields** with JSDoc comments
5. **Keep sync automatic** - avoid manual field mappings unless necessary
6. **Use IF NOT EXISTS** in migrations for safety
7. **Version control migrations** - never delete old migration files

## App Versioning

The app version is tracked in **three files** that must be kept in sync:

| File | Constant | Purpose |
|------|----------|---------|
| `package.json` | `version` | npm package version |
| `public/sw.js` | `CACHE_VERSION` | Service worker cache name |
| `src/version.ts` | `APP_VERSION` | Displayed in UI sidebar |

### When to Update Version

Update the version number when deploying changes that users need to see immediately:
- New features
- Bug fixes
- UI changes
- Any code changes

### How to Update Version

1. Increment version in all three files (use semantic versioning: `MAJOR.MINOR.PATCH`)
2. The service worker cache name includes the version, so changing it will:
   - Trigger a new service worker install
   - Delete old caches
   - Force fresh asset downloads

### Version Display

The version is shown in the sidebar footer, bottom-left corner (e.g., "v1.1.0").

### Caching Strategy

The service worker uses different strategies:
- **Network-first**: HTML files, hashed JS/CSS assets (ensures fresh code)
- **Cache-first**: Static assets like images and fonts (better offline performance)
- **Never cached**: Supabase API requests (always fresh data)

## Need Help?

- Check existing fields in `src/types/index.ts` for patterns
- Review recent migration files in `supabase/` directory
- Look at similar UI fields in `src/pages/JobForm.tsx`
- Test sync with: DevTools → Application → IndexedDB
- Check Supabase: Dashboard → Table Editor
