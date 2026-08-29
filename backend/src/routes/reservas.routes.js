import { Router } from "express";

import redisClient from "../redis.js";

const router = Router();

const TIEMPO_RESERVA = 60;


/*
 * ==========================================================
 * GET /reservas
 * ==========================================================
 *
 * Devuelve todas las reservas existentes.
 */
router.get("/", async (req, res) => {
  try {
    const keys = await redisClient.keys("reserva:*");
    const reservas = [];

    for (const key of keys) {
      if (key === "reserva:id") {
        continue;
      }

      const reserva = await redisClient.hGetAll(key);

if (Object.keys(reserva).length === 0) {
  continue;
}

const viaje = await redisClient.hGetAll(
  `viaje:${reserva.viajeId}`
);

if (Object.keys(viaje).length > 0) {
  if (viaje.precio !== undefined) {
    viaje.precio = Number(viaje.precio);
  }

  reservas.push({
    ...reserva,
    origen: viaje.origen,
    destino: viaje.destino,
    fecha: viaje.fecha,
    horaSalida: viaje.horaSalida,
    horaLlegada: viaje.horaLlegada,
    precio: viaje.precio,
  });
} else {
  reservas.push(reserva);
}
    }

    reservas.sort((a, b) => Number(a.id) - Number(b.id));

    return res.json(reservas);
  } catch (error) {
    console.error("Error obteniendo reservas:", error);

    return res.status(500).json({
      error: "Error obteniendo las reservas",
    });
  }
});


/*
 * ==========================================================
 * GET /reservas/:id
 * ==========================================================
 *
 * Obtiene una reserva y su TTL actual.
 */
router.get("/:id", async (req, res) => {
  const reservaId = req.params.id;
  const reservaKey = `reserva:${reservaId}`;

  try {
    const reserva = await redisClient.hGetAll(reservaKey);

    if (Object.keys(reserva).length === 0) {
      return res.status(404).json({
        error: "La reserva no existe o expiró",
      });
    }

    const ttl = await redisClient.ttl(reservaKey);

    return res.json({
      ...reserva,
      ttl,
    });
  } catch (error) {
    console.error("Error consultando reserva:", error);

    return res.status(500).json({
      error: "Error consultando la reserva",
    });
  }
});


/*
 * ==========================================================
 * POST /reservas
 * ==========================================================
 *
 * Crea una nueva reserva y bloquea los asientos.
 */
router.post("/", async (req, res) => {
  const { viajeId, nombre, asientos } = req.body;

  /*
   * Validaciones básicas.
   */
  if (
    !viajeId ||
    !nombre ||
    !Array.isArray(asientos) ||
    asientos.length === 0
  ) {
    return res.status(400).json({
      error: "Datos de reserva inválidos",
    });
  }

  /*
   * Evitar asientos repetidos.
   */
  const asientosUnicos = [...new Set(asientos)];

  if (asientosUnicos.length !== asientos.length) {
    return res.status(400).json({
      error: "No se puede reservar el mismo asiento más de una vez",
    });
  }

  try {
    /*
     * Verificar que el viaje exista.
     */
    const capacidad = await redisClient.get(
      `viaje:${viajeId}:capacidad`
    );

    if (capacidad === null) {
      return res.status(404).json({
        error: "El viaje no existe",
      });
    }

    const capacidadNumerica = Number(capacidad);

    /*
     * Verificar que los asientos sean válidos.
     */
    const asientosValidos = asientosUnicos.every(
      (asiento) =>
        Number.isInteger(asiento) &&
        asiento >= 1 &&
        asiento <= capacidadNumerica
    );

    if (!asientosValidos) {
      return res.status(400).json({
        error: "Uno o más asientos no son válidos",
      });
    }

    /*
     * Crear las claves de los asientos.
     */
    const clavesAsientos = asientosUnicos.map(
      (asiento) =>
        `viaje:${viajeId}:asiento:${asiento}`
    );

    /*
     * WATCH
     *
     * Nos permite detectar si otro usuario modifica
     * alguno de estos asientos mientras intentamos reservarlos.
     */
    await redisClient.watch(...clavesAsientos);

    try {
      /*
       * Verificar que todos los asientos siguen libres.
       */
      const estados = await Promise.all(
        clavesAsientos.map(
          (key) => redisClient.get(key)
        )
      );

      const asientoOcupado = estados.some(
        (estado) => estado !== null
      );

      if (asientoOcupado) {
        await redisClient.unwatch();

        return res.status(409).json({
          error: "Uno o más asientos ya no están disponibles",
        });
      }

      /*
       * Generar ID de reserva.
       */
      const reservaId = await redisClient.incr(
        "reserva:id"
      );

      const reservaKey = `reserva:${reservaId}`;

      /*
       * Crear reserva y bloquear asientos
       * dentro de una única transacción.
       */
      const transaction = redisClient.multi();

      transaction.hSet(reservaKey, {
        id: reservaId.toString(),
        viajeId: viajeId.toString(),
        nombre,
        asientos: JSON.stringify(asientosUnicos),
        estado: "pendiente",
      });

      transaction.expire(
        reservaKey,
        TIEMPO_RESERVA
      );

      for (const asiento of asientosUnicos) {
        transaction.set(
          `viaje:${viajeId}:asiento:${asiento}`,
          reservaKey,
          {
            EX: TIEMPO_RESERVA,
          }
        );
      }

      const resultado = await transaction.exec();

      /*
       * Si EXEC devuelve null significa que alguna
       * de las claves vigiladas cambió.
       */
      if (resultado === null) {
        return res.status(409).json({
          error: "Los asientos fueron reservados por otro usuario",
        });
      }

      return res.status(201).json({
        id: reservaId.toString(),
        viajeId: viajeId.toString(),
        nombre,
        asientos: asientosUnicos,
        estado: "pendiente",
        expiraEnSegundos: TIEMPO_RESERVA,
      });
    } catch (error) {
      await redisClient.unwatch();
      throw error;
    }
  } catch (error) {
    console.error("Error creando reserva:", error);

    return res.status(500).json({
      error: "Error al crear la reserva",
    });
  }
});


