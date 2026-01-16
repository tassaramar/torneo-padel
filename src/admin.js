import { initSafetyLock } from './admin/safetyLock.js';

import { initGroups } from './admin/groups/index.js';
import { initCopas } from './admin/copas/index.js';

import * as parejasImport from './admin/parejas/parejasImport.js';
import { initParejasEdit } from './admin/parejas/parejasEdit.js';

console.log('ADMIN ENTRY CARGADO');

initSafetyLock();

// Soporta cualquiera de los dos nombres por si renombraste la función
(parejasImport.initParejasImport ?? parejasImport.initParejas)?.();
initParejasEdit();

initGroups();
initCopas();
