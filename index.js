import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { getAllStationsAforo, getStationDetail, getStationAforoType, NotFoundError, UpstreamTimeoutError } from './helpers.js';
import { openapiSpec } from './openapi.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());

// Simple in-memory TTL cache
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function cacheSet(key, value) {
    cache.set(key, { value, ts: Date.now() });
}

// Input validation helpers
const STATION_ID_RE = /^[A-Za-z0-9_-]{1,20}$/;

// Map URL-safe slugs → exact scraped type strings (lowercase)
const TYPE_SLUG_MAP = {
    'nivel':         'nivel',
    'caudal':        'caudal',
    'temperatura':   'temperatura ambiente',
    'pluviometria':  'pluviometría',
};

function validateStationId(id) {
    return STATION_ID_RE.test(id);
}

function validateType(slug) {
    return slug.toLowerCase() in TYPE_SLUG_MAP;
}

function resolveType(slug) {
    return TYPE_SLUG_MAP[slug.toLowerCase()] ?? null;
}

// Routes

app.get('/', (req, res) => {
    res.render('home');
});

app.get('/openapi.json', (req, res) => {
    res.json(openapiSpec);
});

const swaggerUiOptions = {
    customSiteTitle: 'CHD API · Docs',
    customCss: `
        body { background: #0d1117; }
        .swagger-ui { filter: invert(0.88) hue-rotate(180deg); }
        .swagger-ui .topbar { display: none; }
        .swagger-ui img,
        .swagger-ui .microlight { filter: invert(1) hue-rotate(180deg); }
    `,
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerUiOptions));

app.get('/graph', async (req, res, next) => {
    try {
        const cached = cacheGet('all_stations');
        const stations = cached ?? await getAllStationsAforo();
        if (!cached) cacheSet('all_stations', stations);
        res.render('stations', { stations });
    } catch (err) {
        next(err);
    }
});

app.get('/graph/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!validateStationId(id)) {
            return res.status(400).json({ error: 'Invalid station id' });
        }

        // Get station info from the list
        const allCached = cacheGet('all_stations');
        const allStations = allCached ?? await getAllStationsAforo();
        if (!allCached) cacheSet('all_stations', allStations);
        const stationInfo = allStations.find(s => s.stationId === id.toUpperCase()) || null;

        const cacheKey = `station_${id}`;
        const cached = cacheGet(cacheKey);
        const detail = cached ?? await getStationDetail(id);
        if (!cached) cacheSet(cacheKey, detail);

        res.render('station', { stationId: id, stationInfo, detail, typeSlugMap: TYPE_SLUG_MAP });
    } catch (err) {
        next(err);
    }
});

app.get('/graph/:id/:type', async (req, res, next) => {
    try {
        const { id, type } = req.params;
        if (!validateStationId(id)) {
            return res.status(400).json({ error: 'Invalid station id' });
        }
        if (!validateType(type)) {
            return res.status(400).json({ error: `Invalid type. Allowed: ${Object.keys(TYPE_SLUG_MAP).join(', ')}` });
        }

        const resolvedType = resolveType(type);
        const cacheKey = `station_${id}_${type}`;
        const cached = cacheGet(cacheKey);
        const chartData = cached ?? await getStationAforoType(id, resolvedType);
        if (!cached) cacheSet(cacheKey, chartData);

        const values = chartData.map(item => item.v).filter(v => typeof v === 'number' && isFinite(v));
        const hasData = values.length > 0;

        const stats = {
            total: chartData.length,
            min: hasData ? Math.min(...values) : null,
            max: hasData ? Math.max(...values) : null,
            avg: hasData ? values.reduce((a, b) => a + b, 0) / values.length : null,
            startDate: chartData[0]?.d || 'N/A',
            endDate: chartData[chartData.length - 1]?.d || 'N/A'
        };

        res.render('graph', { stationId: id, type: resolvedType, typeSlug: type, chartData, stats });
    } catch (err) {
        next(err);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/station/aforo/all', async (req, res, next) => {
    try {
        const cached = cacheGet('all_stations');
        if (cached) return res.json(cached);

        const stations = await getAllStationsAforo();
        cacheSet('all_stations', stations);
        res.json(stations);
    } catch (err) {
        next(err);
    }
});

app.get('/station/aforo/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!validateStationId(id)) {
            return res.status(400).json({ error: 'Invalid station id' });
        }

        const cacheKey = `station_${id}`;
        const cached = cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const detail = await getStationDetail(id);
        cacheSet(cacheKey, detail);
        res.json(detail);
    } catch (err) {
        next(err);
    }
});

app.get('/station/aforo/:id/:type', async (req, res, next) => {
    try {
        const { id, type } = req.params;
        if (!validateStationId(id)) {
            return res.status(400).json({ error: 'Invalid station id' });
        }
        if (!validateType(type)) {
            return res.status(400).json({ error: `Invalid type. Allowed: ${Object.keys(TYPE_SLUG_MAP).join(', ')}` });
        }

        const resolvedType = resolveType(type);
        const cacheKey = `station_${id}_${type}`;
        const cached = cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const chartData = await getStationAforoType(id, resolvedType);
        cacheSet(cacheKey, chartData);
        res.json(chartData);
    } catch (err) {
        next(err);
    }
});

app.get('/station/aforo/:id/:type/graph', async (req, res, next) => {
    try {
        const { id, type } = req.params;
        if (!validateStationId(id)) {
            return res.status(400).json({ error: 'Invalid station id' });
        }
        if (!validateType(type)) {
            return res.status(400).json({ error: `Invalid type. Allowed: ${Object.keys(TYPE_SLUG_MAP).join(', ')}` });
        }

        const resolvedType = resolveType(type);
        const cacheKey = `station_${id}_${type}`;
        const cached = cacheGet(cacheKey);
        const chartData = cached ?? await getStationAforoType(id, resolvedType);
        if (!cached) cacheSet(cacheKey, chartData);

        // Calculate statistics safely
        const values = chartData.map(item => item.v).filter(v => typeof v === 'number' && isFinite(v));
        const hasData = values.length > 0;

        const stats = {
            total: chartData.length,
            min: hasData ? Math.min(...values) : null,
            max: hasData ? Math.max(...values) : null,
            avg: hasData ? values.reduce((a, b) => a + b, 0) / values.length : null,
            startDate: chartData[0]?.d || 'N/A',
            endDate: chartData[chartData.length - 1]?.d || 'N/A'
        };

        res.render('graph', {
            stationId: id,
            type: resolvedType,
            typeSlug: type,
            chartData,
            stats
        });
    } catch (err) {
        next(err);
    }
});

// Error handler
app.use((err, req, res, _next) => {
    const context = `${req.method} ${req.originalUrl}`;
    if (err instanceof NotFoundError) {
        console.warn(`Not found [${context}]:`, err.message);
        return res.status(404).json({ error: err.message });
    }
    if (err instanceof UpstreamTimeoutError) {
        console.error(`SAIH timeout [${context}]:`, err.message);
        return res.status(500).json({ error: 'SAIH did not respond in time' });
    }
    console.error(`Unhandled error [${context}] [${err.code ?? err.name}]:`, err.stack || err.message);
    res.status(500).json({ error: 'Internal server error' });
});

export { app, TYPE_SLUG_MAP };

// Start server only when run directly
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    app.listen(PORT, () => {
        console.log(`CHD API server running on http://localhost:${PORT}`);
    });
}