/*
 * ==========================================================
 * POST /reservas/:id/finalizar
 * ==========================================================
 *
 * La reserva deja de ser una reserva temporal y entra
 * en la cola FIFO.
 */
router.post("/:id/finalizar", async (req, res) => {
  const reservaId = req.params.id;
  const reservaKey = `reserva:${reservaId}`;

  try {
    const reserva = await redisClient.hGetAll(
      reservaKey
    );

    if (Object.keys(reserva).length === 0) {
      return res.status(404).json({
        error: "La reserva no existe o expiró",
      });
    }

    if (reserva.estado !== "pendiente") {
      return res.status(400).json({
        error: "La reserva ya no está pendiente",
      });
    }

    /*
     * Importante:
     *
     * WATCH evita que dos operaciones intenten
     * finalizar la misma reserva.
     */
    await redisClient.watch(reservaKey);

    try {
      const reservaActual = await redisClient.hGetAll(
        reservaKey
      );

      if (Object.keys(reservaActual).length === 0) {
        await redisClient.unwatch();

        return res.status(404).json({
          error: "La reserva expiró",
        });
      }

      if (reservaActual.estado !== "pendiente") {
        await redisClient.unwatch();

        return res.status(400).json({
          error: "La reserva ya no está pendiente",
        });
      }

      const transaction = redisClient.multi();

      transaction.hSet(reservaKey, {
        estado: "en_cola",
      });

      transaction.rPush(
        "cola:reservas",
        reservaId.toString()
      );

      const resultado = await transaction.exec();

      if (resultado === null) {
        return res.status(409).json({
          error: "La reserva fue modificada por otra operación",
        });
      }

      return res.json({
        mensaje: "Reserva finalizada y agregada a la cola",
        reserva: {
          ...reservaActual,
          estado: "en_cola",
        },
      });
    } catch (error) {
      await redisClient.unwatch();
      throw error;
    }
  } catch (error) {
    console.error("Error finalizando reserva:", error);

    return res.status(500).json({
      error: "Error al finalizar la reserva",
    });
  }
});


/*
 * ==========================================================
 * POST /reservas/procesar
 * ==========================================================
 *
 * Toma la siguiente reserva de la cola FIFO.
 */
router.post("/procesar", async (_req, res) => {
  try {
    while (true) {
      /*
       * LPOP obtiene la primera reserva de la cola.
       */
      const reservaId = await redisClient.lPop(
        "cola:reservas"
      );

      if (!reservaId) {
        return res.status(404).json({
          error: "No hay reservas pendientes en la cola",
        });
      }

      const reservaKey = `reserva:${reservaId}`;

      const reserva = await redisClient.hGetAll(
        reservaKey
      );

      /*
       * Si expiró antes de ser procesada,
       * simplemente seguimos con la siguiente.
       */
      if (Object.keys(reserva).length === 0) {
        console.log(
          `Reserva ${reservaId} expirada. Se elimina de la cola.`
        );

        continue;
      }

      if (reserva.estado !== "en_cola") {
        continue;
      }

      /*
       * Cambiamos el estado a procesando.
       *
       * La reserva ya no debe expirar mientras
       * está siendo procesada.
       */
      const transaction = redisClient.multi();

      transaction.hSet(reservaKey, {
        estado: "procesando",
      });

      transaction.persist(reservaKey);

      const asientos = JSON.parse(
        reserva.asientos
      );

      for (const asiento of asientos) {
        const asientoKey =
          `viaje:${reserva.viajeId}:asiento:${asiento}`;

        transaction.persist(asientoKey);
      }

      const resultado = await transaction.exec();

      if (resultado === null) {
        return res.status(409).json({
          error: "La reserva fue modificada por otra operación",
        });
      }

      return res.json({
        mensaje: "Reserva procesada correctamente",
        reserva: {
          ...reserva,
          estado: "procesando",
        },
      });
    }
  } catch (error) {
    console.error("Error procesando reserva:", error);

    return res.status(500).json({
      error: "Error al procesar la reserva",
    });
  }
});


