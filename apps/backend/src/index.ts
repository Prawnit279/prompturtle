import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'prompturtle-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🐢 Prompturtle API running on port ${PORT}`);
});

export default app;
