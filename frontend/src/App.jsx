import { useEffect, useState } from "react";

// Datos temporales utilizados mientras no tenemos acceso al backend.
import { viajesMock } from "./data/viajesMock.js";


/*
  TIEMPO TEMPORAL DE RESERVA

  300 segundos = 5 minutos.

  TODO REDIS:

  Este valor es solamente para desarrollar el frontend.

  Cuando Redis este conectado, el backend debera devolver
  el TTL real de la reserva y este valor fijo dejara de ser
  la fuente real del tiempo restante.
*/
const TIEMPO_RESERVA_MOCK = 300;


export default function App() {

  // Estado del backend y Redis.
  const [status, setStatus] = useState("Loading backend status...");

  // Viajes encontrados en la busqueda.
  const [viajesEncontrados, setViajesEncontrados] = useState([]);

  /*
    Guarda la reserva actual.

    null significa que no hay ninguna reserva activa.
  */
  const [reserva, setReserva] = useState(null);

  /*
    Tiempo restante de la reserva expresado en segundos.
  */
  const [tiempoRestante, setTiempoRestante] = useState(
    TIEMPO_RESERVA_MOCK
  );

  /*
    Guarda las ordenes generadas luego
    de finalizar una compra.

    TEMPORAL:
    Por ahora las guardamos en React.

    TODO REDIS:

    Mas adelante estas ordenes deberan manejarse
    mediante el backend y una queue en Redis.
  */
  const [ordenes, setOrdenes] = useState([]);


  // ==========================================================
  // ESTADOS DEL CATALOGO Y CACHE
  // ==========================================================

  /*
    Este estado simula si el catalogo ya fue guardado
    en la cache.

    false = todavia no esta cacheado.
    true  = ya existe en la cache.

    TODO REDIS:

    Este estado desaparecera cuando Redis maneje
    realmente el cache.
  */
  const [catalogoEnCache, setCatalogoEnCache] = useState(false);


  /*
    Datos del catalogo que mostramos en pantalla.

    Por ahora inicialmente esta vacio.
  */
  const [catalogo, setCatalogo] = useState([]);


  /*
    Contadores de cache hits y misses.

    La consigna pide mostrar estos valores
    en la aplicacion.
  */
  const [cacheHits, setCacheHits] = useState(0);
  const [cacheMisses, setCacheMisses] = useState(0);


  /*
    Guarda el resultado de la ultima consulta.

    Puede ser:

    null
    "HIT"
    "MISS"
  */
  const [ultimaConsultaCache, setUltimaConsultaCache] = useState(null);


  // Estados del formulario.
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [fecha, setFecha] = useState("");


  // ==========================================================
  // ESTADO DEL BACKEND Y REDIS
  // ==========================================================

  useEffect(() => {

    const loadStatus = async () => {

      try {

        /*
          TODO BACKEND:

          Este endpoint depende de la implementacion
          definitiva del backend.
        */
        const response = await fetch("/api/health");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        setStatus(
          `Backend: ${data.backend} | Redis: ${data.redis}`
        );

      } catch (error) {

        /*
          Aunque backend o Redis no esten disponibles,
          podemos seguir desarrollando el frontend.
        */
        setStatus(
          `Backend / Redis no disponibles: ${error.message}`
        );

      }

    };

    loadStatus();

  }, []);


  // ==========================================================
  // CONTADOR DE LA RESERVA
  // ==========================================================

  useEffect(() => {

    /*
      Si no existe una reserva activa,
      no iniciamos el contador.
    */
    if (reserva === null) {
      return;
    }

    /*
      TEMPORAL:

      Simulamos el paso del tiempo en React.

      TODO REDIS:

      Mas adelante el tiempo real debera estar determinado
      por el TTL almacenado en Redis.
    */
    const intervalo = setInterval(() => {

      setTiempoRestante((tiempoActual) => {

        /*
          Cuando llegamos al final,
          consideramos expirada la reserva.
        */
        if (tiempoActual <= 1) {

          clearInterval(intervalo);

          /*
            TEMPORAL:

            Ahora React elimina la reserva.

            TODO REDIS:

            En la version final Redis sera quien determine
            que la reserva expiro cuando su TTL llegue a cero.
          */
          setReserva(null);

          return 0;
        }

        return tiempoActual - 1;

      });

    }, 1000);


    /*
      Limpiamos el intervalo cuando cambia
      o desaparece la reserva.
    */
    return () => {
      clearInterval(intervalo);
    };

  }, [reserva]);


  // ==========================================================
  // BUSCAR VIAJES
  // ==========================================================

  const buscarViajes = (event) => {

    // Evitamos que el formulario recargue la pagina.
    event.preventDefault();

    /*
      TEMPORAL:

      Buscamos sobre viajesMock.

      TODO BACKEND:

      Esta parte sera reemplazada mas adelante
      por una consulta a la API.
    */
    const resultados = viajesMock.filter((viaje) => {

      const coincideOrigen =
        viaje.origen.trim().toLowerCase() ===
        origen.trim().toLowerCase();

      const coincideDestino =
        viaje.destino.trim().toLowerCase() ===
        destino.trim().toLowerCase();

      const coincideFecha =
        viaje.fecha === fecha;

      return coincideOrigen && coincideDestino && coincideFecha;

    });

    setViajesEncontrados(resultados);


    /*
      TODO BACKEND:

      Mas adelante podria quedar conceptualmente asi:

      const resultados = await apiFetch(...);

      setViajesEncontrados(resultados);
    */
  };


  // ==========================================================
  // RESERVAR VIAJE
  // ==========================================================

  const reservarViaje = (viaje) => {

    /*
      TEMPORAL:

      Creamos una copia del viaje y la guardamos
      como reserva en el estado de React.
    */
    const nuevaReserva = {
      ...viaje
    };

    setReserva(nuevaReserva);

    // Reiniciamos el contador en 5 minutos.
    setTiempoRestante(TIEMPO_RESERVA_MOCK);


    /*
      TODO BACKEND / REDIS:

      Cuando el backend este disponible, ACA se debe crear
      realmente la reserva.

      El frontend debera enviar los datos necesarios
      al backend.

      Conceptualmente:

      const nuevaReserva = await apiFetch("/reservas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          viajeId: viaje.id
        })
      });

      El BACKEND sera responsable de guardar la reserva
      en Redis y asignarle un TTL.

      Ejemplo conceptual:

      SET reserva:{reservaId} {...datosReserva...} EX 300

      El backend podria devolver:

      {
        reservaId: "reserva-123",
        viajeId: 1,
        ttl: 300
      }

      Entonces:

      setReserva(nuevaReserva);
      setTiempoRestante(nuevaReserva.ttl);

      El frontend NO debe conectarse directamente a Redis.
    */
  };


  // ==========================================================
  // CANCELAR RESERVA
  // ==========================================================

  const cancelarReserva = () => {

    /*
      TEMPORAL:

      Eliminamos la reserva del estado de React.
    */
    setReserva(null);

    setTiempoRestante(TIEMPO_RESERVA_MOCK);


    /*
      TODO BACKEND / REDIS:

      En la version final, cancelar una reserva
      debera informar al backend.

      Conceptualmente:

      await apiFetch(`/reservas/${reserva.reservaId}`, {
        method: "DELETE"
      });

      El backend debera eliminar la reserva
      correspondiente de Redis.
    */
  };


  // ==========================================================
  // FINALIZAR COMPRA
  // ==========================================================

  const finalizarCompra = () => {

    if (reserva === null) {
      return;
    }


    /*
      TEMPORAL:

      Creamos una orden mock utilizando
      los datos de la reserva actual.
    */
    const nuevaOrden = {

      id: `ORD-${Date.now()}`,

      viajeId: reserva.id,

      empresa: reserva.empresa,

      origen: reserva.origen,

      destino: reserva.destino,

      fecha: reserva.fecha,

      horaSalida: reserva.horaSalida,

      precio: reserva.precio,

      estado: "Esperando"
    };


    /*
      Agregamos la orden al final del array.

      Esto simula el ingreso al final
      de una queue FIFO.
    */
    setOrdenes((ordenesActuales) => [
      ...ordenesActuales,
      nuevaOrden
    ]);


    setReserva(null);

    setTiempoRestante(TIEMPO_RESERVA_MOCK);


    /*
      TODO BACKEND / REDIS:

      En la version final, al finalizar la compra
      deberemos confirmar la reserva mediante la API.

      El backend debera:

      1. Validar que la reserva siga existiendo.
      2. Confirmar la compra.
      3. Eliminar la reserva temporal.
      4. Crear la orden.
      5. Agregar la orden a una queue de Redis.

      Ejemplo conceptual:

      RPUSH ordenes_queue ordenId
    */
  };


  // ==========================================================
  // PROCESAR SIGUIENTE ORDEN
  // ==========================================================

  const procesarSiguienteOrden = () => {

    /*
      TEMPORAL:

      Trabajamos directamente con el estado mas reciente
      de las ordenes.

      Buscamos la PRIMERA orden en estado Esperando.
    */
    setOrdenes((ordenesActuales) => {

      const indiceSiguiente = ordenesActuales.findIndex(
        (orden) => orden.estado === "Esperando"
      );

      if (indiceSiguiente === -1) {
        return ordenesActuales;
      }

      const nuevasOrdenes = [...ordenesActuales];

      nuevasOrdenes[indiceSiguiente] = {
        ...nuevasOrdenes[indiceSiguiente],
        estado: "Procesando"
      };

      return nuevasOrdenes;

    });


    /*
      TODO BACKEND / REDIS:

      En la version final esta accion debera
      realizarse a traves del backend.

      El backend sera responsable de obtener
      la siguiente orden de la queue respetando FIFO.

      Conceptualmente:

      await apiFetch("/ordenes/procesar-siguiente", {
        method: "POST"
      });

      Redis podria utilizar una operacion como LPOP,
      dependiendo de la implementacion final.
    */
  };


  // ==========================================================
  // RESOLVER SIGUIENTE ORDEN
  // ==========================================================

  const resolverSiguienteOrden = () => {

    /*
      TEMPORAL:

      Buscamos la PRIMERA orden que se encuentre
      actualmente en estado Procesando.
    */
    setOrdenes((ordenesActuales) => {

      const indiceSiguiente = ordenesActuales.findIndex(
        (orden) => orden.estado === "Procesando"
      );

      if (indiceSiguiente === -1) {
        return ordenesActuales;
      }

      const nuevasOrdenes = [...ordenesActuales];

      nuevasOrdenes[indiceSiguiente] = {
        ...nuevasOrdenes[indiceSiguiente],
        estado: "Resuelta"
      };

      return nuevasOrdenes;

    });


    /*
      TODO BACKEND / REDIS:

      En la version final deberemos informar
      al backend que la orden fue resuelta.

      Conceptualmente:

      await apiFetch("/ordenes/resolver-siguiente", {
        method: "POST"
      });
    */
  };


  // ==========================================================
  // CONSULTAR CATALOGO / CACHE
  // ==========================================================

  const consultarCatalogo = () => {

    /*
      TEMPORAL:

      Simulamos el comportamiento de un cache.

      Si catalogoEnCache es false:
      CACHE MISS.

      Si catalogoEnCache es true:
      CACHE HIT.
    */

    if (catalogoEnCache) {

      /*
        CACHE HIT

        Simulamos que encontramos el catalogo
        directamente en la cache.
      */
      setCacheHits((hitsActuales) => hitsActuales + 1);

      setUltimaConsultaCache("HIT");

      /*
        Como los datos ya estaban cacheados,
        simplemente los mostramos.
      */
      setCatalogo(viajesMock);

    } else {

      /*
        CACHE MISS

        Simulamos que Redis no tenia el catalogo.

        Entonces obtenemos los datos desde
        nuestra fuente temporal viajesMock.
      */
      setCacheMisses((missesActuales) => missesActuales + 1);

      setUltimaConsultaCache("MISS");


      /*
        Mostramos los datos obtenidos.
      */
      setCatalogo(viajesMock);


      /*
        Marcamos que el catalogo quedo guardado
        en nuestra cache simulada.

        Por eso la proxima consulta sera HIT.
      */
      setCatalogoEnCache(true);

    }


    /*
      TODO BACKEND / REDIS:

      TODA esta simulacion debera eliminarse
      cuando el backend implemente el cache real.

      El frontend podria hacer algo como:

      const respuesta = await apiFetch("/catalogo");

      setCatalogo(respuesta.catalogo);

      setCacheHits(respuesta.cacheHits);

      setCacheMisses(respuesta.cacheMisses);

      setUltimaConsultaCache(respuesta.cacheStatus);


      El BACKEND debera implementar el patron:

      1. Buscar catalogo en Redis.

         GET catalogo

      2. Si existe:

         CACHE HIT

         devolver el catalogo desde Redis.

      3. Si NO existe:

         CACHE MISS

         obtener los datos desde la fuente original.

         Guardarlos en Redis.

         Ejemplo conceptual:

         SET catalogo {...datos...} EX 600

      4. Devolver al frontend:

         - catalogo
         - cantidad de hits
         - cantidad de misses
         - resultado de la consulta actual


      IMPORTANTE:

      El frontend NO determina realmente si fue
      HIT o MISS en la version final.

      Esa informacion debe venir del backend,
      porque es el backend quien consulta Redis.
    */
  };


  // ==========================================================
  // FORMATEAR EL CONTADOR
  // ==========================================================

  const formatearTiempo = (segundos) => {

    const minutos = Math.floor(segundos / 60);

    const segundosRestantes = segundos % 60;

    return `${String(minutos).padStart(2, "0")}:${String(
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
          <a href="#buscar">Buscar viajes</a>
          <a href="#reserva">Mi reserva</a>
          <a href="#ordenes">Ordenes</a>
          <a href="#cache">Cache</a>
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
                onChange={(event) => setOrigen(event.target.value)}
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
                onChange={(event) => setDestino(event.target.value)}
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
                onChange={(event) => setFecha(event.target.value)}
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
              Cantidad encontrada: {viajesEncontrados.length}
            </p>


            {viajesEncontrados.map((viaje) => {

              const estaReservado =
                reserva !== null &&
                reserva.id === viaje.id;


              return (

                <div
                  className="viaje"
                  key={viaje.id}
                >

                  <h3>
                    {viaje.empresa}
                  </h3>

                  <p>
                    {viaje.origen} - {viaje.destino}
                  </p>

                  <p>
                    Salida: {viaje.horaSalida}
                  </p>

                  <p>
                    Llegada: {viaje.horaLlegada}
                  </p>

                  <p>
                    Precio: ${viaje.precio}
                  </p>

                  <p>
                    Asientos disponibles: {viaje.asientosDisponibles}
                  </p>


                  <button
                    type="button"
                    className="btn-reservar"
                    onClick={() => reservarViaje(viaje)}
                  >
                    {estaReservado
                      ? "Seleccionado"
                      : "Reservar"}
                  </button>


                  {estaReservado && (

                    <div className="reserva-confirmacion">

                      <p>
                        Viaje seleccionado para reservar.
                      </p>

                      <p>
                        Tiempo restante: {formatearTiempo(tiempoRestante)}
                      </p>

                    </div>

                  )}

                </div>

              );

            })}

          </div>

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
                Reserva activa
              </h3>

              <p>
                Empresa: {reserva.empresa}
              </p>

              <p>
                Ruta: {reserva.origen} - {reserva.destino}
              </p>

              <p>
                Fecha: {reserva.fecha}
              </p>

              <p>
                Salida: {reserva.horaSalida}
              </p>

              <p>
                Llegada: {reserva.horaLlegada}
              </p>

              <p>
                Precio: ${reserva.precio}
              </p>


              <div className="contador-reserva">

                <span>
                  Tiempo restante para finalizar la compra
                </span>

                <strong>
                  {formatearTiempo(tiempoRestante)}
                </strong>

              </div>


              <div className="acciones-reserva">

                <button
                  type="button"
                  className="btn-finalizar"
                  onClick={finalizarCompra}
                >
                  Finalizar compra
                </button>


                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={cancelarReserva}
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
            Las ordenes se procesan respetando el orden de llegada.
          </p>


          <div className="acciones-queue">

            <button
              type="button"
              className="btn-procesar"
              onClick={procesarSiguienteOrden}
            >
              Procesar siguiente
            </button>


            <button
              type="button"
              className="btn-resolver"
              onClick={resolverSiguienteOrden}
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

              {ordenes.map((orden, index) => (

                <div
                  className="orden"
                  key={orden.id}
                >

                  <h3>
                    {orden.id}
                  </h3>

                  <p>
                    Posicion de llegada: {index + 1}
                  </p>

                  <p>
                    Empresa: {orden.empresa}
                  </p>

                  <p>
                    Ruta: {orden.origen} - {orden.destino}
                  </p>

                  <p>
                    Fecha: {orden.fecha}
                  </p>

                  <p>
                    Salida: {orden.horaSalida}
                  </p>

                  <p>
                    Precio: ${orden.precio}
                  </p>

                  <p>
                    Estado:
                    <span
                      className={`estado-orden ${orden.estado.toLowerCase()}`}
                    >
                      {orden.estado}
                    </span>
                  </p>

                </div>

              ))}

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
            Consulta el catalogo y observa si se produce un cache hit o un cache miss.
          </p>


          {/* ==================================================
              ESTADISTICAS DE CACHE
              ================================================== */}

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


          {/* Boton que realiza una consulta al catalogo */}
          <button
            type="button"
            className="btn-catalogo"
            onClick={consultarCatalogo}
          >
            Consultar catalogo
          </button>


          {/* ==================================================
              RESULTADO DE LA ULTIMA CONSULTA
              ================================================== */}

          {ultimaConsultaCache !== null && (

            <div
              className={`resultado-cache ${ultimaConsultaCache.toLowerCase()}`}
            >

              Ultima consulta: CACHE {ultimaConsultaCache}

            </div>

          )}


          {/* ==================================================
              CATALOGO
              ================================================== */}

          {catalogo.length > 0 && (

            <div className="catalogo">

              <h3>
                Catalogo de viajes
              </h3>


              {catalogo.map((viaje) => (

                <div
                  className="catalogo-item"
                  key={viaje.id}
                >

                  <strong>
                    {viaje.empresa}
                  </strong>

                  <span>
                    {viaje.origen} - {viaje.destino}
                  </span>

                  <span>
                    {viaje.horaSalida}
                  </span>

                  <span>
                    ${viaje.precio}
                  </span>

                </div>

              ))}

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