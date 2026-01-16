import { initGroups } from './admin/groups/index.js';
import { initCopas } from './admin/copas/index.js';
import * as parejasImport from './admin/parejas/parejasImport.js';
import { initParejasEdit } from './admin/parejas/parejasEdit.js';

console.log('ADMIN ENTRY CARGADO');

(parejasImport.initParejasImport ?? parejasImport.initParejas)?.();
initParejasEdit();
initGroups();
initCopas();
