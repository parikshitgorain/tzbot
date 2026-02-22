#!/usr/bin/env tsx
/**
 * Setup script for test database
 * Creates the test database if it doesn't exist
 */

import { Client } from 'pg';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

async function setupTestDatabase() {
  // Connect to postgres database to create test database
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Check if test database exists
    const dbName = process.env.DB_NAME || 'tzbot_test';
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      // Create test database
      console.log(`Creating test database: ${dbName}`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log('Test database created successfully');
    } else {
      console.log(`Test database ${dbName} already exists`);
    }
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupTestDatabase();
