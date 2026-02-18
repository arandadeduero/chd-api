import express from 'express';
import { getAllStationsAforo, getStationDetail, getStationAforoType } from './helpers.js';

const app = express();
const PORT = 3000;

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

// Start server
app.listen(PORT, () => {
    console.log(`CHD API server running on http://localhost:${PORT}`);
});
