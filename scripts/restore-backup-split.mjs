#!/usr/bin/env node
/**
 * Script alternativo para restaurar backup dividiendo el SQL en comandos individuales
 * Maneja mejor los errores y permite continuar aunque algunos comandos fallen
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createInterface } from 'readline';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Dividir SQL en comandos individuales
function splitSQL(sql) {
  const commands = [];
  let currentCommand = '';
  let inString = false;
  let stringChar = null;
  let inDollarQuote = false;
  let dollarTag = '';
  let parenDepth = 0;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    
    // Manejar dollar quoting ($$tag$$)
    if (!inString && char === '$') {
      const dollarMatch = sql.substring(i).match(/^\$([^$]*)\$/);
      if (dollarMatch) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = dollarMatch[0];
        } else if (dollarMatch[0] === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
        currentCommand += dollarMatch[0];
        i += dollarMatch[0].length - 1;
        continue;
      }
    }
    
    if (inDollarQuote) {
      currentCommand += char;
      continue;
    }
    
    // Manejar strings
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      currentCommand += char;
      continue;
    }
    
    if (inString && char === stringChar && sql[i - 1] !== '\\') {
      inString = false;
      stringChar = null;
      currentCommand += char;
      continue;
    }
    
    if (inString) {
      currentCommand += char;
      continue;
    }
    
    // Contar paréntesis
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    
    currentCommand += char;
    
    // Detectar fin de comando (punto y coma fuera de strings y paréntesis)
    if (char === ';' && !inString && parenDepth === 0) {
      const trimmed = currentCommand.trim();
      if (trimmed && trimmed !== ';') {
        commands.push(trimmed);
      }
      currentCommand = '';
    }
  }
  
  // Agregar último comando si no termina en ;
  if (currentCommand.trim()) {
    commands.push(currentCommand.trim());
  }
  
  return commands.filter(cmd => cmd.length > 0);
}

async function main() {
  log('\n=== Restauración de Backup (Modo Dividido) ===\n', 'cyan');

  // 1. Determinar archivo
  let backupFile = process.argv[2];
  if (!backupFile) {
    const backupsDir = join(__dirname, '..', 'backups');
    const { readdirSync, statSync } = await import('fs');
    const files = readdirSync(backupsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: join(backupsDir, f),
        time: statSync(join(backupsDir, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length === 0) {
      log('ERROR: No se encontraron backups', 'red');
      process.exit(1);
    }
    
    backupFile = files[0].path;
    log(`Usando: ${files[0].name}`, 'gray');
  } else {
    backupFile = resolve(backupFile);
  }

  // 2. Obtener connection string
  let connectionString = process.argv[3];
  if (!connectionString) {
    log('', '');
    log('OPCIÓN 1: Usar SQL Editor del Dashboard (RECOMENDADO)', 'yellow');
    log('1. Ve a https://supabase.com/dashboard/project/mwrruwgviwsngdwwraql/sql/new', 'cyan');
    log('2. Abre el archivo de backup y copia todo el contenido', 'cyan');
    log('3. Pégalo en el SQL Editor y ejecuta', 'cyan');
    log('', '');
    log('OPCIÓN 2: Continuar con este script', 'yellow');
    log('Necesitas la connection string completa del dashboard:', 'yellow');
    log('https://supabase.com/dashboard/project/mwrruwgviwsngdwwraql/settings/database', 'cyan');
    log('');
    connectionString = await question('Connection string (o Enter para cancelar): ');
    
    if (!connectionString || !connectionString.startsWith('postgresql://')) {
      log('Operación cancelada. Usa el SQL Editor del dashboard.', 'yellow');
      process.exit(0);
    }
  }

  // 3. Leer y dividir SQL
  log('', '');
  log('Leyendo y dividiendo SQL...', 'cyan');
  const sql = readFileSync(backupFile, 'utf8');
  const commands = splitSQL(sql);
  log(`Total de comandos: ${commands.length}`, 'gray');

  // 4. Confirmación
  log('', '');
  log('ADVERTENCIA: Esta operación modificará la base de datos.', 'yellow');
  log(`Comandos a ejecutar: ${commands.length}`, 'gray');
  log('');
  const confirm = await question('¿Continuar? (SI para confirmar): ');
  
  if (confirm !== 'SI') {
    log('Cancelado.', 'yellow');
    process.exit(0);
  }

  // 5. Ejecutar comandos
  log('', '');
  log('Conectando...', 'cyan');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    log('Conectado.', 'green');
    
    log('', '');
    log('Ejecutando comandos (esto puede tardar)...', 'cyan');
    
    let success = 0;
    let errors = 0;
    const errorCommands = [];
    
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const progress = `[${i + 1}/${commands.length}]`;
      
      try {
        // Saltar comandos que pueden causar problemas
        if (cmd.match(/^\s*CREATE\s+ROLE/i) || cmd.match(/^\s*ALTER\s+ROLE/i)) {
          log(`${progress} Saltando comando de rol: ${cmd.substring(0, 50)}...`, 'gray');
          continue;
        }
        
        await client.query(cmd);
        success++;
        
        if ((i + 1) % 50 === 0) {
          log(`${progress} Procesados: ${success} exitosos, ${errors} errores`, 'gray');
        }
      } catch (error) {
        errors++;
        const errorMsg = error.message.substring(0, 100);
        
        // Algunos errores son esperados (ya existe, etc.)
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('duplicate')) {
          // Ignorar errores esperados
        } else {
          errorCommands.push({ index: i + 1, command: cmd.substring(0, 100), error: errorMsg });
          log(`${progress} ERROR: ${errorMsg}`, 'red');
        }
      }
    }
    
    log('', '');
    log(`✓ Completado: ${success} exitosos, ${errors} errores`, 'green');
    
    if (errorCommands.length > 0) {
      log('', '');
      log('Comandos con errores inesperados:', 'yellow');
      errorCommands.slice(0, 10).forEach(({ index, error }) => {
        log(`  ${index}: ${error}`, 'gray');
      });
      if (errorCommands.length > 10) {
        log(`  ... y ${errorCommands.length - 10} más`, 'gray');
      }
    }
    
  } catch (error) {
    log(`ERROR FATAL: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(error => {
  log(`\nERROR: ${error.message}`, 'red');
  process.exit(1);
});
