# Proyecto: Plataforma web para el Torneo de Coaliciones de 42

Ámbito: Doble autenticación (cuenta propia + OAuth 42), integración con API 42, liga y rankings, chat en tiempo real, persistencia de datos del usuario (favoritos, métricas, vistas, historial), filtros avanzados, administración, seguridad y privacidad solo en clave funcional.

## Resumen

Este documento Requisitos Funcionales (RF) especifica el comportamiento esperado de la plataforma web para el Torneo de Coaliciones de 42, incluyendo doble autenticación (cuenta propia + OAuth contra la base de datos de usuarios de 42), toma de datos mediante la API de 42, para la elaboración de una serie de funcionalidades que debe de tener el Torneo de Coaliciones, como rankings, histórico de temporadas anteriores, chat en tiempo real, y la persistencia de datos personales del usuario (favoritos, métricas, vistas y su historial de chat), así como un sistema de filtros avanzados para exploración y comparación.

Este documento solo abarca requisitos funcionales. Los requisitos de diseño, así como los técnicos y de arquitectura, estarán analizados en sus propios documentos,

## Alcance del documento

Definir exclusivamente los requisitos funcionales de la plataforma: qué debe hacer el sistema desde la perspectiva del usuario, administración y gobernanza de datos, sin especificar cómo se implementa a nivel de diseño y técnico.

## Glosario

PRESCINDIBLE: Es un requisito prescindible si, cuando estemos en el punto adecuado, es de muy difícil implementación.

### 1. Gestión de cuentas y autenticación propia

RF.10: El sistema deberá proporcionar registro de usuarios con OAuth 2.0/OIDC (Open ID Connect) (Authorization Code Flow with Proof Key for Code Exchange (PKCE)). contra la network de 42.
RF.10.1: El sistema pedirá la habilitación de 2FA.[PRESCINDIBLE]
RF.11: El sistema deberá permitir login propio mediante Oauth contra network 42.
RF.11.1: El login utilizará 2FA. [PRESCINBLE]
RF.12: El sistema deberá habilitar el cierre de sesión.
RF.13: El sistema deberá soportar roles, al menos el de usuario y administrador.
RF.14.1: Puede ser interesante que el sistema permita también un moderador para foros y similares. [Analizar.]

### 2. Autenticación contra la base de datos de usuarios de 42 mediante OAuth

RF.20: Tras el consentimiento, el sistema deberá asociar la idenidad 42 con la cuenta propia, manteniendo tokens y scopes de frma segura.
RF.20.1: El sistema deberá refrescar tokens automáticamente ante de su expiración.
RF.20.2: El sistema deberá detectar revocaciones o expiaciones y marcar el enlace como expirado.
RF.20.3: El sistema deberá permitir desvincular la cuenta de 42 (que a niveles inferiores será borrar el usuario localmente).
RF.21: Las funcionalidades que dependan de 42 deberán degradarse con mensaje y CTA para conectar si el usuario no ha vinculado. [Esto es gestionar si el usuario se queda sin acceso a la BDD de 42 bien porque lo haya perdido. Que siga teniendo un interfaz mínimamente funcional.]

### 3. Integración con la API de 42 (condicionada a OAuth)

RF.30: El sistema deberá obtener datos de los usuarios de 42 mediante la API.
RF.31: El sistema deberá sincronizar: perfil público 42, coalición, nivel, proyectos relevantes e hitos.
RF.32: El sistema deberá monstrar la información con fluidez y bajo tiempo de respuesta. [Esto puede implicar que, además de un sistema de sincronización bajo demanda, se haga necesario un sistema de sincronización en segundo plano. Discutir si es necesario caché.]
RF.33: El sistema deberá notificar al usuario cuando una vista/métrica guardada quede desactualizada por revocación de la autorización con la API. No puede quedar en un estado indeterminado o incoherente.

### 4. Gestión de liga, rankings y temporadas