/*
 * ==========================================================
 * POST /reservas/resolver
 * ==========================================================
 *
 * Resuelve la siguiente reserva que esté siendo procesada.
 *
 * El frontend llama a:
 *
 * POST /api/reservas/resolver
 */
router.post("/resolver", async (_req, res) => {
  try {
    /*
     * Buscamos las reservas en estado "procesando".
     *
     * Como los IDs son incrementales, ordenamos por ID.
     */
    const keys = await redisClient.keys("reserva:*");
    const reservasProcesando = [];

    for (const key of keys) {
      if (key === "reserva:id") {
        continue;
      }

      const reserva = await redisClient.hGetAll(key);

      if (
        Object.keys(reserva).length > 0 &&
        reserva.estado === "procesando"
      ) {
        reservasProcesando.push(reserva);
      }
    }

    if (reservasProcesando.length === 0) {
      return res.status(404).json({
        error: "No hay reservas para resolver",
      });
    }

    reservasProcesando.sort(
      (a, b) => Number(a.id) - Number(b.id)
    );

    const reserva = reservasProcesando[0];

    const reservaId = reserva.id;
    const reservaKey = `reserva:${reservaId}`;

    const asientos = JSON.parse(
      reserva.asientos
    );

    const clavesAsientos = asientos.map(
      (asiento) =>
        `viaje:${reserva.viajeId}:asiento:${asiento}`
    );

    /*
     * WATCH
     *
     * Vigilamos la reserva y sus asientos.
     */
    await redisClient.watch(
      reservaKey,
      ...clavesAsientos
    );

    try {
      const reservaActual =
        await redisClient.hGetAll(reservaKey);

      if (Object.keys(reservaActual).length === 0) {
        await redisClient.unwatch();

        return res.status(404).json({
          error: "La reserva no existe",
        });
      }

      if (reservaActual.estado !== "procesando") {
        await redisClient.unwatch();

        return res.status(400).json({
          error: "La reserva ya no está siendo procesada",
        });
      }

      /*
       * Verificar que los asientos siguen perteneciendo
       * a esta reserva.
       */
      const propietarios = await Promise.all(
        clavesAsientos.map(
          (key) => redisClient.get(key)
        )
      );

      const todosPertenecenALaReserva =
        propietarios.every(
          (propietario) => propietario === reservaKey
        );

      if (!todosPertenecenALaReserva) {
        await redisClient.unwatch();

        return res.status(409).json({
          error:
            "Uno o más asientos ya no pertenecen a esta reserva",
        });
      }

      /*
       * Resolver la reserva y convertir los asientos
       * en vendidos dentro de una única transacción.
       */
      const transaction = redisClient.multi();

      transaction.hSet(reservaKey, {
        estado: "resuelta",
      });

      for (const asiento of asientos) {
        const asientoKey =
          `viaje:${reservaActual.viajeId}:asiento:${asiento}`;

        transaction.set(
          asientoKey,
          "vendido"
        );

        transaction.persist(asientoKey);
      }

      transaction.persist(reservaKey);

      const resultado = await transaction.exec();

      if (resultado === null) {
        return res.status(409).json({
          error:
            "La reserva fue modificada por otra operación",
        });
      }

      return res.json({
        mensaje: "Reserva resuelta correctamente",
        reserva: {
          ...reservaActual,
          estado: "resuelta",
        },
      });
    } catch (error) {
      await redisClient.unwatch();
      throw error;
    }
  } catch (error) {
    console.error("Error resolviendo reserva:", error);

    return res.status(500).json({
      error: "Error al resolver la reserva",
    });
  }
});


/*
 * ==========================================================
 * POST /reservas/:id/confirmar
 * ==========================================================
 *
 * Endpoint que dejamos para pruebas.
 *
 * No forma parte del flujo principal de la cola.
 */
