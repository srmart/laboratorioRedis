import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, "viajes.csv");

export async function leerViajesCSV() {
  const contenido = await fs.readFile(csvPath, "utf-8");

  const lineas = contenido
    .trim()
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);

  // Primera línea = encabezados
  const encabezados = lineas[0].split(",");

  const viajes = lineas.slice(1).map((linea) => {
    const valores = linea.split(",");

    const viaje = {};

    encabezados.forEach((encabezado, index) => {
      viaje[encabezado] = valores[index];
    });

    viaje.id = String(viaje.id);
    viaje.precio = Number(viaje.precio);
    viaje.capacidad = Number(viaje.capacidad);

    return viaje;
  });

  return viajes;
}