RF.40: El sistema deberá mostrar ranking general de coaliciones según reglas configurables.
RF.41: El sistema deberá mostrar ranking individual dentro de cada coalición.
RF.42: El sistema deberá permitir fichas de coalición con detalles: miembros, métricas, evolución.
RF.43: El sistema deberá permitir fichas de usuario con progreso y actividad relevante.
RF.44: El sistema deberá permitir abrir/cerrar temporadas y ver histórico de temporadas anteriores.
RF.45: El sistema deberá permitir comparar coaliciones entre sí en vistas dedicadas [Estudiar si se quiere hacer de dos, tres y cuatro o sólo cuatro o sólo dos].
RF.46: El sistema deberá permitir recalcular rankings bajo nuevas reglas y conservar snapshots anteriores. [Esto podría ser útil si queremos que la app perdure en el tiempo pero no sé si será mucho trabajo. Puede que una vez que se llegue a los requisitos de diseños, se pueda descartar, si así lo es.PRESCINDIBLE]
RF.47: El sistema deberá ofrecer filtros básicos: coalición, campus, cohorte, nivel, rango temporal, verificado/no verificado, actividad reciente.
RF.47.1: El sistema deberá permitir filtros compuestos con operadores (=, ≠, >, ≥, <, ≤, BETWEEN, IN, LIKE/CONTAINS) y grupos (AND/OR). [Discutir si hemos de llegar hasta aquí.]
RF.48: El sistema deberá limitar consultas excesivas (paginación obligatoria y límites de tamaño) y sugerir filtros si una consulta es muy amplia.

### 5. Estadísticas y visualizaciones

RF.50: El sistema deberá mostrar gráficas de progreso por usuario.
RF.52: El sistema deberá permitir comparativas entre coaliciones y campus.
RF.53: El sistema deberá mostrar el tiempo exacto con resolución de segundos, de los datos que está mostrando (timestamp).
RF.51: El sistema deberá mostrar métricas agregadas por coalición.
RF.54: Discutir si, para un usuario, es interesante que haya scopes de visualización según su coalición u otros aspectos.

### 6. Chat y comunicación en tiempo real6
RF.60: El sistema deberá incluir chat global accesible con login propio. [POSIBLE]
RF.61: El sistema deberá permitir chats por coaliciones (canales). [POSIBLE]
RF.62: El sistema deberá permitir mensajería privada entre usuarios.
RF.63: El sistema deberá operar el chat en tiempo real (WebSockets o equivalente).
RF.64: El sistema deberá soportar reacciones y menciones (@usuario). [DEPENDE DE SI HAY CHAT]
RF.65: El sistema deberá permitir moderación (mute/ban/borrar mensajes) para roles con permiso. [DEPENDE DE SI HAY CHAT]
RF.66: El sistema deberá persistir mensajes enviados/recibidos del usuario como parte de su historial personal si el usuario lo habilita.
RF.67: El sistema deberá permitir descargar el historial personal de chat del usuario.
RF.68: El sistema deberá permitir que el usuario elimine sus mensajes y solicite borrado total de su historial personal.

### 7. Datos personales persistidos por usuario (favoritos, métricas, vistas, segmentos)

RF.70: El sistema deberá permitir que el usuario marque estudiantes a seguir (amigos) y los organice en listas. Estos favoritos deberán poder agruparse por los mismos grupos en los que se hagan comparativas y filtos (campus [si se implementa], coaliciones, y los que se determinen).
RF.71: El sistema deberá permitir configurar alertas sobre cambios relevantes de favoritos (p. ej., subida de nivel). [Discutir si es necesario llegar hasta aquí. OPCIONAL]
RF.72: El sistema deberá permitir crear y guardar filtros.
RF.73: El sistema deberá permitir guardar vistas (p. ej.: de filtros). [PRESCINDIBLE]
RF.74: El sistema deberá permitir compartir fitros con otro usuario mediante un enlace. [Discutir si es necesario llegar hasta aquí.]
RF.76: El sistema deberá permitir búsqueda dentro de elementos guardados.
RF.77: El sistema deberá permitir exportar datos personales guardados (favoritos, vistas, métricas, historial personal de chat) en CSV/JSON. [OJO: Esto tiene una implicación no funcional inmediata, que es establecer una limitación a esta operación en frecuencia.]

