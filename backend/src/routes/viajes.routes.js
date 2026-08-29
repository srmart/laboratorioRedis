import { Router } from "express";

import redisClient from "../redis.js";

import { leerViajesCSV } from "../data/viajes.js";

const router = Router();

// ==========================================================
// GET /viajes
// ==========================================================

router.get("/", async (req, res) => {
  const { origen, destino, fecha } = req.query;

  if (!origen || !destino || !fecha) {
    return res.status(400).json({
      error: "Origen, destino y fecha son obligatorios",
    });
  }

  try {
    // Buscar viajes NO modifica el caché del catálogo.
    // Si el catálogo existe, lo usamos.
    // Si no existe, leemos directamente el CSV.

    const cacheKey = "cache:catalogo";

    const cachedCatalogo = await redisClient.get(cacheKey);

    let catalogo;

    if (cachedCatalogo !== null) {
      console.log("BUSQUEDA: usando catálogo desde Redis");

      catalogo = JSON.parse(cachedCatalogo);
    } else {
      console.log("BUSQUEDA: catálogo no está en cache, leyendo CSV");

      catalogo = await leerViajesCSV();
    }

    // ======================================================
    // PREPARAMOS LOS DATOS DEL VIAJE PARA LOS ASIENTOS
    // ======================================================

    for (const viaje of catalogo) {
      const viajeKey = `viaje:${viaje.id}`;
      const capacidadKey = `viaje:${viaje.id}:capacidad`;

      const existeViaje = await redisClient.exists(viajeKey);

      if (!existeViaje) {
        await redisClient.hSet(viajeKey, {
          origen: viaje.origen,
          destino: viaje.destino,
          fecha: viaje.fecha,
          horaSalida: viaje.horaSalida,
          horaLlegada: viaje.horaLlegada,
          tipoBus: viaje.tipoBus,
          precio: String(viaje.precio),
        });
      }

      const existeCapacidad = await redisClient.exists(capacidadKey);

      if (!existeCapacidad) {
        await redisClient.set(capacidadKey, viaje.capacidad);
      }
    }

    // ======================================================
    // FILTRAR
    // ======================================================

    const viajes = catalogo.filter(
      (viaje) =>
        viaje.origen === origen &&
        viaje.destino === destino &&
        viaje.fecha === fecha,
    );

    return res.json(viajes);
  } catch (error) {
    console.error("Error buscando viajes:", error);

    return res.status(500).json({
      error: "Error obteniendo los viajes",
    });
  }
});

// ==========================================================
// GET /viajes/catalogo
// ==========================================================

router.get("/catalogo", async (req, res) => {
  try {
    const cacheKey = "cache:catalogo";

    // ======================================================
    // CACHE HIT
    // ======================================================

    const cachedCatalogo = await redisClient.get(cacheKey);

    if (cachedCatalogo !== null) {
      const cacheHits = await redisClient.incr("cache:hits");

      const cacheMisses = Number(await redisClient.get("cache:misses")) || 0;

      console.log("CACHE HIT:", cacheKey);

      return res.json({
        catalogo: JSON.parse(cachedCatalogo),

        cacheStatus: "HIT",

        cacheHits,

        cacheMisses,
      });
    }

    // ======================================================
    // CACHE MISS
    // ======================================================

    const cacheMisses = await redisClient.incr("cache:misses");

    console.log("CACHE MISS:", cacheKey);

    // ======================================================
    // LEER CSV
    // ======================================================

    const catalogo = await leerViajesCSV();

    // ======================================================
    // GUARDAR ORÍGENES Y DESTINOS EN SETS DE REDIS
    // ======================================================

    for (const viaje of catalogo) {
      await redisClient.sAdd("origenes:disponibles", viaje.origen);

      await redisClient.sAdd("destinos:disponibles", viaje.destino);
    }

    // ======================================================
    // PREPARAR LOS VIAJES EN REDIS
    // ======================================================

    for (const viaje of catalogo) {
      const viajeKey = `viaje:${viaje.id}`;

      const capacidadKey = `viaje:${viaje.id}:capacidad`;

      // solo creamos el viaje si todavía no existe.

      const existeViaje = await redisClient.exists(viajeKey);

      if (!existeViaje) {
        await redisClient.hSet(viajeKey, {
          origen: viaje.origen,

          destino: viaje.destino,

          fecha: viaje.fecha,

          horaSalida: viaje.horaSalida,

          horaLlegada: viaje.horaLlegada,

          tipoBus: viaje.tipoBus,

          precio: String(viaje.precio),
        });
      }

      const existeCapacidad = await redisClient.exists(capacidadKey);

      if (!existeCapacidad) {
        await redisClient.set(
          capacidadKey,

          viaje.capacidad,
        );
      }
    }

    // ======================================================
    // MÉTRICAS
    // ======================================================

    const cacheHits = Number(await redisClient.get("cache:hits")) || 0;

    return res.json({
      catalogo,

      cacheStatus: "MISS",

      cacheHits,

      cacheMisses,
    });
  } catch (error) {
    console.error("ERROR OBTENIENDO CATÁLOGO:", error);

    return res.status(500).json({
      error: "Error obteniendo el catálogo",
    });
  }
});

// ==========================================================
// GET /viajes/opciones
// Obtener orígenes y destinos disponibles desde Redis
// ==========================================================

router.get("/opciones", async (_req, res) => {
  try {
    const origenes = await redisClient.sMembers("origenes:disponibles");

    const destinos = await redisClient.sMembers("destinos:disponibles");

    return res.json({
      origenes,
      destinos,
    });
  } catch (error) {
    console.error("Error obteniendo opciones de viaje:", error);

    return res.status(500).json({
      error: "Error obteniendo orígenes y destinos",
    });
  }
});

// ==========================================================
// GET /viajes/:id/asientos
// ==========================================================

router.get("/:id/asientos", async (req, res) => {
  const viajeId = req.params.id;

  try {
    const capacidad = await redisClient.get(`viaje:${viajeId}:capacidad`);

    if (capacidad === null) {
      return res.status(404).json({
        error: "El viaje no existe",
      });
    }

    const capacidadNumerica = Number(capacidad);

    const asientos = [];

    for (let numero = 1; numero <= capacidadNumerica; numero++) {
      const key = `viaje:${viajeId}:asiento:${numero}`;

      const estado = await redisClient.get(key);

      let estadoAsiento = "disponible";

      if (estado === "vendido") {
        estadoAsiento = "vendido";
      } else if (estado !== null) {
        estadoAsiento = "bloqueado";
      }

      asientos.push({
        numero,

        estado: estadoAsiento,
      });
    }

    return res.json({
      viajeId,

      capacidad: capacidadNumerica,

      asientos,
    });
  } catch (error) {
    console.error("Error obteniendo asientos:", error);

    return res.status(500).json({
      error: "Error obteniendo los asientos",
    });
  }
});

export default router;
