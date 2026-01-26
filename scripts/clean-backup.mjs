#!/usr/bin/env node
/**
 * Script para limpiar el backup SQL y evitar errores de constraints duplicados
 * Uso: node scripts/clean-backup.mjs [archivo-entrada.sql] [archivo-salida.sql]
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function cleanBackupSQL(sql) {
  let cleaned = sql;
  
  // 1. Para PRIMARY KEY: No eliminar (puede tener dependencias), solo intentar agregar
  // Si ya existe, el error se puede ignorar. Mejor: comentar y dejar que CREATE TABLE IF NOT EXISTS lo maneje
  cleaned = cleaned.replace(
    /ALTER TABLE ONLY "public"\."(\w+)"\s+ADD CONSTRAINT "(\w+)" PRIMARY KEY \("(\w+)"\);/g,
    (match, table, constraint, column) => {
      return `-- PRIMARY KEY ya debería existir si la tabla fue creada con CREATE TABLE IF NOT EXISTS\n` +
             `-- Si la tabla no existe, CREATE TABLE ya crea la PK. Si existe, esta línea fallará pero es seguro ignorar.\n` +
             `-- ALTER TABLE ONLY "public"."${table}" ADD CONSTRAINT "${constraint}" PRIMARY KEY ("${column}");`;
    }
  );
  
  // 2. Para FOREIGN KEY: Eliminar antes de agregar (más seguro)
  // Necesitamos capturar toda la línea FOREIGN KEY completa
  cleaned = cleaned.replace(
    /ALTER TABLE ONLY "public"\."(\w+)"\s+ADD CONSTRAINT "(\w+)" FOREIGN KEY \(([^)]+)\)\s+REFERENCES[^;]+;/g,
    (match, table, constraint, columns) => {
      // Extraer la parte completa de REFERENCES
      const referencesPart = match.match(/REFERENCES[^;]+/)[0];
      return `-- Eliminar constraint si existe antes de crearlo\n` +
             `ALTER TABLE ONLY "public"."${table}" DROP CONSTRAINT IF EXISTS "${constraint}";\n` +
             `ALTER TABLE ONLY "public"."${table}" ADD CONSTRAINT "${constraint}" FOREIGN KEY (${columns}) ${referencesPart};`;
    }
  );
  
  // 2b. Para UNIQUE constraints: Eliminar antes de agregar
  cleaned = cleaned.replace(
    /ALTER TABLE ONLY "public"\."(\w+)"\s+ADD CONSTRAINT "(\w+)" UNIQUE \(([^)]+)\);/g,
    (match, table, constraint, columns) => {
      return `-- Eliminar constraint UNIQUE si existe antes de crearlo\n` +
             `ALTER TABLE ONLY "public"."${table}" DROP CONSTRAINT IF EXISTS "${constraint}";\n` +
             `ALTER TABLE ONLY "public"."${table}" ADD CONSTRAINT "${constraint}" UNIQUE (${columns});`;
    }
  );
  
  // 2c. Para CHECK constraints: Eliminar antes de agregar
  cleaned = cleaned.replace(
    /ALTER TABLE ONLY "public"\."(\w+)"\s+ADD CONSTRAINT "(\w+)" CHECK \(([^)]+)\);/g,
    (match, table, constraint, checkExpr) => {
      return `-- Eliminar constraint CHECK si existe antes de crearlo\n` +
             `ALTER TABLE ONLY "public"."${table}" DROP CONSTRAINT IF EXISTS "${constraint}";\n` +
             `ALTER TABLE ONLY "public"."${table}" ADD CONSTRAINT "${constraint}" CHECK (${checkExpr});`;
    }
  );
  
  // 3. Cambiar CREATE ROLE para evitar errores si ya existe
  cleaned = cleaned.replace(
    /^CREATE ROLE /gm,
    '-- CREATE ROLE (comentado para evitar errores)\n-- CREATE ROLE '
  );
  
  // 4. Cambiar ALTER ROLE para evitar errores
  cleaned = cleaned.replace(
    /^ALTER ROLE /gm,
    '-- ALTER ROLE (comentado para evitar errores)\n-- ALTER ROLE '
  );
  
  // 5. Cambiar GRANT/REVOKE de roles que pueden no existir
  cleaned = cleaned.replace(
    /^(GRANT|REVOKE).*TO (anon|authenticated|service_role|supabase_admin)/gim,
    '-- $& (comentado para evitar errores)'
  );
  
  // 6. Para índices: Eliminar antes de crear
  // CREATE INDEX con o sin IF NOT EXISTS
  cleaned = cleaned.replace(
    /CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?"(\w+)" ON "public"\."(\w+)"[^;]+;/g,
    (match, indexName, tableName) => {
      // Extraer el resto del comando (ON ... USING ... etc)
      const indexDef = match.replace(/CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?"\w+" /, '');
      const isUnique = match.includes('UNIQUE');
      return `-- Eliminar índice si existe antes de crearlo\n` +
             `DROP INDEX IF EXISTS "public"."${indexName}";\n` +
             `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX "${indexName}" ${indexDef}`;
    }
  );
  
  // 7. Para políticas RLS: Eliminar antes de crear
  // CREATE POLICY puede tener nombres con espacios, necesitamos capturar hasta el punto y coma
  cleaned = cleaned.replace(
    /CREATE POLICY "([^"]+)"\s+ON "public"\."(\w+)"[^;]+;/g,
    (match, policyName, tableName) => {
      // Extraer el resto del comando (AS ... FOR ... USING ... etc)
      const policyDef = match.replace(/CREATE POLICY "[^"]+"\s+ON "public"\."\w+"\s+/, '');
      return `-- Eliminar política si existe antes de crearla\n` +
             `DROP POLICY IF EXISTS "${policyName}" ON "public"."${tableName}";\n` +
             `CREATE POLICY "${policyName}" ON "public"."${tableName}" ${policyDef}`;
    }
  );
  
  // 8. Para INSERTs: Agregar ON CONFLICT DO NOTHING para evitar errores de duplicados
  // Procesar línea por línea para manejar INSERTs multilínea
  const lines = cleaned.split('\n');
  let inInsert = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detectar inicio de INSERT
    if (trimmed.match(/^INSERT INTO "public"\."\w+"/) && !trimmed.includes('ON CONFLICT')) {
      inInsert = true;
    }
    
    // Si estamos en un INSERT y encontramos el punto y coma final
    // (la línea termina con ');' o solo ';' y no tiene coma antes)
    if (inInsert && trimmed.endsWith(';') && !trimmed.endsWith(',')) {
      // Agregar ON CONFLICT antes del punto y coma
      lines[i] = line.replace(/;(\s*)$/, ' ON CONFLICT DO NOTHING;$1');
      inInsert = false;
    }
  }
  
  cleaned = lines.join('\n');
  
  return cleaned;
}

function main() {
  const inputFile = process.argv[2] || join(__dirname, '..', 'backups', 'backup-2026-01-23-142233.sql');
  const outputFile = process.argv[3] || join(__dirname, '..', 'backups', 'backup-2026-01-23-142233-cleaned.sql');
  
  console.log('Limpiando backup SQL...');
  console.log(`Entrada: ${inputFile}`);
  console.log(`Salida: ${outputFile}`);
  
  try {
    const sql = readFileSync(inputFile, 'utf8');
    const cleaned = cleanBackupSQL(sql);
    
    writeFileSync(outputFile, cleaned, 'utf8');
    
    console.log('✓ Backup limpiado exitosamente!');
    console.log(`\nArchivo generado: ${outputFile}`);
    console.log('\nAhora puedes ejecutar el archivo limpiado en el SQL Editor.');
    
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

main();