### 8. Administración [De aquí podemos suprimir cosas a las que, seguramente, no hay que llegar, como lo de auditar.]

RF.80: El sistema deberá incluir un panel de administración para ver estado general de la plataforma.
RF.81: El sistema deberá permitir a administradores definir/editar reglas de puntuación y criterios de rankings oficiales. [PRESCINDIBLE. Sólo tiene sentido si contemplamos la escalabilidad ante el cambio de reglas.]
RF.82: El sistema deberá permitir gestionar temporadas (crear/abrir/cerrar y consultar histórico).
RF.83: El sistema deberá permitir gestionar usuarios (roles, ban/mute, restablecer estado). [Si existe el chat.]
RF.84: El sistema deberá mostrar estado de OAuth (tokens válidos/expirados/revocados) y colas de sincronización. [PRESCIDIBLE]
RF.88: El sistema deberá auditar operaciones sensibles (login, enlace/desvincular 42, lecturas de API, cambios de rol, creación/edición/eliminación de vistas y métricas).

### 9. Gamificación

RF.90: La aplicación contará con un sistema de badges, achievements, logros desbloqueables por acciones específicas.
RF.91: Sistema de XP. Puntos acumulables por actividad en la plataforma.
RF.92: Leaderboards internos. Ranking de usuarios dentro de la plataforma propia.
RF.93: Feedback visual. Notificaciones de desbloqueo y barras de progreso.

### 10. Usabilidad

RF.100: El sistema deberá mostrar al usuario un estado, como su login, si está autorizado con 42, su tiempo de login. 
RF.101: El sistema deberá ser responsive y ofrecer navegación consistente en desktop y mobile.
RF.102: El sistema deberá mostrar mensajes de error accionables (qué falta y cómo resolverlo). Gestionar los estados de error. 
RF.103: El sistema deberá mostrar el histórico de puntos del usuario por temporada.
RF.104: El sistema mostrará si los usuarios favoritos están on-line.

## 11. Evaluaciones

RF.110: Ranking de usuarios con mayor numero de correcciones realizadas.
RF.111: Filtros por periodo: semana, mes y temporada.
RF.112: Visualizacion comparativa para identificar consistencia y picos de actividad.
RF.113: Calculo del porcentaje de aprobaciones de cada evaluador.
RF.113.1: Formula: `aprobaciones / (aprobaciones + suspensos) x 100`.
RF.113.2: Mostrar total de evaluaciones.
RF.113.3: Mostrar numero de aprobadas y suspendidas.
RF.113.4: Mostrar tasa de aprobacion en porcentaje.

### 12. Seguridad y privacidad (No son estrictamente requisitos funcionales. Los metería en requisitos de diseño, ya que no son funcionalidades para ningún usuario.)

RF.120: El sistema deberá cifrar tokens OAuth y datos sensibles en reposo.
RF.121: El sistema deberá prevenir ataques comunes (CSRF/XSS/inyección) y proteger canales de tiempo real.
RF.122: El sistema deberá ofrecer un panel de privacidad donde el usuario gestiona su consentimiento y persistencia de datos.
RF.123: El sistema deberá permitir descargar todos los datos personales del usuario almacenados por la plataforma. [OPCIONAL]
RF.124: El sistema deberá permitir solicitar borrado de la cuenta y de los datos personales, con confirmación del alcance.
RF.125: El sistema deberá notificar al usuario cuando un cambio de permisos OAuth afecte a sus vistas/métricas guardadas (pérdida de acceso o desactualización).

