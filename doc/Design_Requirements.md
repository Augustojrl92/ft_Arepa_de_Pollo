# 1. Objetivo del documento de Requisitos de Diseño (RD)
El Documento de Requisitos de Diseño describe cómo se implementarán los requisitos funcionales de la aplicación definidos en el correspondiente documento de RF.
Se detalla la arquitectura, componentes, flujos clave y tratamiento de datos del sistema.

# 2. Arquitectura General del Sistema
[Esto es 100% Copilot, que se empeña en hablar de tecnolgías, así que, dejo sus sugerencias.]

La aplicación se basa en una arquitectura cliente-servidor moderna:

Frontend SPA (React/Vue/Svelte)
Backend API REST + WebSockets
Base de datos relacional (PostgreSQL)
Cache distribuida (Redis)

Servicios externos:

OAuth/OIDC 42
API oficial 42

# 3. Componentes del Sistema

## 3.1 Frontend Simple Page Application (SPA)

### Componentes principales

+ Auth UI: Login con 42 (OIDC).
+ Dashboard del usuario.
+ Vista de coaliciones y rankings.
+ Sistema de filtros avanzados.
+ Chat global, por coalición y privado.
+ Panel de administración.
+ Gamificación (XP, badges, logs).

### Principios de diseño

+ Single Page Application.
+ Responsive (desktop + móvil).

## 3.2 Backend (API REST + WebSockets)

### Servicios

#### AuthService

+ OAuth contra la network de 42 (OIDC + PKCE).
+ Gestor de tokens (access + refresh).
+ Cifrado AES-256 de tokens (para su almacenado).

#### SyncService

+ Comunicación con API 42.
+ Sincronización bajo demanda.
+ Sincronización automática programada.
+ Cache para reducción de llamadas a la API.

### Coalitions Service
+ Filtra y recupera coaliciones de 42 Madrid
+ Asigna las variables de coalición relacionadas con user
+ Tiene las funciones necesarias para trabajar con los datos de la coalición

#### RankingService

+ Procesador de puntuaciones y posiciones. Establece las diferentes métricas del torneo en base a los rankings y reglas que queramos establecer.

#### ChatService (WebSockets)

+ Mensajería en tiempo real.
+ Global, coalición y privado.
+ Moderación (ban/mute).
+ Persistencia opcional del historial del usuario.

#### FilterService

+ Motor de filtros avanzados.
+ Operadores lógicos, comparadores y grupos.
+ Almacenamiento de filtros y vistas del usuario.

#### GamificationService

+ Sistema XP.
+ Badges y logros.
+ Leaderboard interno.

#### AdminService

+ Gestión de temporadas.
+ Reglas de puntuación.
+ Administración de usuarios.
+ Estado de sincronizaciones y OAuth.

## 3.3 Base de Datos

+ Aquí tendríamos el diseño de la base de datos, que precisa del diseño del modelo, lo que debería documentarse aparte.


## 3.4 Caché y Sesiones (Redis)

+ Cache de perfiles 42.
+ Gestión de sesiones WebSocket (si se hace chat).

# 4 Diseño del módulo de Autenticación (solo OAuth 42)

+ Usuario hace clic en Login con 42.
+ Redirección a la página OIDC de 42.
+ Consentimiento del usuario.
+ 42 devuelve authorization code.
+ El backend obtiene tokens mediante PKCE.
+ Se crea sesión interna.
+ Se sincroniza el perfil desde API 42.

Los estados posibles del usuario son:

+ Autenticado con tokens válidos.
+ Token expirado → refresh automático.
+ Token revocado → cuenta en estado “no sincronizada”.

# 5 Sincronización con API de 42

### Elementos sincronizados:

+ Perfil público
+ Coalición
+ Nivel
+ XP
+ Proyectos relevantes
+ Hitos

Para ello necesitamos:

+ Sincronizador.
+ Detección de revocación de autenticación.
+ Cacheador.

El sincronizador depende íntimamente del cacheador.

# 6 Sistema de filtros

+ Validación estricta.
+ Prevención de inyecciones.
+ Composición de condiciones y grupos.
+ Filtros guardados y compartibles.


# 7 Chat en Tiempo Real (WebSockets)

Posible sólo mensajes entre usuarios, como se habló al discutir RF.

+ Canales
+ Chat global.
+ Chat por coalición.
+ Mensajes privados.
+ Mensajes privados de uso exclusivo de Fundación.

Necesita estas funciones

+ Distribución de mensajes.
+ Control de presencia.
+ Persistencia [opcional].
+ Moderación: ban, mute, borrar mensajes.


# 8 Persistencia de Datos del Usuario

+ Favoritos
+ Filtros guardados
+ Historial personal de chat.
+ Exportación CSV/JSON


# 9 Gamificación
El sistema registra:

Acciones del usuario
+ Calculador de FP (bronce, plata, oro)
+ Gestor de badges obtenidos: monitorea las condiciones para otorgarlos a un perfil de usuario cuando éstas se cumplan.
+ Leaderboard de FP y badges

# 10 Panel de Administración

+ Monitoreo de servicios (¿están levantados¿, ¿recursos que ocupan?)
+ Estado de autenticación.
+ Revocar autenticación.
+ Eliminar datos de usuario.

# 11 Seguridad y Privacidad (Diseño)

+ Tokens OAuth cifrados AES-256.
+ CSRF tokens.
+ Cookies.
+ Limitación de peticiones.
+ Sanitización en filtros avanzados [por SQL Injection]
