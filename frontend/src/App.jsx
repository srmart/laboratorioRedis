import { useEffect, useState } from "react";

import SelectorAsientos from "./components/seatselector.jsx";

export default function App() {

  // ==========================================================
  // ESTADO DEL BACKEND Y REDIS
  // ==========================================================

  const [status, setStatus] = useState("Loading backend status...");


  // ==========================================================
  // VIAJES
  // ==========================================================

  const [viajesEncontrados, setViajesEncontrados] = useState([]);

  /*
    Guardamos también los viajes conocidos para poder
    relacionarlos con las reservas mediante viajeId.
  */
  const [viajesCatalogo, setViajesCatalogo] = useState([]);


  // ==========================================================
  // RESERVA ACTUAL
  // ==========================================================

  const [reserva, setReserva] = useState(null);

  const [tiempoRestante, setTiempoRestante] = useState(0);


  // ==========================================================
  // USUARIO DE LA RESERVA
  // ==========================================================

  /*
    Nombre que el usuario introduce al momento
    de confirmar la selección de asientos.
  */
  const [nombreReserva, setNombreReserva] = useState("");


  // ==========================================================
  // ORDENES / QUEUE
  // ==========================================================

  const [ordenes, setOrdenes] = useState([]);


  // ==========================================================
  // CACHE
  // ==========================================================

  const [catalogo, setCatalogo] = useState([]);

  const [cacheHits, setCacheHits] = useState(0);

  const [cacheMisses, setCacheMisses] = useState(0);

  const [ultimaConsultaCache, setUltimaConsultaCache] = useState(null);


  // ==========================================================
  // FORMULARIO DE BUSQUEDA
  // ==========================================================

  const [origen, setOrigen] = useState("");

  const [destino, setDestino] = useState("");

  const [fecha, setFecha] = useState("");


  // ==========================================================
  // SELECTOR DE ASIENTOS
  // ==========================================================

  const [viajeSeleccionado, setViajeSeleccionado] = useState(null);

  const [asientosSeleccionados, setAsientosSeleccionados] = useState([]);

  const [asientosOcupados, setAsientosOcupados] = useState([]);

  const [nombreUsuario, setNombreUsuario] = useState("");

  // ==========================================================
  // ESTADO DEL BACKEND
  // ==========================================================

  useEffect(() => {

    const loadStatus = async () => {

      try {

        const response = await fetch("/api/health");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        setStatus(
          `Backend: ${data.backend} | Redis: ${data.redis}`
        );

      } catch (error) {

        setStatus(
          `Backend / Redis no disponibles: ${error.message}`
        );

      }

    };

    loadStatus();

  }, []);


  // ==========================================================
  // CONTADOR DE RESERVA
  // ==========================================================

  useEffect(() => {

    if (reserva === null) {
      return;
    }

    const intervalo = setInterval(async () => {

      try {

        const response = await fetch(
          `/api/reservas/${reserva.id}`
        );

        if (!response.ok) {

          setReserva(null);
          setTiempoRestante(0);

          return;
        }

        const data = await response.json();

        setTiempoRestante(data.ttl);

        if (data.ttl <= 0) {

          setReserva(null);
          setTiempoRestante(0);

        }

      } catch (error) {

        console.error(
          "Error consultando TTL:",
          error
        );

      }

    }, 1000);

    return () => {
      clearInterval(intervalo);
    };

  }, [reserva]);


  // ==========================================================
  // BUSCAR VIAJES
  // ==========================================================

  const buscarViajes = async (event) => {

    event.preventDefault();

    console.log("Buscando viajes...");

    console.log({
      origen,
      destino,
      fecha
    });

    try {

      const [anio, mes, dia] = fecha.split("-");

      const fechaRedis =
        `${dia}/${mes}/${anio}`;

      const params = new URLSearchParams({
        origen,
        destino,
        fecha: fechaRedis,
      });

      const url =
        `/api/viajes?${params}`;

      console.log("URL:", url);

      const response = await fetch(url);

      console.log(
        "STATUS:",
        response.status
      );

      const resultados =
        await response.json();

      console.log(
        "RESULTADOS:",
        resultados
      );

      if (!response.ok) {

        throw new Error(
          resultados.error ||
          `HTTP ${response.status}`
        );

      }

      setViajesEncontrados(resultados);

      /*
        Guardamos estos viajes para poder relacionarlos
        posteriormente con las reservas.
      */
      setViajesCatalogo((actuales) => {

        const mapa = new Map();

        [...actuales, ...resultados].forEach(
          (viaje) => {
            mapa.set(String(viaje.id), viaje);
          }
        );

        return [...mapa.values()];

      });

    } catch (error) {

      console.error(
        "ERROR:",
        error
      );

    }

  };


  // ==========================================================
  // RESERVAR VIAJE
  // ==========================================================

  const reservarViaje = async (viaje) => {

    try {

      const response = await fetch(
        `/api/viajes/${viaje.id}/asientos`
      );

      if (!response.ok) {

        throw new Error(
          "No se pudieron obtener los asientos"
        );

      }

      const data =
        await response.json();

      setViajeSeleccionado(viaje);

      setAsientosSeleccionados([]);

      /*
        Limpiamos el nombre cada vez que se abre
        una nueva selección de reserva.
      */
      setNombreReserva("");

      const ocupados =
        data.asientos
          .filter(
            (asiento) =>
              asiento.estado !== "disponible"
          )
          .map(
            (asiento) =>
              asiento.numero
          );

      setAsientosOcupados(ocupados);

    } catch (error) {

      console.error(
        "Error obteniendo asientos:",
        error
      );

      alert(
        "No se pudieron cargar los asientos"
      );

    }

  };


  // ==========================================================
  // SELECCIONAR ASIENTO
  // ==========================================================

  const toggleAsiento = (numero) => {

    if (
      asientosOcupados.includes(numero)
    ) {
      return;
    }

    setAsientosSeleccionados(
      (actuales) => {

        if (
          actuales.includes(numero)
        ) {

          return actuales.filter(
            (asiento) =>
              asiento !== numero
          );

        }

        return [
          ...actuales,
          numero
        ];

      }
    );

  };


  // ==========================================================
  // CONFIRMAR SELECCION DE ASIENTOS
  // ==========================================================

  const confirmarSeleccionAsientos = async () => {
    if (
        !viajeSeleccionado ||
        asientosSeleccionados.length === 0 ||
        nombreUsuario.trim() === ""
    ) {
        return;
    }

    try {
        const response = await fetch("/api/reservas", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                viajeId: viajeSeleccionado.id,
                nombre: nombreUsuario.trim(),
                asientos: asientosSeleccionados,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(
                data.error ||
                "No se pudo crear la reserva"
            );
            return;
        }

        setReserva({
            ...viajeSeleccionado,
            ...data,
            asientos: data.asientos,
        });

        setTiempoRestante(data.expiraEnSegundos);

        setViajeSeleccionado(null);
        setAsientosSeleccionados([]);
        setAsientosOcupados([]);
        setNombreUsuario("");

        await cargarOrdenes();

    } catch (error) {
        console.error(
            "Error creando reserva:",
            error
        );

        alert(
            "Error al crear la reserva"
        );
    }
};


  // ==========================================================
  // CANCELAR RESERVA
  // ==========================================================

  const cancelarReserva = async () => {

    if (!reserva) {
      return;
    }

    try {

      const response =
        await fetch(
          `/api/reservas/${reserva.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        alert(
          data.error ||
          "No se pudo cancelar la reserva"
        );

        return;
      }

      setReserva(null);

      setTiempoRestante(0);

      await cargarOrdenes();

    } catch (error) {

      console.error(
        "Error cancelando reserva:",
        error
      );

      alert(
        "No se pudo cancelar la reserva"
      );

    }

  };


  // ==========================================================
  // FINALIZAR COMPRA
  // ==========================================================

  const finalizarCompra = async () => {

    if (!reserva) {
      return;
    }

    try {

      const response =
        await fetch(
          `/api/reservas/${reserva.id}/finalizar`,
          {
            method: "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {

        alert(
          data.error ||
          "No se pudo finalizar la compra"
        );

        return;
      }

      console.log(
        "Compra finalizada:",
        data
      );

      setReserva(null);

      setTiempoRestante(0);

      await cargarOrdenes();

    } catch (error) {

      console.error(
        "Error finalizando compra:",
        error
      );

      alert(
        "No se pudo finalizar la compra"
      );

    }

  };


  // ==========================================================
  // CARGAR ORDENES
  // ==========================================================

  const cargarOrdenes = async () => {

    try {

      const response =
        await fetch(
          "/api/reservas"
        );

      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }

      const data =
        await response.json();

      setOrdenes(data);

    } catch (error) {

      console.error(
        "Error cargando órdenes:",
        error
      );

    }

  };


  useEffect(() => {

    cargarOrdenes();

  }, []);


  // ==========================================================
  // BUSCAR DATOS DEL VIAJE DE UNA ORDEN
  // ==========================================================

  const obtenerViajeDeOrden = (orden) => {

    return viajesCatalogo.find(
      (viaje) =>
        String(viaje.id) ===
        String(orden.viajeId)
    );

  };


  // ==========================================================
  // PROCESAR SIGUIENTE ORDEN
  // ==========================================================

  const procesarSiguienteOrden =
    async () => {

      try {

        const response =
          await fetch(
            "/api/reservas/procesar",
            {
              method: "POST",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          alert(
            data.error ||
            "No hay reservas para procesar"
          );

          return;
        }

        console.log(
          "Reserva procesada:",
          data
        );

        await cargarOrdenes();

      } catch (error) {

        console.error(
          "Error procesando reserva:",
          error
        );

        alert(
          "No se pudo procesar la reserva"
        );

      }

    };


  // ==========================================================
  // RESOLVER SIGUIENTE ORDEN
  // ==========================================================

  const resolverSiguienteOrden =
    async () => {

      try {

        const response =
          await fetch(
            "/api/reservas/resolver",
            {
              method: "POST",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {

          alert(
            data.error ||
            "No hay reservas para resolver"
          );

          return;
        }

        console.log(
          "Reserva resuelta:",
          data
        );

        await cargarOrdenes();

      } catch (error) {

        console.error(
          "Error resolviendo reserva:",
          error
        );

        alert(
          "No se pudo resolver la reserva"
        );

      }

    };


  // ==========================================================
  // CONSULTAR CATALOGO / CACHE
  // ==========================================================

  const consultarCatalogo = async () => {

    try {

      const response =
        await fetch(
          "/api/viajes/catalogo"
        );

      const data =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          `HTTP ${response.status}`
        );

      }

      console.log(
        "Consulta catálogo:",
        data
      );

      setCatalogo(
        data.catalogo
      );

      setCacheHits(
        data.cacheHits
      );

      setCacheMisses(
        data.cacheMisses
      );

      setUltimaConsultaCache(
        data.cacheStatus
      );

      /*
        También guardamos los viajes del catálogo
        para poder relacionarlos con las órdenes.
      */
      setViajesCatalogo(
        data.catalogo
      );

    } catch (error) {

      console.error(
        "Error consultando catálogo:",
        error
      );

    }

  };


  // ==========================================================
  // FORMATEAR TIEMPO
  // ==========================================================

  const formatearTiempo = (segundos) => {

    const minutos =
      Math.floor(segundos / 60);

    const segundosRestantes =
      segundos % 60;

    return `${String(minutos).padStart(
      2,
      "0"
    )}:${String(
      segundosRestantes
    ).padStart(2, "0")}`;

  };


  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <>

      {/* ======================================================
          ENCABEZADO
          ====================================================== */}

      <header className="header">

        <h1>RediBus</h1>

        <nav>

          <a href="#buscar">
            Buscar viajes
          </a>

          <a href="#reserva">
            Mi reserva
          </a>

          <a href="#ordenes">
            Ordenes
          </a>

          <a href="#cache">
            Cache
          </a>

        </nav>

      </header>


      <main className="page">


        {/* ====================================================
            BUSCAR VIAJES
            ==================================================== */}

        <section id="buscar">

          <h2>
            Encontra tu proximo viaje
          </h2>

          <p>
            Busca y reserva tu pasaje de omnibus.
          </p>


          <form
            className="form-busqueda"
            onSubmit={buscarViajes}
          >

            <div className="campo">

              <label htmlFor="origen">
                Origen
              </label>

              <input
                type="text"
                id="origen"
                placeholder="Ej: Montevideo"
                value={origen}
                onChange={(event) =>
                  setOrigen(
                    event.target.value
                  )
                }
              />

            </div>


            <div className="campo">

              <label htmlFor="destino">
                Destino
              </label>

              <input
                type="text"
                id="destino"
                placeholder="Ej: Punta del Este"
                value={destino}
                onChange={(event) =>
                  setDestino(
                    event.target.value
                  )
                }
              />

            </div>


            <div className="campo">

              <label htmlFor="fecha">
                Fecha
              </label>

              <input
                type="date"
                id="fecha"
                value={fecha}
                onChange={(event) =>
                  setFecha(
                    event.target.value
                  )
                }
              />

            </div>


            <button type="submit">
              Buscar viajes
            </button>

          </form>


          {/* ==================================================
              RESULTADOS
              ================================================== */}

          <div className="resultados">

            <p>
              Cantidad encontrada:{" "}
              {viajesEncontrados.length}
            </p>


            {viajesEncontrados.map(
              (viaje) => {

                const estaReservado =
                  reserva !== null &&
                  String(reserva.id) ===
                    String(viaje.id);


                return (

                  <div
                    className="viaje"
                    key={viaje.id}
                  >

                    <h3>
                      Viaje #{viaje.id}
                    </h3>

                    <p>
                      {viaje.origen} -{" "}
                      {viaje.destino}
                    </p>

                    <p>
                      Fecha:{" "}
                      {viaje.fecha}
                    </p>

                    <p>
                      Salida:{" "}
                      {viaje.horaSalida}
                    </p>

                    <p>
                      Llegada:{" "}
                      {viaje.horaLlegada}
                    </p>

                    <p>
                      Precio: $
                      {viaje.precio}
                    </p>

                    <p>
                      Asientos disponibles:{" "}
                      {viaje.asientosDisponibles}
                    </p>


                    <button
                      type="button"
                      className="btn-reservar"
                      onClick={() =>
                        reservarViaje(viaje)
                      }
                    >

                      {estaReservado
                        ? "Seleccionado"
                        : "Reservar"}

                    </button>


                    {estaReservado && (

                      <div className="reserva-confirmacion">

                        <p>
                          Viaje seleccionado
                          para reservar.
                        </p>

                        <p>
                          Tiempo restante:{" "}
                          {formatearTiempo(
                            tiempoRestante
                          )}
                        </p>

                      </div>

                    )}

                  </div>

                );

              }
            )}

          </div>


          {/* ==================================================
              SELECTOR DE ASIENTOS
              ================================================== */}

          {viajeSeleccionado !== null && (

            <div>

              <SelectorAsientos
                  capacidad={Number(viajeSeleccionado.capacidad || 20)}
                  asientosOcupados={asientosOcupados}
                  asientosSeleccionados={asientosSeleccionados}
                  onToggleAsiento={toggleAsiento}
                  onConfirmar={confirmarSeleccionAsientos}
                  onCancelar={() => {
                      setViajeSeleccionado(null);
                      setAsientosSeleccionados([]);
                      setAsientosOcupados([]);
                      setNombreUsuario("");
                  }}
                  precio={viajeSeleccionado.precio}
                  nombreUsuario={nombreUsuario}
                  onNombreUsuarioChange={setNombreUsuario}
              />


              

            </div>

          )}

        </section>


        {/* ====================================================
            MI RESERVA
            ==================================================== */}

        <section id="reserva">

          <h2>
            Mi reserva
          </h2>


          {reserva === null ? (

            <p>
              No tenes ninguna reserva activa.
            </p>

          ) : (

            <div className="viaje">

              <h3>
                Reserva #{reserva.id}
              </h3>

              <p>
                Usuario:{" "}
                <strong>
                  {reserva.nombre}
                </strong>
              </p>

              <p>
                Ruta:{" "}
                {reserva.origen} -{" "}
                {reserva.destino}
              </p>

              <p>
                Fecha:{" "}
                {reserva.fecha}
              </p>

              <p>
                Salida:{" "}
                {reserva.horaSalida}
              </p>

              <p>
                Llegada:{" "}
                {reserva.horaLlegada}
              </p>

              <p>
                Asientos:{" "}
                {reserva.asientos?.join(", ")}
              </p>

              <p>
                Precio: $
                {reserva.precio}
              </p>


              <div className="contador-reserva">

                <span>
                  Tiempo restante para finalizar
                  la compra
                </span>

                <strong>
                  {formatearTiempo(
                    tiempoRestante
                  )}
                </strong>

              </div>


              <div className="acciones-reserva">

                <button
                  type="button"
                  className="btn-finalizar"
                  onClick={
                    finalizarCompra
                  }
                >
                  Finalizar compra
                </button>


                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={
                    cancelarReserva
                  }
                >
                  Cancelar reserva
                </button>

              </div>

            </div>

          )}

        </section>


        {/* ====================================================
            ORDENES / QUEUE
            ==================================================== */}

        <section id="ordenes">

          <h2>
            Ordenes
          </h2>

          <p>
            Las ordenes se procesan respetando
            el orden de llegada.
          </p>


          <div className="acciones-queue">

            <button
              type="button"
              className="btn-procesar"
              onClick={
                procesarSiguienteOrden
              }
            >
              Procesar siguiente
            </button>


            <button
              type="button"
              className="btn-resolver"
              onClick={
                resolverSiguienteOrden
              }
            >
              Resolver siguiente
            </button>

          </div>


          {ordenes.length === 0 ? (

            <p>
              No hay ordenes actualmente.
            </p>

          ) : (

            <div className="lista-ordenes">

              {ordenes.map(
                (orden, index) => {

                  const viaje =
                    obtenerViajeDeOrden(
                      orden
                    );


                  return (

                    <div
                      className="orden"
                      key={orden.id}
                    >

                      <h3>
                        Reserva #{orden.id}
                      </h3>

                      <p>
                        Posicion de llegada:{" "}
                        {index + 1}
                      </p>

                      {/* USUARIO */}

                      <p>
                        Usuario:{" "}
                        <strong>
                          {orden.nombre ||
                            "Sin nombre"}
                        </strong>
                      </p>


                      {/* VIAJE */}

                      <p>
                        Viaje:{" "}
                        #{orden.viajeId}
                      </p>


                      {viaje ? (

                        <>

                          <p>
                            Ruta:{" "}
                            {viaje.origen} -{" "}
                            {viaje.destino}
                          </p>

                          <p>
                            Fecha:{" "}
                            {viaje.fecha}
                          </p>

                          <p>
                            Salida:{" "}
                            {viaje.horaSalida}
                          </p>

                          <p>
                            Llegada:{" "}
                            {viaje.horaLlegada}
                          </p>

                          <p>
                            Precio: $
                            {viaje.precio}
                          </p>

                        </>

                      ) : (

                        <p>
                          Datos del viaje no
                          disponibles en memoria.
                        </p>

                      )}


                      {/* ASIENTOS */}

                      <p>
                        Asientos:{" "}
                        {orden.asientos
                          ? JSON.parse(
                              orden.asientos
                            ).join(", ")
                          : "N/A"}
                      </p>


                      {/* ESTADO */}

                      <p>

                        Estado:

                        <span
                          className={`estado-orden ${
                            orden.estado.toLowerCase()
                          }`}
                        >

                          {orden.estado}

                        </span>

                      </p>

                    </div>

                  );

                }
              )}

            </div>

          )}

        </section>


        {/* ====================================================
            CACHE DEL CATALOGO
            ==================================================== */}

        <section id="cache">

          <h2>
            Cache del catalogo
          </h2>

          <p>
            Consulta el catalogo y observa
            si se produce un cache hit o
            un cache miss.
          </p>


          <div className="cache-estadisticas">

            <div className="cache-contador">

              <span>
                Cache Hits
              </span>

              <strong>
                {cacheHits}
              </strong>

            </div>


            <div className="cache-contador">

              <span>
                Cache Misses
              </span>

              <strong>
                {cacheMisses}
              </strong>

            </div>

          </div>


          <button
            type="button"
            className="btn-catalogo"
            onClick={
              consultarCatalogo
            }
          >
            Consultar catalogo
          </button>


          {ultimaConsultaCache !== null && (

            <div
              className={`resultado-cache ${
                ultimaConsultaCache.toLowerCase()
              }`}
            >

              Ultima consulta: CACHE{" "}
              {ultimaConsultaCache}

            </div>

          )}


          {catalogo.length > 0 && (

            <div className="catalogo">

              <h3>
                Catalogo de viajes
              </h3>


              {catalogo.map(
                (viaje) => (

                  <div
                    className="catalogo-item"
                    key={viaje.id}
                  >

                    <strong>
                      Viaje #{viaje.id}
                    </strong>

                    <span>
                      {viaje.origen} -{" "}
                      {viaje.destino}
                    </span>

                    <span>
                      {viaje.fecha}
                    </span>

                    <span>
                      {viaje.horaSalida}
                    </span>

                    <span>
                      ${viaje.precio}
                    </span>

                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* ====================================================
            ESTADO DEL SISTEMA
            ==================================================== */}

        <section className="estado-sistema">

          <p>
            {status}
          </p>

        </section>

      </main>

    </>
  );

}