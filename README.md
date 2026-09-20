# CHD API

API REST para consultar datos de la Confederación Hidrográfica del Duero (CHD) desde el portal SAIH Duero.

## Descripción

Esta API proporciona endpoints para acceder a información de las estaciones de aforo del río Duero, extrayendo y procesando datos desde el sistema SAIH (Sistema Automático de Información Hidrológica) de la Confederación Hidrográfica del Duero.

La API realiza web scraping del portal [saihduero.es](https://www.saihduero.es/) para obtener:

- Listado de estaciones de aforo
- Detalles de cada estación
- Datos históricos de mediciones (nivel, caudal)
- Visualización gráfica de los datos con Chart.js

Todas las fechas se convierten automáticamente desde la zona horaria Europe/Madrid a UTC.

## Características

- API REST sin autenticación
- Sin límite de peticiones (rate limiting)
- Caché en memoria con TTL de 5 minutos
- Validación de parámetros de entrada
- Conversión automática de zonas horarias (Europe/Madrid → UTC)
- Extracción de datos desde HTML mediante web scraping
- Visualización gráfica interactiva con Chart.js
- Página principal (`/`) con listado de APIs y dashboards disponibles
- Documentación interactiva de la API con Swagger UI (`/api-docs`)
- Cobertura de tests superior al 85%
- Tests automáticos con GitHub Actions (CI)

## Tecnologías

- **Express** 5.x - Framework web
- **Cheerio** 1.x - Parsing de HTML
- **Axios** 1.x - Cliente HTTP
- **Day.js** 1.x - Manejo de fechas y zonas horarias
- **EJS** 5.x - Motor de plantillas
- **Chart.js** 4.x - Visualización de gráficos con escala de tiempo
- **Swagger UI** 5.x - Documentación interactiva de la API (OpenAPI 3.0)
- **Ava** 8.x - Framework de testing
- **c8** 11.x - Cobertura de código

## Instalación

```bash
npm install
```

## Uso

### Modo producción

```bash
npm start
```

El servidor se ejecuta en `http://localhost:3000` por defecto. Se puede cambiar el puerto mediante la variable de entorno `PORT`.

### Modo desarrollo (con hot reload)

```bash
npm run dev
```

### Docker

La imagen se publica automáticamente en el GitHub Container Registry (GHCR):

```bash
docker pull ghcr.io/arandadeduero/chd-api:latest
docker run -d -p 3000:3000 --name chd-api ghcr.io/arandadeduero/chd-api:latest
```

El servidor estará disponible en `http://localhost:3000`. El puerto interno del contenedor se puede cambiar mediante la variable de entorno `PORT`.

También se puede construir la imagen localmente:

```bash
docker build -t chd-api .
docker run -d -p 3000:3000 --name chd-api chd-api
```

#### Docker Compose

Copia [`docker-compose.example.yml`](docker-compose.example.yml) a `docker-compose.yml` y levanta el servicio:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

Usa la imagen publicada en GHCR, reinicia automáticamente el contenedor y comprueba `/health` mediante `healthcheck`. El puerto expuesto en el host se puede cambiar con la variable de entorno `PORT` (por defecto `3000`).

### Tests

```bash
npm test
```

Los tests incluyen cobertura de código y fixtures para validar el parsing de HTML.

### Integración Continua (CI)

El proyecto utiliza GitHub Actions para ejecutar tests automáticamente:

- En cada push a las ramas `main`, `master` o `develop`
- En cada Pull Request hacia estas ramas
- Tests en múltiples versiones de Node.js (22.x, 24.x y latest)
- Generación de reportes de cobertura

El workflow de CI se encuentra en `.github/workflows/ci.yml`.

### Publicación de la imagen Docker

En cada push a `main` (y en cada tag `v*.*.*`), el workflow `.github/workflows/docker-publish.yml` construye la imagen y la publica en el GitHub Container Registry como [`ghcr.io/arandadeduero/chd-api`](https://github.com/arandadeduero/chd-api/pkgs/container/chd-api).

## Página principal y documentación

### GET /

Página de inicio con el listado de APIs y dashboards disponibles (enlaces directos a cada endpoint y a Swagger UI).

### GET /api-docs

Documentación interactiva de la API generada con [Swagger UI](https://github.com/swagger-api/swagger-ui) a partir de la especificación OpenAPI 3.0 (`openapi.js`). Permite explorar cada endpoint, ver los esquemas de petición/respuesta y ejecutar peticiones reales ("Try it out") directamente desde el navegador.

### GET /openapi.json

Especificación OpenAPI 3.0 en formato JSON, útil para generar clientes o importarla en herramientas como Postman/Insomnia.

## Endpoints

### GET /health

Devuelve el estado del servidor y el tiempo de actividad.

**Respuesta:**

```json
{
  "status": "ok",
  "uptime": 123.456
}
```

---

### GET /station/aforo/all

Devuelve todas las estaciones de tipo "Aforo" disponibles.

**Respuesta:**

```json
[
  {
    "Tipo": "Aforo",
    "name": "Aforos SAIH CHD",
    "stationId": "EA013"
  },
  {
    "Tipo": "Aforo",
    "name": "RISR - Estado del río",
    "stationId": "EA014"
  }
]
```

---

### GET /station/aforo/:id

Devuelve los tipos de medición disponibles para una estación específica.

**Parámetros:**

- `id` - Identificador de la estación (ej: `EA013`). Debe contener solo caracteres alfanuméricos, guiones o guiones bajos (máximo 20 caracteres).

**Respuesta:**

```json
[
  {
    "type": "nivel",
    "url": "https://www.saihduero.es/risr/EA013/historico/xATSOFURfNTMwEUR"
  },
  {
    "type": "caudal",
    "url": "https://www.saihduero.es/risr/EA013/historico/xATVRFURfNTMwEUR"
  }
]
```

---

### GET /station/aforo/:id/:type

Devuelve los datos históricos de una medición específica para una estación.

**Parámetros:**

- `id` - Identificador de la estación (ej: `EA013`)
- `type` - Tipo de medición. Valores permitidos: `nivel`, `caudal`

**Respuesta:**

```json
[
  {
    "d": "20/11/2025 00:00",
    "v": 1.18,
    "@timestamp": "2025-11-19T23:00:00.000Z"
  },
  {
    "d": "20/11/2025 01:00",
    "v": 1.19,
    "@timestamp": "2025-11-20T00:00:00.000Z"
  }
]
```

**Campos:**

- `d` - Fecha y hora en formato original (Europe/Madrid)
- `v` - Valor de la medición
- `@timestamp` - Fecha y hora en formato ISO 8601 UTC

---

### GET /station/aforo/:id/:type/graph

Devuelve una visualización gráfica de los datos históricos usando Chart.js con escala de tiempo.

**Parámetros:**

- `id` - Identificador de la estación (ej: `EA013`)
- `type` - Tipo de medición: `nivel` o `caudal`

**Respuesta:**

Página HTML interactiva con:

- Gráfico de líneas con escala de tiempo real
- Estadísticas: total de mediciones, mínimo, máximo, promedio y percentil 5%
- Línea de referencia visual del percentil 5% en el gráfico
- Diseño responsive con gradientes y animaciones
- Tooltips interactivos con información detallada
- Zoom y pan interactivo (rueda del ratón, botones o arrastrar)
- Enlaces para ver los datos en JSON y volver a la estación

**Ejemplo:**

```
http://localhost:3000/station/aforo/EA013/nivel/graph
```

## Caché

La API utiliza una caché en memoria con un TTL de **5 minutos**. Las respuestas de los tres endpoints de datos se cachean para reducir la carga sobre el portal SAIH Duero. La caché se comparte entre los endpoints `/station/aforo/:id/:type` y su variante `/graph`.

## Estructura del proyecto

```
chd-api/
├── .github/
│   └── workflows/
│       └── ci.yml               # Tests automáticos en CI
├── views/
│   └── graph.ejs                # Plantilla EJS para visualización
├── index.js                     # Servidor Express y rutas
├── helpers.js                   # Funciones de parsing y fetching
├── tests/
│   ├── helpers.test.js          # Suite de tests
│   └── fixtures/                # HTML de ejemplo para tests
│       ├── estaciones.html
│       ├── risr-estacion-aranda.html
│       ├── risr-estacion-aranda-nivel.html
│       └── risr-estacion-aranda-caudal.html
├── package.json
└── README.md
```

## Funciones principales (helpers.js)

### `parseStationsHTML(html)`

Extrae el listado de estaciones de aforo desde el HTML de la página principal.

### `parseStationDetailHTML(html)`

Extrae los tipos de medición disponibles para una estación.

### `parseStationAforoTypeHTML(html)`

Extrae los datos de chartData desde el JavaScript inline del HTML.

### `getAllStationsAforo()`

Obtiene todas las estaciones de aforo (wrapper async).

### `getStationDetail(stationId)`

Obtiene los detalles de una estación específica (wrapper async).

### `getStationAforoType(stationId, type)`

Obtiene los datos históricos de un tipo de medición (wrapper async).

## Conversión de zona horaria

Las fechas del sistema SAIH están en zona horaria **Europe/Madrid** (CET/CEST). La API las convierte automáticamente a **UTC** en el campo `@timestamp`:

```
Europe/Madrid: 20/11/2025 00:00 (CET, UTC+1)
↓
UTC: 2025-11-19T23:00:00.000Z
```

## Licencia

ISC

## Autor

Guillermo Lopez <glopez@arandadeduero.es>
