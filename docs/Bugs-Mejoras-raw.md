#### Archivo de notas rápidas de testing — tirar ideas y bugs acá sin formatear.
#### Cuando se procesen al backlog (brainstorming-proximas-mejoras.md), limpiar este archivo.
####
#### INSTRUCCIÓN PARA CLAUDE: NO procesar ni referenciar este archivo hasta que el usuario
#### confirme explícitamente que terminó de agregar notas ("listo", "ya está", etc.).
#### El contenido puede estar incompleto mientras el usuario está testeando.
#### Si ves contenido nuevo en este archivo, preguntale al usuario: "¿Ya terminaste de agregar notas en Bugs-Mejoras-raw.md o todavía estás testeando?"

# Testeando el archivo Docs/test-plan-copa-aprobacion-v1.2.md
Precondicion ok.

# paos testeados
    - Bloque 1 OK
    - Bloque 2 OK con observaciones Ver bug #1
    - Bloque 3 OK con observaciones Ver bug #1
        3.5 es correcto incluso respetando criterio de Games a Favor.
    - Bloque 4 OK
    - Bloque 5 OK (sin testear 5.2 ni 5.3)
    - Bloque 6 OK
    - Bloque 7
        7.3 no veo en curso a nivel copa
    - Bloque 8 
        8.2 no veo en curso a nivel copa
        8.3 OK
    - Bloque 9 OK
    - Bloque 10 OK
    - Bloque 11- Bug 2
        11.1 ver BUG 4
        11.2 OK
        11.3 ok
        11.4 ok pero con obvservaciones ver bug 5
        11.5 ok
        11.6 no, la pareja original tiene el tilde ✅ pero no la nueva.
    - Bloque 12 Realicé la carga desde carga.html
        12.1    - El breadcrum dice que está en 2.Esperar Grupos
            Esperando que finalicen los grupos (1 de 2 completados)

            Plan de copas vigente
            Copa Oro
            Cruce directo
            1°GrA ─┐
                   ├─→ Final → Campeón
            1°GrB ─┘
            Si cargo los resultados desde la página de cada usuario y los confirmo desde ahi si aparece Cruces con la pareja del grupo finalizado y "pendiente" como rival.
        12.2 No hay propuesta de cureces realizada
        12.3 No aplica, no hay botón aprobar
        12.4 Aparecen lo cruces correctamente
        12.5 ok
    - Bloque 13
        13.1 Igual que en 12.1, solo se vé "Esperando que finalicen los grupos (1 de 2 completados)"
        13.2 ok
        13.3 OK
        13.4 OK - Muestra el warning.  Cuando quiero editar los cruces en los dropdown solo veo los nombre de las 4 parejas, pero no veo los grupos de cada una.  Me falta información para armar cruces que no sean del mismo grupo.  Tendríamos que hacer que si el seed es por grupos (no el global) y el curce propuesto es entre equipos del mismo grupos, el sistema automáticamente cambie la 2da pareja por la parjea que la misma posición, pero del otro grupo.
    - Bloque 14
        14.1 El sistema permite seleccionar y guardar la misma pareja.  Ver bug 3
        14.2 Permite guardar.  Si vuelvo a editar los curces, la pareja que des-seleccioné antes no vuelve a aparecer.  Si hago esto para los 4 equipos los 4 desaparecen.  Si hago click en porponer ahora vuelve a aparecer.
        14.3 Puede poner el mismo equipo en todos los cruces. No hay auto-dedup. Se ve asi:
            CRUCES
                Semi 1 Gaby Z - Uri vs Gaby Z - Uri
                Semi 2 Gaby Z - Uri vs Gaby Z - Uri
                💾 Guardar cruces ↩ Volver a sugeridos
            Si hago click en "Guardar cruces" se ve asi
            CRUCES
                Semi 1 ⏳ pendiente vs ⏳ pendiente
                Semi 2 ⏳ pendiente vs Gaby Z - Uri
        14.4 OK
        - Bloque 15 ok

# Mejoras:
    1. El ultimo paso del wizard de copas debería mostrar el cruce gráfico que mostrasmos en el preview de las plantillas.  Hoy muestra un resumen de texto, pero el resumen visual es mas útil para confirmar lo que se eligió.
    2. en index.html si hay partidos por confirmar, la sección debería aparaecer desplegada.
    3. En el wizard de copas, la selección de como clasifican los grupos es independiente de la copa.  Todas las copas debe utilziar el mismo método (o todas por posicion en grupo propio o todas por tabla general).  Es mas un bug que una mejora, pero como solo el admin lo va a administrar lo dejo como mejora.


