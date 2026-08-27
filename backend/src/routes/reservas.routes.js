import { Router } from "express";
import redisClient from "../redis.js";

const router = Router();

router.post("/", async (req, res) => {
  const { viajeId, nombre, cantidadAsientos } = req.body;

  const asientos = await redisClient.get(`viaje:${viajeId}:asientos`);

  if (!asientos) {
    return res.status(404).json({
      error: "El viaje no existe",
    });
  }

  if (Number(asientos) < cantidadAsientos) {
    return res.status(400).json({
      error: "No hay suficientes asientos disponibles",
    });
  }

  const reservaId = await redisClient.incr("reserva:id");

  const reserva = {
    id: reservaId.toString(),
    viajeId,
    nombre,
    cantidadAsientos,
    estado: "pendiente",
  };

  await redisClient.hSet(`reserva:${reservaId}`, reserva);

  await redisClient.expire(`reserva:${reservaId}`, 60);

  await redisClient.rPush("cola:reservas", reservaId.toString());

  res.status(201).json(reserva);
});

router.post("/procesar", async (req, res) => {
  let reservaId;
  let reserva;

  while (true) {
    reservaId = await redisClient.lPop("cola:reservas");

    if (!reservaId) {
      return res.status(404).json({
        error: "No hay reservas pendientes",
      });
    }

    reserva = await redisClient.hGetAll(`reserva:${reservaId}`);

    if (Object.keys(reserva).length > 0) {
      break;
    }
    await redisClient.rPush("reservas:expiradas", reservaId);

    console.log(`Reserva ${reservaId} expirada. Se elimina de la cola.`);
  }

  const asientosKey = `viaje:${reserva.viajeId}:asientos`;

  const asientosActuales = await redisClient.get(asientosKey);

  const nuevosAsientos =
    Number(asientosActuales) - Number(reserva.cantidadAsientos);

  await redisClient.set(asientosKey, nuevosAsientos);

  await redisClient.hSet(`reserva:${reservaId}`, {
    estado: "procesada",
  });

  reserva.estado = "procesada";

  res.json({
    mensaje: "Reserva procesada correctamente",
    reserva,
    asientosRestantes: nuevosAsientos,
  });
});

export default router;
