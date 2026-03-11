#### Archivo de notas rápidas de testing — tirar ideas y bugs acá sin formatear.
#### Cuando se procesen al backlog (brainstorming-proximas-mejoras.md), limpiar las secciones.
####
#### INSTRUCCIÓN PARA CLAUDE: NO procesar ni referenciar este archivo hasta que el usuario
#### confirme explícitamente que terminó de agregar notas ("listo", "ya está", etc.).
#### El contenido puede estar incompleto mientras el usuario está testeando.
#### Si ves contenido nuevo en este archivo, preguntale al usuario: "¿Ya terminaste de agregar notas en Bugs-Mejoras-raw.md o todavía estás testeando?"

---
Testeo de docs/etapa3-sorteo-service-ui.md

Los bugs y mejoras parten de que partimos de una planteo inicial incorrecto. Estamos asumiendo que la posicion inicial de la base de datos es la "correcta" cuando en realidad es una situación totalmente arbitraria o incluso aleatoria.  Tenemos que asumir que los equipos empatados están realmente todos en exactametne la misma posición.

# BUGs

1. Cuando el sorteo coincide con el orden original no se muestran supraindices.
2. En la tabla de posiciones del grupo tenemos que cambiar el supra indice.  Lo que tenemos ahora  +1, +1, -2 no es un buen indicativo porque es un indicador relativo, subió 1 lugar o descendió 2 lugares, pero relativo a una situación totalmente arbitraria (el orden en el que está almacenado en la base de datos).  Necesitamos utilizar algo mas absoluto, por ejemplo #1 #2 #3 o 1°, 2°, 3°

# Mejoras

1. Debemos mostrar el supraindice también en la tabla de posiciones que mostramos en index.html
    - Debemos agregar alguno tipo de aclaración que los empates se resolvieron por sorteo, quizas abajo de la tabla.

# Observaciones de testing

---

# Ideas
