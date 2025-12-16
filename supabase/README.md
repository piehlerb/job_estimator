# Supabase Database Setup

This folder contains the SQL files needed to set up the Job Estimator database in Supabase.

## Files

- **`schema.sql`** - Complete database schema with all tables, indexes, and triggers
- **`policies.sql`** - Row-Level Security (RLS) policies to ensure data privacy

## Setup Instructions

### 1. Create Supabase Project
1. Go to https://supabase.com and sign in
2. Create a new project
3. Wait for project provisioning to complete

### 2. Run Schema SQL
1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `schema.sql`
4. Paste into the SQL editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. Wait for completion (should show "Success. No rows returned")

### 3. Run Policies SQL
1. Still in the SQL Editor, click **"New query"** again
2. Copy the entire contents of `policies.sql`
3. Paste into the SQL editor
4. Click **"Run"**
5. Wait for completion

### 4. Verify Setup

#### Check Tables Were Created
1. Go to **Table Editor** in the left sidebar
2. You should see these tables:
   - `systems`
   - `pricing_variables`
   - `costs`
   - `laborers`
   - `chip_blends`
   - `jobs`
   - `chip_inventory`
   - `topcoat_inventory`
   - `basecoat_inventory`
   - `misc_inventory`
   - `sync_queue`
   - `sync_log`
   - `user_preferences`

#### Verify RLS is Enabled
1. In SQL Editor, run this query:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
2. All tables should show `rowsecurity = true`

#### Check Policies
1. In SQL Editor, run:
```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
2. You should see 4 policies per table (SELECT, INSERT, UPDATE, DELETE)

## Database Schema Overview

### Core Tables
- **systems** - Chip system configurations (equipment/product lines)
- **pricing_variables** - Dynamic pricing variables
- **costs** - Material cost structure (singleton per user)
- **laborers** - Labor rates and worker information
- **chip_blends** - Available chip blend names
- **jobs** - Job estimation records with historical snapshots

### Inventory Tables (Singleton per user)
- **chip_inventory** - Chip inventory by blend
- **topcoat_inventory** - Top coat inventory levels
- **basecoat_inventory** - Base coat inventory levels
- **misc_inventory** - Miscellaneous inventory (crack repair, silica sand, shot)

### Sync Management
- **sync_queue** - Pending sync operations for offline support
- **sync_log** - Audit trail of sync operations
- **user_preferences** - User-specific preferences and settings

## Security

### Row-Level Security (RLS)
All tables have RLS enabled with policies that ensure:
- Users can only see their own data
- Users cannot access other users' data
- All operations (SELECT, INSERT, UPDATE, DELETE) are restricted to the authenticated user's records

### Field Naming Convention
- SQL uses snake_case (e.g., `user_id`, `created_at`)
- TypeScript uses camelCase (e.g., `userId`, `createdAt`)
- The app will handle conversion between these conventions

## Troubleshooting

### "Permission denied" errors
- Make sure you ran `policies.sql` after `schema.sql`
- Verify RLS is enabled on all tables
- Check that you're authenticated when querying from the app

### Schema changes
If you need to modify the schema:
1. Make changes in `schema.sql`
2. Drop and recreate the database, OR
3. Write migration SQL for specific changes

### Reset database
To start fresh (WARNING: deletes all data):
```sql
-- Drop all tables
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS sync_log CASCADE;
DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS misc_inventory CASCADE;
DROP TABLE IF EXISTS basecoat_inventory CASCADE;
DROP TABLE IF EXISTS topcoat_inventory CASCADE;
DROP TABLE IF EXISTS chip_inventory CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS chip_blends CASCADE;
DROP TABLE IF EXISTS laborers CASCADE;
DROP TABLE IF EXISTS costs CASCADE;
DROP TABLE IF EXISTS pricing_variables CASCADE;
DROP TABLE IF EXISTS systems CASCADE;

-- Then re-run schema.sql and policies.sql
```

## Next Steps

After setting up the database:
1. Get your API credentials from Project Settings → API
2. Add credentials to `.env.local` in the project root
3. Test the connection from the app
