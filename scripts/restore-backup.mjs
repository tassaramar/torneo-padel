#!/usr/bin/env node
/**
 * Script para restaurar backup de Supabase usando Node.js
 * Uso: node scripts/restore-backup.mjs [archivo-backup.sql] [connection-string]
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función para leer input del usuario
function question(query) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  log('\n=== Restauración de Backup de Supabase ===\n', 'cyan');

  // 1. Determinar archivo de backup
  let backupFile = process.argv[2];
  if (!backupFile) {
    // Buscar el backup más reciente
    const backupsDir = join(__dirname, '..', 'backups');
    const { readdirSync, statSync } = await import('fs');
    try {
      const files = readdirSync(backupsDir)
        .filter(f => f.endsWith('.sql'))
        .map(f => ({
          name: f,
          path: join(backupsDir, f),
          time: statSync(join(backupsDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time);
      
      if (files.length === 0) {
        log('ERROR: No se encontraron archivos de backup (.sql) en la carpeta backups/', 'red');
        process.exit(1);
      }
      
      backupFile = files[0].path;
      log(`Usando el backup más reciente: ${files[0].name}`, 'gray');
      log(`Fecha: ${files[0].time.toLocaleString()}\n`, 'gray');
    } catch (error) {
      log(`ERROR: No se pudo acceder a la carpeta backups/: ${error.message}`, 'red');
      process.exit(1);
    }
  } else {
    backupFile = resolve(backupFile);
  }

  // Verificar que el archivo existe
  const { existsSync } = await import('fs');
  if (!existsSync(backupFile)) {
    log(`ERROR: El archivo de backup no existe: ${backupFile}`, 'red');
    process.exit(1);
  }

  // 2. Obtener connection string automáticamente
  let connectionString = process.argv[3];
  let password = process.argv[4]; // Contraseña como 4to argumento opcional
  
  if (!connectionString) {
    log('Obteniendo información del proyecto de Supabase...', 'cyan');
    
    try {
      // Intentar obtener project ref del CLI o usar el del .env
      let projectRef = 'mwrruwgviwsngdwwraql'; // Default del .env
      
      try {
        // Intentar obtener del CLI
        const projectsOutput = execSync('supabase projects list --linked -o json', { 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        const projects = JSON.parse(projectsOutput);
        if (projects && projects.length > 0 && projects[0].reference_id) {
          projectRef = projects[0].reference_id;
          log(`Proyecto detectado: ${projects[0].name} (${projectRef})`, 'green');
        }
      } catch (e) {
        // Si falla, usar el default (silenciosamente)
        // El projectRef ya está definido arriba
      }
      
      log('', '');
      
      // Si no se proporcionó contraseña como argumento, pedirla
      if (!password) {
        log('Para completar la conexión, necesito la contraseña de la base de datos.', 'yellow');
        log('Puedes obtenerla o resetearla en:', 'yellow');
        log(`https://supabase.com/dashboard/project/${projectRef}/settings/database`, 'cyan');
        log('');
        log('NOTA: Es mejor usar la connection string completa del dashboard.', 'yellow');
        log('Si tienes la connection string completa, presiona Enter y pégala cuando se solicite.', 'yellow');
        log('');
        password = await question('Ingresa la contraseña de PostgreSQL (o Enter para usar connection string completa): ');
      }
      
      if (password && password.trim()) {
        // Construir connection string usando Session Pooler (recomendado por Supabase)
        // Formato: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
        // Para West US (Oregon): aws-0-us-west-2.pooler.supabase.com
        const poolerHost = `aws-0-us-west-2.pooler.supabase.com`; // West US (Oregon)
        connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${poolerHost}:5432/postgres`;
        log('', '');
        log('✓ Connection string construida con Session Pooler (recomendado).', 'green');
        log('Si la conexión falla, usa la connection string completa del dashboard.', 'gray');
      }
      
      if (!connectionString || (!password || !password.trim())) {
        // Si no proporciona contraseña o no funcionó, pedir connection string completa
        log('', '');
        log('Para obtener tu connection string completa:', 'yellow');
        log(`1. Ve a https://supabase.com/dashboard/project/${projectRef}/settings/database`, 'yellow');
        log('2. En "Connection string", selecciona modo "URI" (Direct connection)', 'yellow');
        log('3. Copia la URI completa (debe comenzar con postgresql://)', 'yellow');
        log('');
        log('TIP: Si la conexión directa no funciona, prueba con "Session" mode (pooler)', 'gray');
        log('');
        connectionString = await question('Ingresa tu connection string completa (postgresql://...): ');
        
        if (!connectionString || !connectionString.startsWith('postgresql://')) {
          log('ERROR: Connection string inválida. Debe comenzar con postgresql://', 'red');
          process.exit(1);
        }
      }
    } catch (error) {
      log('No se pudo obtener información automáticamente. Usando método manual...', 'yellow');
      log('', '');
      log('Para obtener tu connection string de PostgreSQL:', 'yellow');
      log('1. Ve a https://supabase.com/dashboard', 'yellow');
      log('2. Selecciona tu proyecto', 'yellow');
      log('3. Settings > Database > Connection string', 'yellow');
      log('4. Copia la URI (modo "URI" o "Session")', 'yellow');
      log('');
      connectionString = await question('Ingresa tu connection string (postgresql://...): ');
      
      if (!connectionString || !connectionString.startsWith('postgresql://')) {
        log('ERROR: Connection string inválida. Debe comenzar con postgresql://', 'red');
        process.exit(1);
      }
    }
  }

  // 3. Confirmación
  log('', '');
  log('ADVERTENCIA: Esta operación sobrescribirá los datos existentes en la base de datos.', 'yellow');
  log(`Connection String: ${connectionString.replace(/:[^:@]+@/, ':***@')}`, 'gray');
  log(`Backup File: ${backupFile}`, 'gray');
  log('');
  const confirm = await question('¿Estás seguro de que quieres continuar? (escribe "SI" para confirmar): ');
  
  if (confirm !== 'SI') {
    log('Operación cancelada.', 'yellow');
    process.exit(0);
  }

  // 4. Leer archivo SQL
  log('', '');
  log('Leyendo archivo de backup...', 'cyan');
  let sql;
  try {
    sql = readFileSync(backupFile, 'utf8');
    log(`Archivo leído: ${(sql.length / 1024).toFixed(2)} KB`, 'gray');
  } catch (error) {
    log(`ERROR: No se pudo leer el archivo: ${error.message}`, 'red');
    process.exit(1);
  }

  // 5. Conectar y ejecutar
  log('', '');
  log('Conectando a la base de datos...', 'cyan');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    log('Conexión establecida.', 'green');
    
    log('', '');
    log('Ejecutando SQL del backup (esto puede tardar varios minutos)...', 'cyan');
    log('Por favor, espera...', 'gray');
    
    // Ejecutar el SQL
    await client.query(sql);
    
    log('', '');
    log('✓ Restauración completada exitosamente!', 'green');
    log('', '');
    log('Verifica que los datos se restauraron correctamente en el Dashboard de Supabase.', 'yellow');
    
  } catch (error) {
    log('', '');
    log(`ERROR: La restauración falló: ${error.message}`, 'red');
    log('', '');
    
    // Si es error de conexión, sugerir usar connection string completa
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      log('El hostname no se pudo resolver. Esto significa que la connection string automática no funcionó.', 'yellow');
      log('', '');
      log('SOLUCIÓN: Usa la connection string completa del dashboard de Supabase:', 'yellow');
      log('1. Ve a https://supabase.com/dashboard/project/mwrruwgviwsngdwwraql/settings/database', 'cyan');
      log('2. En "Connection string", selecciona modo "URI" (Direct connection)', 'cyan');
      log('3. Copia la URI completa y ejecuta:', 'cyan');
      log('   node scripts/restore-backup.mjs "" "postgresql://..."', 'gray');
      log('', '');
      log('O si prefieres usar Session mode (pooler):', 'yellow');
      log('   Selecciona "Session" mode y copia esa URI', 'cyan');
    } else {
      log('Posibles causas:', 'yellow');
      log('- El backup puede tener errores de sintaxis', 'gray');
      log('- Puede haber conflictos con datos existentes', 'gray');
      log('- Verifica que el connection string sea correcto', 'gray');
      log('- Verifica que tengas permisos suficientes', 'gray');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(error => {
  log(`\nERROR FATAL: ${error.message}`, 'red');
  if (error.stack) {
    log(error.stack, 'gray');
  }
  process.exit(1);
});
