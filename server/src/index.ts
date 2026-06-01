import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import itemsRouter from './routes/items';
import lookupRouter from './routes/lookup';

const app = express();
const PORT = process.env.PORT || 8002;

app.use(cors());
app.use(express.json());

app.use('/api/items', itemsRouter);
app.use('/api/lookup', lookupRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`BibliAnalogique API running on http://localhost:${PORT}`);
});
