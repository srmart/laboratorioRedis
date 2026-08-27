import { Router } from "express";
import redisClient from "../redis.js";

const router = Router();

router.get("/", async (req, res) => {
  const { origen, destino, fecha } = req.query;

  console.log("QUERY:", JSON.stringify({ origen, destino, fecha }));

  const cacheKey = `cache:viajes:${origen}:${destino}:${fecha}`;

  const cachedViajes = await redisClient.get(cacheKey);

  if (cachedViajes) {
    await redisClient.incr("cache:hits");

    return res.json(JSON.parse(cachedViajes));
  }

  await redisClient.incr("cache:misses");

  const keys = await redisClient.keys("viaje:*");

  console.log("REDIS PING:", await redisClient.ping());
  console.log("VIAJE 1:", JSON.stringify(await redisClient.hGetAll("viaje:1")));

  console.log("KEYS ENCONTRADAS:", keys.length, JSON.stringify(keys));

  const viajeKeys = keys.filter((key) => !key.endsWith(":asientos"));

  console.log(
    "VIAJE KEYS (sin asientos):",
    viajeKeys.length,
    JSON.stringify(viajeKeys),
  );

  const viajes = [];

  for (const key of viajeKeys) {
    const viaje = await redisClient.hGetAll(key);

    console.log("COMPARANDO:", key, JSON.stringify(viaje));

    console.log("FILTROS:", JSON.stringify({ origen, destino, fecha }));

    if (
      viaje.origen === origen &&
      viaje.destino === destino &&
      viaje.fecha === fecha
    ) {
      console.log("COINCIDE:", key);

      viajes.push(viaje);
    }
  }

  await redisClient.set(cacheKey, JSON.stringify(viajes));

  res.json(viajes);
});

export default router;
