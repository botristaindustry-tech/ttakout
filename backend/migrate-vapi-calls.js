require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.RENDER_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Error: Please provide a RENDER_DB_URL or DATABASE_URL environment variable.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString.includes('render.com') || connectionString.includes('supabase')
    ? { rejectUnauthorized: false }
    : false
});

async function run() {
  console.log('Connected to database at:', connectionString.split('@')[1] || 'Unknown Host');
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vapi_calls (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(255) UNIQUE NOT NULL,
        cost NUMERIC(10,4) NOT NULL DEFAULT 0,
        ended_reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Successfully created vapi_calls table.');
    
    // Ensure the jsonb credit balance exists
    await pool.query(`
      INSERT INTO app_settings (key, value) 
      VALUES ('vapi_credit_balance', '0.00'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('✓ Ensured vapi_credit_balance setting exists.');
    
  } catch (err) {
    console.error('✗ Error running migration:', err);
  } finally {
    await pool.end();
  }
}

run();