router.post("/:id/confirmar", async (req, res) => {
  const reservaId = req.params.id;
  const reservaKey = `reserva:${reservaId}`;

  try {
    const reserva = await redisClient.hGetAll(
      reservaKey
    );

    if (Object.keys(reserva).length === 0) {
      return res.status(404).json({
        error: "La reserva no existe o expiró",
      });
    }

    if (reserva.estado !== "pendiente") {
      return res.status(400).json({
        error: "La reserva no está pendiente",
      });
    }

    const asientos = JSON.parse(
      reserva.asientos
    );

    const clavesAsientos = asientos.map(
      (asiento) =>
        `viaje:${reserva.viajeId}:asiento:${asiento}`
    );

    await redisClient.watch(
      reservaKey,
      ...clavesAsientos
    );

    try {
      const reservaActual =
        await redisClient.hGetAll(reservaKey);

      if (Object.keys(reservaActual).length === 0) {
        await redisClient.unwatch();

        return res.status(404).json({
          error: "La reserva expiró",
        });
      }

      if (reservaActual.estado !== "pendiente") {
        await redisClient.unwatch();

        return res.status(400).json({
          error: "La reserva ya no está pendiente",
        });
      }

      const propietarios = await Promise.all(
        clavesAsientos.map(
          (key) => redisClient.get(key)
        )
      );

      const todosPertenecenALaReserva =
        propietarios.every(
          (propietario) => propietario === reservaKey
        );

      if (!todosPertenecenALaReserva) {
        await redisClient.unwatch();

        return res.status(409).json({
          error:
            "Uno o más asientos ya no pertenecen a esta reserva",
        });
      }

      const transaction = redisClient.multi();

      transaction.hSet(reservaKey, {
        estado: "confirmada",
      });

      for (const asiento of asientos) {
        const asientoKey =
          `viaje:${reservaActual.viajeId}:asiento:${asiento}`;

        transaction.set(
          asientoKey,
          "vendido"
        );

        transaction.persist(asientoKey);
      }

      transaction.persist(reservaKey);

      const resultado = await transaction.exec();

      if (resultado === null) {
        return res.status(409).json({
          error:
            "La reserva fue modificada por otra operación",
        });
      }

      return res.json({
        mensaje: "Reserva confirmada correctamente",
        reserva: {
          ...reservaActual,
          estado: "confirmada",
        },
      });
    } catch (error) {
      await redisClient.unwatch();
      throw error;
    }
  } catch (error) {
    console.error("Error confirmando reserva:", error);

    return res.status(500).json({
      error: "Error al confirmar la reserva",
    });
  }
});


/*
 * ==========================================================
 * DELETE /reservas/:id
 * ==========================================================
 *
 * Cancela una reserva que todavía está pendiente.
 */
router.delete("/:id", async (req, res) => {
  const reservaId = req.params.id;
  const reservaKey = `reserva:${reservaId}`;

  try {
    const reserva = await redisClient.hGetAll(
      reservaKey
    );

    if (Object.keys(reserva).length === 0) {
      return res.status(404).json({
        error: "La reserva no existe o expiró",
      });
    }

    if (reserva.estado !== "pendiente") {
      return res.status(400).json({
        error: "La reserva ya no puede ser cancelada",
      });
    }

    const asientos = JSON.parse(
      reserva.asientos
    );

    const clavesAsientos = asientos.map(
      (asiento) =>
        `viaje:${reserva.viajeId}:asiento:${asiento}`
    );

    /*
     * WATCH para evitar cancelar una reserva
     * que haya sido modificada simultáneamente.
     */
    await redisClient.watch(
      reservaKey,
      ...clavesAsientos
    );

    try {
      const reservaActual =
        await redisClient.hGetAll(reservaKey);

      if (Object.keys(reservaActual).length === 0) {
        await redisClient.unwatch();

        return res.status(404).json({
          error: "La reserva expiró",
        });
      }

      if (reservaActual.estado !== "pendiente") {
        await redisClient.unwatch();

        return res.status(400).json({
          error: "La reserva ya no puede ser cancelada",
        });
      }

      const transaction = redisClient.multi();

      transaction.del(reservaKey);

      for (const asiento of asientos) {
        transaction.del(
          `viaje:${reservaActual.viajeId}:asiento:${asiento}`
        );
      }

      const resultado = await transaction.exec();

      if (resultado === null) {
        return res.status(409).json({
          error:
            "La reserva fue modificada por otra operación",
        });
      }

      return res.json({
        mensaje: "Reserva cancelada correctamente",
        reservaId,
      });
    } catch (error) {
      await redisClient.unwatch();
      throw error;
    }
  } catch (error) {
    console.error("Error cancelando reserva:", error);

    return res.status(500).json({
      error: "Error al cancelar la reserva",
    });
  }
});


export default router;