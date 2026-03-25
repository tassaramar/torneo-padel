#### Archivo de notas rápidas de testing — tirar ideas y bugs acá sin formatear.
#### Cuando se procesen al backlog (brainstorming-proximas-mejoras.md), limpiar las secciones.
####
#### INSTRUCCIÓN PARA CLAUDE: NO procesar ni referenciar este archivo hasta que el usuario
#### confirme explícitamente que terminó de agregar notas ("listo", "ya está", etc.).
#### El contenido puede estar incompleto mientras el usuario está testeando.
#### Si ves contenido nuevo en este archivo, preguntale al usuario: "¿Ya terminaste de agregar notas en Bugs-Mejoras-raw.md o todavía estás testeando?"

Se estpa testeabdo docs/testing-unificar-general-modal.md.
---

# BUGs

1. Orden del fixture.
    El fixture parece estar ordenando la cola de partidos con un sesgo por grupos.  Como se ve en la imagen pone primero 2 partidos del mismo grupo, cuando creo que lo mejor sería poner 1 partido de cada grupo primero. ![](image.png)
2. E1.
    En Botónmar de nav el icono de la pala y la pelota parecen estar subrayados.  queda raro. 
3. Empates marcados siempre:
    La tabla de posiciones, cuando está en blanco, marca a todos los equipos en amarillo.  El empate solo debería mostrarse si PJ>0

---

# Mejoras
1. Pensemos cual es el mejor nombre para index.html.  Ahora lo llamamos "Ver Mis Partidos".  Estoy pensando en algo que sea mas personal todvía no mis partidos, pero mi página, mi espacio o algo por el estilo.  Esto buscando algo que genere un poco mas de sentimiento de pertenencia y ownership.
2. Color de tu pareja en tabla y lista de partidos
    Tu pareja tiene el fondo azul claro (`.mi-pareja`) en la tabla de posiciones --> tiene el un color verde claro, muy parecido el del partido ganado ![](image-1.png)
3. El titulo de la tabla de posiciones tiene el mismo color que los partidos perdidos. 
4. El refresh funciona, pero en un momento la tabla de posiciones se borra y vuelve a aparecer.  El titulo y botones no se borran, eso está OK.  No se si es posible hacerlo incluso un poco mas seamless.


---

# Observaciones de testing


---

# Ideas
