import express from "express";
import cors from "cors";
import votingRouter from "./routes/voting";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// 投票相关路由
app.use('/api/v1/voting', votingRouter);


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
