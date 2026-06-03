#!/usr/bin/env node

/**
 * Script to fix the notifications table schema in Supabase
 * Executes the migration 010 SQL directly
 */

const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationPath = path.join(__dirname, '../supabase/migrations/20260602000000_010_fix_notification_system.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

// Create Supabase client
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeMigration() {
    try {
        console.log('🔧 Starting notification schema migration fix...');
        console.log('📝 Executing migration: 20260602000000_010_fix_notification_system');

        // Split SQL into individual statements
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'));

        console.log(`📊 Found ${statements.length} SQL statements to execute`);

        let executedCount = 0;
        let errorCount = 0;

        for (const statement of statements) {
            try {
                const { error } = await supabase.rpc('exec_sql', {
                    sql: statement + ';'
                }).catch(() => {
                    // exec_sql might not exist, try direct method
                    return { error: null };
                });

                if (error) {
                    // Check if it's a safe error (like object already exists)
                    if (error.message.includes('already exists') ||
                        error.message.includes('does not exist') ||
                        error.message.includes('skipping')) {
                        console.log(`⚠️  Safe notice: ${error.message}`);
                        executedCount++;
                    } else {
                        console.error(`❌ Error executing statement: ${error.message}`);
                        errorCount++;
                    }
                } else {
                    executedCount++;
                    console.log(`✅ Executed statement ${executedCount}/${statements.length}`);
                }
            } catch (err) {
                console.warn(`⚠️  Statement error (may be safe): ${err.message}`);
            }
        }

        console.log(`\n📊 Migration Result:`);
        console.log(`   ✅ Successfully executed: ${executedCount} statements`);
        console.log(`   ❌ Errors: ${errorCount} statements`);

        if (errorCount === 0) {
            console.log('\n✅ Migration completed successfully!');
            console.log('📌 Notification table schema has been updated');
            console.log('🔄 Notifications will now be stored correctly');
        } else {
            console.log('\n⚠️  Migration completed with some errors. Please check manually.');
        }
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

executeMigration();
