const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres.xqjoxlsldigiecfiqxdn:super-queque67@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

async function dumpDatabase() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    // Override SSL certificate validation
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    await client.connect();
    console.log('Connected to database');

    let dumpContent = '-- SONDAR Database Dump\n';
    dumpContent += `-- Generated at ${new Date().toISOString()}\n\n`;

    // Get all tables in public schema
    const tablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    const tablesResult = await client.query(tablesQuery);
    const tables = tablesResult.rows.map(r => r.tablename);

    console.log(`Found ${tables.length} tables`);

    // For each table, get CREATE TABLE and INSERT statements
    for (const tableName of tables) {
      console.log(`Processing table: ${tableName}`);
      
      // Get table structure using information_schema
      const columnsResult = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      // Generate CREATE TABLE statement
      let createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
      const columnDefs = columnsResult.rows.map(col => {
        let def = `  "${col.column_name}" ${col.data_type}`;
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        if (col.is_nullable === 'NO') {
          def += ` NOT NULL`;
        }
        return def;
      }).join(',\n');

      createTableSQL += columnDefs + '\n);\n\n';
      dumpContent += createTableSQL;

      // Get all data from the table
      const dataResult = await client.query(`SELECT * FROM "${tableName}";`);

      if (dataResult.rows.length > 0) {
        console.log(`  - Exporting ${dataResult.rows.length} rows`);
        
        // Get column names
        const columns = columnsResult.rows.map(c => `"${c.column_name}"`).join(', ');

        for (const row of dataResult.rows) {
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
            if (typeof v === 'boolean') return v ? 'true' : 'false';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');

          dumpContent += `INSERT INTO "${tableName}" (${columns}) VALUES (${values});\n`;
        }
        dumpContent += '\n';
      }
    }

    // Add triggers and functions if they exist
    const triggersResult = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      LIMIT 5;
    `);

    fs.writeFileSync('database_sondar.sql', dumpContent);
    console.log(`\nDatabase dumped successfully to database_sondar.sql (${Math.round(dumpContent.length / 1024)}KB)`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

dumpDatabase();
