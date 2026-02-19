import express from 'express';
import { getAllStationsAforo, getStationDetail, getStationAforoType } from './helpers.js';
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

// Routes
app.get('/station/aforo/all', async (req, res) => {
    const stations = await getAllStationsAforo();
    res.json(stations);
});

app.get('/station/aforo/:id', async (req, res) => {
    const detail = await getStationDetail(req.params.id);
    res.json(detail);
});

app.get('/station/aforo/:id/:type', async (req, res) => {
    const chartData = await getStationAforoType(req.params.id, req.params.type);
    res.json(chartData);
});

app.get('/station/aforo/:id/:type/graph', async (req, res) => {
    const chartData = await getStationAforoType(req.params.id, req.params.type);

    // Calculate statistics
    const values = chartData.map(item => item.v);

    const stats = {
        total: chartData.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        startDate: chartData[0]?.d || 'N/A',
        endDate: chartData[chartData.length - 1]?.d || 'N/A'
    };

    res.render('graph', {
        stationId: req.params.id,
        type: req.params.type,
        chartData: chartData,
        stats: stats
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`CHD API server running on http://localhost:${PORT}`);
});
