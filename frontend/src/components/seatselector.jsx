export default function SelectorAsientos({
    capacidad,
    asientosOcupados,
    asientosSeleccionados,
    onToggleAsiento,
    onConfirmar,
    onCancelar,
    precio,
    nombreUsuario,
    onNombreUsuarioChange,
}) {

    const cantidadAsientos = Number(capacidad);

    /*
      Generamos las filas del ómnibus.

      Cada fila tiene:

      [1] [2]    PASILLO    [3] [4]
      [5] [6]    PASILLO    [7] [8]
      etc.
    */
    const filas = [];

    for (let i = 1; i <= cantidadAsientos; i += 4) {
        filas.push([
            i,
            i + 1 <= cantidadAsientos ? i + 1 : null,
            i + 2 <= cantidadAsientos ? i + 2 : null,
            i + 3 <= cantidadAsientos ? i + 3 : null,
        ]);
    }


    const renderAsiento = (numero, key) => {

        if (numero === null) {
            return (
                <div
                    className="asiento-vacio"
                    key={key}
                />
            );
        }

        const ocupado =
            asientosOcupados.includes(numero);

        const seleccionado =
            asientosSeleccionados.includes(numero);

        return (
            <button
                type="button"
                key={key}
                className={`asiento ${
                    ocupado
                        ? "ocupado"
                        : seleccionado
                        ? "seleccionado"
                        : "disponible"
                }`}
                disabled={ocupado}
                onClick={() => onToggleAsiento(numero)}
            >
                {numero}
            </button>
        );
    };


    return (
        <div className="selector-asientos">

            <h3>Elegí tus asientos</h3>


            {/* ==================================================
                LEYENDA
                ================================================== */}

            <div className="leyenda-asientos">

                <span>
                    <i className="asiento-demo disponible"></i>
                    Disponible
                </span>

                <span>
                    <i className="asiento-demo seleccionado"></i>
                    Seleccionado
                </span>

                <span>
                    <i className="asiento-demo ocupado"></i>
                    Ocupado
                </span>

            </div>


            {/* ==================================================
                BUS
                ================================================== */}

            <div className="bus">

                <div className="bus-conductor">
                    CONDUCTOR
                </div>


                <div className="asientos-bus">

                    {filas.map((fila, index) => (

                        <div
                            className="fila-asientos"
                            key={`fila-${index}`}
                        >

                            {renderAsiento(
                                fila[0],
                                `fila-${index}-asiento-0`
                            )}

                            {renderAsiento(
                                fila[1],
                                `fila-${index}-asiento-1`
                            )}

                            <div
                                className="pasillo"
                                key={`fila-${index}-pasillo`}
                            />


                            {renderAsiento(
                                fila[2],
                                `fila-${index}-asiento-2`
                            )}

                            {renderAsiento(
                                fila[3],
                                `fila-${index}-asiento-3`
                            )}

                        </div>

                    ))}

                </div>

            </div>


            {/* ==================================================
                RESUMEN
                ================================================== */}

            <div className="resumen-asientos">

                <p>
                    Asientos seleccionados:{" "}
                    {asientosSeleccionados.length === 0
                        ? "ninguno"
                        : asientosSeleccionados.join(", ")}
                </p>

                <p>
                    Cantidad: {asientosSeleccionados.length}
                </p>

                <p>
                    Total: $
                    {asientosSeleccionados.length *
                        Number(precio)}
                </p>

            </div>


            {/* ==================================================
                USUARIO
                ================================================== */}

            <div className="datos-reserva">

                <label htmlFor="nombre-usuario">
                    Nombre de usuario
                </label>

                <input
                    id="nombre-usuario"
                    type="text"
                    placeholder="Ej: Santiago"
                    value={nombreUsuario}
                    onChange={(event) =>
                        onNombreUsuarioChange(
                            event.target.value
                        )
                    }
                />

                <p>
                    Este nombre quedará asociado a la reserva
                    y permitirá identificar al usuario durante
                    el procesamiento.
                </p>

            </div>


            {/* ==================================================
                ACCIONES
                ================================================== */}

            <div className="acciones-asientos">

                <button
                    type="button"
                    className="btn-finalizar"
                    disabled={
                        asientosSeleccionados.length === 0 ||
                        nombreUsuario.trim() === ""
                    }
                    onClick={onConfirmar}
                >
                    Reservar asientos
                </button>

                <button
                    type="button"
                    className="btn-cancelar"
                    onClick={onCancelar}
                >
                    Volver
                </button>

            </div>

        </div>
    );
}