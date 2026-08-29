import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

await redisClient.connect();

const viajes = [
  {
    id: "1",
    origen: "Florida",
    destino: "Montevideo",
    fecha: "31/08/2026",
    horaSalida: "11:00",
    horaLlegada: "13:00",
    tipoBus: "Común",
    precio: 350,
    capacidad: 20,
  },
  {
    id: "2",
    origen: "Florida",
    destino: "Montevideo",
    fecha: "31/08/2026",
    horaSalida: "14:15",
    horaLlegada: "16:15",
    tipoBus: "Directo",
    precio: 350,
    capacidad: 20,
  },
  {
    id: "3",
    origen: "Florida",
    destino: "Montevideo",
    fecha: "01/09/2026",
    horaSalida: "08:00",
    horaLlegada: "10:00",
    tipoBus: "Directo",
    precio: 350,
    capacidad: 30,
  },
  {
    id: "4",
    origen: "Montevideo",
    destino: "Florida",
    fecha: "31/08/2026",
    horaSalida: "09:00",
    horaLlegada: "11:00",
    tipoBus: "Común",
    precio: 350,
    capacidad: 25,
  },
  {
    id: "5",
    origen: "Montevideo",
    destino: "Florida",
    fecha: "31/08/2026",
    horaSalida: "17:30",
    horaLlegada: "19:30",
    tipoBus: "Directo",
    precio: 400,
    capacidad: 20,
  },

  {
    id: "6",
    origen: "Montevideo",
    destino: "Canelones",
    fecha: "31/08/2026",
    horaSalida: "08:30",
    horaLlegada: "09:30",
    tipoBus: "Común",
    precio: 180,
    capacidad: 35,
  },
  {
    id: "7",
    origen: "Montevideo",
    destino: "Canelones",
    fecha: "01/09/2026",
    horaSalida: "13:00",
    horaLlegada: "14:00",
    tipoBus: "Directo",
    precio: 220,
    capacidad: 25,
  },
  {
    id: "8",
    origen: "Canelones",
    destino: "Montevideo",
    fecha: "31/08/2026",
    horaSalida: "10:00",
    horaLlegada: "11:00",
    tipoBus: "Común",
    precio: 180,
    capacidad: 30,
  },
  {
    id: "9",
    origen: "Canelones",
    destino: "Montevideo",
    fecha: "01/09/2026",
    horaSalida: "18:00",
    horaLlegada: "19:00",
    tipoBus: "Directo",
    precio: 220,
    capacidad: 25,
  },

  {
    id: "10",
    origen: "Montevideo",
    destino: "San José",
    fecha: "31/08/2026",
    horaSalida: "07:30",
    horaLlegada: "09:00",
    tipoBus: "Común",
    precio: 250,
    capacidad: 30,
  },
  {
    id: "11",
    origen: "Montevideo",
    destino: "San José",
    fecha: "01/09/2026",
    horaSalida: "15:00",
    horaLlegada: "16:30",
    tipoBus: "Directo",
    precio: 300,
    capacidad: 20,
  },
  {
    id: "12",
    origen: "San José",
    destino: "Montevideo",
    fecha: "31/08/2026",
    horaSalida: "10:30",
    horaLlegada: "12:00",
    tipoBus: "Común",
    precio: 250,
    capacidad: 25,
  },
  {
    id: "13",
    origen: "San José",
    destino: "Montevideo",
    fecha: "01/09/2026",
    horaSalida: "17:00",
    horaLlegada: "18:30",
    tipoBus: "Directo",
    precio: 300,
    capacidad: 20,
  },

  {
    id: "14",
    origen: "Florida",
    destino: "Canelones",
    fecha: "02/09/2026",
    horaSalida: "09:00",
    horaLlegada: "10:30",
    tipoBus: "Común",
    precio: 250,
    capacidad: 20,
  },
  {
    id: "15",
    origen: "Canelones",
    destino: "Florida",
    fecha: "02/09/2026",
    horaSalida: "14:00",
    horaLlegada: "15:30",
    tipoBus: "Directo",
    precio: 300,
    capacidad: 15,
  },
  {
    id: "16",
    origen: "Florida",
    destino: "San José",
    fecha: "03/09/2026",
    horaSalida: "08:30",
    horaLlegada: "10:00",
    tipoBus: "Común",
    precio: 280,
    capacidad: 25,
  },
  {
    id: "17",
    origen: "San José",
    destino: "Florida",
    fecha: "03/09/2026",
    horaSalida: "16:00",
    horaLlegada: "17:30",
    tipoBus: "Directo",
    precio: 330,
    capacidad: 20,
  },
];

for (const viaje of viajes) {
  await redisClient.hSet(`viaje:${viaje.id}`, {
    origen: viaje.origen,
    destino: viaje.destino,
    fecha: viaje.fecha,
    horaSalida: viaje.horaSalida,
    horaLlegada: viaje.horaLlegada,
    tipoBus: viaje.tipoBus,
    precio: viaje.precio.toString(),
  });

  await redisClient.set(
    `viaje:${viaje.id}:capacidad`,
    viaje.capacidad,
  );
}

console.log(`${viajes.length} viajes cargados correctamente.`);

await redisClient.quit();
