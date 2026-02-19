# CHD API

API REST para consultar datos de la Confederación Hidrográfica del Duero (CHD) desde el portal SAIH Duero.

## Descripción

Esta API proporciona endpoints para acceder a información de las estaciones de aforo del río Duero, extrayendo y procesando datos desde el sistema SAIH (Sistema Automático de Información Hidrológica) de la Confederación Hidrográfica del Duero.

La API realiza web scraping del portal [saihduero.es](https://www.saihduero.es/) para obtener:

- Listado de estaciones de aforo
- Detalles de cada estación
- Datos históricos de mediciones (nivel, caudal, etc.)
- Visualización gráfica de los datos con Chart.js

Todas las fechas se convierten automáticamente desde la zona horaria Europe/Madrid a UTC.

## Características

- ✅ API REST sin autenticación
- ✅ Sin límite de peticiones (rate limiting)
- ✅ Conversión automática de zonas horarias (Europe/Madrid → UTC)
- ✅ Extracción de datos desde HTML mediante web scraping
- ✅ Visualización gráfica interactiva con Chart.js
- ✅ Cobertura de tests del 85.57%
- ✅ Tests automáticos con GitHub Actions (CI)

## Tecnologías

- **Express** 5.2.1 - Framework web
- **Cheerio** 1.2.0 - Parsing de HTML
- **Axios** 1.13.5 - Cliente HTTP
- **Day.js** 1.11.19 - Manejo de fechas y zonas horarias
- **EJS** 4.0.1 - Motor de plantillas
- **Chart.js** 4.4.1 - Visualización de gráficos con escala de tiempo
- **Ava** 6.4.1 - Framework de testing
- **c8** 10.1.3 - Cobertura de código

## Instalación

```bash
npm install
```

## Uso

### Modo producción

```bash
npm start
```

El servidor se ejecuta en `http://localhost:3000`

### Modo desarrollo (con hot reload)

```bash
npm run dev
```

### Tests

```bash
npm test
```

Los tests incluyen cobertura de código y fixtures para validar el parsing de HTML.

### Integración Continua (CI)

El proyecto utiliza GitHub Actions para ejecutar tests automáticamente:

- ✅ En cada push a las ramas `main`, `master` o `develop`
- ✅ En cada Pull Request hacia estas ramas
- ✅ Tests en múltiples versiones de Node.js (22.x, 24.x y latest)
- ✅ Generación de reportes de cobertura

El workflow de CI se encuentra en `.github/workflows/ci.yml`

## Endpoints

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

### GET /station/aforo/:id

Devuelve los tipos de medición disponibles para una estación específica.

**Parámetros:**

- `id` - Identificador de la estación (ej: "EA013")

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

### GET /station/aforo/:id/:type

Devuelve los datos históricos de una medición específica para una estación.

**Parámetros:**

- `id` - Identificador de la estación (ej: "EA013")
- `type` - Tipo de medición (ej: "nivel", "caudal")

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

### GET /station/aforo/:id/:type/graph

Devuelve una visualización gráfica de los datos históricos usando Chart.js con escala de tiempo.

**Parámetros:**

- `id` - Identificador de la estación (ej: "EA013")
- `type` - Tipo de medición (ej: "nivel", "caudal")

**Respuesta:**

Página HTML interactiva con:

- 📈 Gráfico de líneas con escala de tiempo real
- 📊 Estadísticas avanzadas:
  - Total de mediciones, mínimo, máximo y promedio
  - Percentil 5% (5% de valores más bajos)
  - Diferencia con respecto al percentil 5% (en valor absoluto y porcentaje)
- 📉 Línea de referencia visual del percentil 5% en el gráfico
- 🎨 Diseño moderno con gradientes y animaciones
- 👁️ Tooltips interactivos con información detallada
- � Zoom y pan interactivo (rueda del ratón, botones o arrastrar)
- �📱 Responsive y adaptable a móviles
- 🔗 Enlaces para ver datos JSON y volver a la estación

**Ejemplo de uso:**

```
http://localhost:3000/station/aforo/EA013/nivel/graph
```

## Estructura del proyecto

```
chd-api/
├── .github/
│   └── workflows/
│       └── ci.yml               # Tests automáticos en CI
├── views/
│   └── graph.ejs            # Plantilla EJS para visualización
├── index.js                      # Servidor Express y rutas
├── helpers.js                    # Funciones de parsing y fetching
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

## Funciones principales

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