# BUGs
    1. La tabla de criterio debe mostrar Diferencia de Games, ademas de DS  
    2. En un Torneo con 2 grupos (A y B), 3 parejas cada uno, si armo una copa con 4 parejas y otra copa con 2 parejas. Al cargar todos los resutlados de los partidos de grupo desde carga.html se generas las propuestas para la copa de Oro, pero la copa de plata dice que faltan finalizar partidos.
            Copa Plata
            ⏳ Esperando grupos…
            Grupos completos: 2 de 2
            Los cruces se generan cuando todos los grupos terminen (seeding global).
        Sucedió lo mismo con un formato de 12 equipos en 3 grupos de 4 que debían generar 3 copas
            Copa Bronce
            ⏳ Esperando grupos…
            Grupos completos: 3 de 3
            Los cruces se generan cuando todos los grupos terminen (seeding global).
            3. Al hacer click en Editar cruces, puedo elegir para un partido la misma pareja en ambos lados y permite "Guarar Cruces".
    3. Al editar cruces, si en los dropdown elijo una pareja mas de una vez el sistema lo permite. Al guardar los cruces el rival no seleccionado desparace y pasa estado pendiente.
        -Se podría hacer una interfaz Drag and Drop para modificar los cruces?  Cada pareja es un pill cada grupo tiene el mismo color de fondo?  Habría que incluir la posicione en la tabla dentro del pill.
    4. solo muestra 1 opción de intercambiar.  En este caso el empate fue tripartito y el sistema no lo dectectó.
            #ParejaPtsDSGrupo
            1.✅Andy - Max, 6 pts, DS +3 A 1°
            2.✅Lean - Leo, 6 pts, DS +3 B 1°
            3.✅Tincho - Diego Sz, 6 pts, DS +3C 1°
            4.✅Gaby Z - Uri, 5 pts, DS +1A 2°
            5.Gus - Dudi, 5 pts, DS +1 B 2°
            6.Marian - Sebi, 5 pts, DS +1 C 2°
            7.Diego Sm - Alan, 4 pts, DS 1 C 3°
            8.Marce - Pablo, A 4 pts, DS 1 A 3°
            9.Nico - Chiqui, 4 pts, DS 1 B 3°
            10.Gaby A - Ari, Kan 3 pts, DS 3 A 4°
            11.Gaston - Ger, 3 pts, DS 3 B 4°
            12.Mauri - Chino, 3 pts, DS 3 C 4°
        Me parece que tenemos que buscar una solucion distinta para definir los clasificados que se mas robusta.
    5. Al encontrar empates frontera y aplicar un cambio, los cruces se generan correctamente, pero la tabla de posiciones que se ve en la copa sigue mostrando como Clasificados a la pareja que se reemplazó.  Esto va en linea con la idea del bug 4 que necesitamos una solución mas robusta.
    6. Después de hacer un cambio por empate y aprobar un cruce, si hago click en "Editar Cruces", la vista cambia a modo edición, pero no hay selectores en los jugadores ni hay posibilidad de cambiar a los clasificados.


# metodo general para optimizar curces:
El primer paso entonces es resolver los empates tanto intragrupos como intergrupos.
Con eso resuelto lo único que quedaría como problemático son los cruces con jugadores del mismo grupo.
Ayudame a pensar en esto, a ver si encontramos una solucion general que podamos aplicar siempre.
Voy escribir algunos ideas que no estoy seguro sean ciertas.
En los formatos de copa con posiciones por grupo particulares, los curces entre parejas del mismo grupo deberían ser o bien triviales o bien iresolubles:
Voy a llamar Mejor-Peor a la regla que usamos para enfrentar al mejor clasificado contre el peor clasificado
Creo que la regla Mejor-Peor podria ser la regla general por default y luego ajustar solo si es posible
- Si hay grupos impares si o si hay que usar el formato de grupo general que lo reviso abajo
- Si hay 2 grupos, y 4 equipos en la copa, aplicamos mejor peor,  Si hay cruces malos cambiamos el peor del primer cruce por el siguente peor.  Creo que esto aplica para todos los casos de 2 grupos independiente de la cantidad de equipos 2, 4, 8
- Con 4 grupos
  -Si clasifican solo los 4 primeros, aplicamos mejor-peor, buscamos curces endogenos, como no son posibles en este formato no hay nada que optimizar.
  -Si Clasifican 8,  imaginemos que el orden es A1,B1,C1,D1,D2,C2,B2,A2 aplicamos mejor-peor, 
    - Buscamos curces endógenos de forma secuencial, vamos encontrar A1 vs A2, intercambiamos A2 por el siguiente mejor que es B2.
    -buscamos el siguiente endógeno , B1 ya no es mas endógeno.  C1 es endógeno, entonces cambiamos C1 por el siguiente mejor peor, D2.
    - No hay mas endógenos.
    - Como optativo podemos "marcar" los ya modificados para no volver a tocarlos.  En este al buscar optimiar C2, si por el motivo que sea encontramos a B2 como candidato, lo salteamos porque ya lo fue optimizado.
    -Si bien armé esto con un ejemplo, creo que el método posiblemente aplica como regla general.

Copas en base al grupo general.
- Si hay un solo grupo, aplicamos mejor-peor van a existir crucen endógenos pero no es optimizable. Nota:  Aca es riesgoso aplicar la optimización porque romperiamos el mejor-peor
- creo que aca podemos aplicar el mismo método de busqueda secuencial. Si el orden es A1, B1, C1, C2, B2, A2.
- El primer cruce seria A1 vs A2 que es endógeno.  Cambiamos A2, por el siguiente peor que es B2.
- Hacemos el cambio y marcamos a B2 como optimizado.
- el siguiente endógeno es C1, Buscamos los peores de peor a mejor, Encontrámos a A2 que no fue optimizado y lo intercambiamos y marcamos a A2 como optimizado.
- ya no hay mas endógenos.