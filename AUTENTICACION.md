# Sistema de Autenticación - Totem Admin

## 🔐 Credenciales de Login

**Contraseña actual:** `admin`

## ✨ Características Implementadas

### 1. **Login Seguro**
- Página de login elegante con contraseña
- Validación en servidor
- Redireccionamiento automático al admin si ya está autenticado

### 2. **Sesiones Persistentes**
- Las sesiones se guardan en el servidor
- Cuando recargas la página, **NO tienes que volver a loguear**
- La sesión persiste mientras esté activa

### 3. **Timeout de Inactividad**
- Timeout de **30 minutos** sin actividad
- Se detecta: clicks del mouse, escritura en teclado, scroll
- Si hay inactividad, se redirige automáticamente a login

### 4. **Cierre de Sesión Manual**
- Botón "Cerrar sesión" en la esquina superior derecha
- Requiere confirmación

## 🔧 Cómo Cambiar la Contraseña

Abre el archivo `src/server.js` y busca esta línea:

```javascript
if (password === 'admin') {
```

Cambia `'admin'` por tu contraseña deseada. Por ejemplo:

```javascript
if (password === 'mi-contraseña-segura') {
```

_Nota: En producción, deberías usar bcrypt u otro método de hash para encriptar la contraseña._

## 🛡️ Protección de Rutas

- **Rutas públicas:**
  - GET `/` - Página de información (módulos públicos)
  - GET `/login` - Página de login
  - POST `/api/login` - Endpoint para login
  - GET `/api/auth-check` - Verificar autenticación

- **Rutas protegidas (requieren login):**
  - GET `/admin` - Panel de administración
  - Todas las rutas bajo `/api/tramites`, `/api/modulos`, `/api/requisitos`, etc.

## 📋 Flujo de Funcionamiento

1. **Usuario accede a `/admin` sin sesión**
   - Servidor detecta que no hay sesión
   - Redirige a `/login`

2. **Usuario ingresa contraseña**
   - Se envía POST a `/api/login`
   - Si es correcta, se crea una sesión en el servidor

3. **Usuario es redirigido a `/admin`**
   - Ahora tiene sesión activa
   - Puede ver el panel de administración

4. **Mientras usa el admin**
   - Cada actividad (mouse, teclado, scroll) reset el timer de inactividad
   - El código corre cada vez que hay actividad para extender la sesión

5. **Por inactividad**
   - Si pasan 30 minutos sin actividad, se ejecuta logout automático
   - Se redirige a `/login`

6. **Por cierre manual**
   - Hace clic en "Cerrar sesión"
   - La sesión se destruye en el servidor
   - Se redirige a `/login`

## 📝 Notas Importantes

- **Contraseña**: Se valida contra texto plano en el servidor. Para producción, usa bcrypt.
- **Duración de sesión**: 30 minutos sin actividad (configurable en `server.js`)
- **Cookie**: Se marca como `httpOnly` para mayor seguridad
- **Reload de página**: No requiere volver a loguear mientras haya sesión activa

## 🔄 Cómo Ajustar el Tiempo de Inactividad

En `public/admin.js`, busca:

```javascript
const INACTIVITY_DURATION = 30 * 60 * 1000; // 30 minutos
```

Cambia el valor. Por ejemplo, para 15 minutos:

```javascript
const INACTIVITY_DURATION = 15 * 60 * 1000; // 15 minutos
```

Y en `src/server.js`, busca:

```javascript
maxAge: 30 * 60 * 1000 // 30 minutes
```

Cambia a:

```javascript
maxAge: 15 * 60 * 1000 // 15 minutes
```

Ambos deben coincidir para que el sistema funcione correctamente.
