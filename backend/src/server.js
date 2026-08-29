import cors from "cors";
import express from "express";

import redisClient from "./redis.js";
import viajesRouter from "./routes/viajes.routes.js";
import reservasRouter from "./routes/reservas.routes.js";

const app = express();

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/viajes", viajesRouter);
app.use("/reservas", reservasRouter);

app.get("/health", async (_request, response) => {
  try {
    const redisReply = await redisClient.ping();

    response.json({
      backend: "ok",
      redis: redisReply === "PONG" ? "healthy" : "unhealthy",
    });
  } catch (error) {
    response.status(500).json({
      backend: "error",
      redis: "unhealthy",
      message: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});