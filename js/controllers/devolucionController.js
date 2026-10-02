import { obtenerDetallesHerramienta, actualizarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { obtenerHerramientas } from "../services/herramientaService.js";
import { obtenerPrestamos, actualizarPrestamo } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerDetallePrestamoHerramientas } from "../services/detallePrestamoHerramientaService.js";
import { puedeGestionar } from "../utils/rol.js";

let listaDetalles = [];
let listaEstadosHerramienta = [];
let listaHerramientas = [];
let listaPrestamos = [];
let listaEstadosPrestamo = [];
let listaDetallesPrestamo = [];
let detalleSeleccionado = null;

function resolverPorCodigo(codigo) {
    if (!codigo) return null;
    const textoBusqueda = codigo.trim().toLowerCase();
    return listaDetalles.find((item) => item.codInv.toLowerCase() === textoBusqueda);
}

export function initDevolucionController() {
    const equipoCodigo = document.getElementById("equipoCodigo");
    const btnBuscarManual = document.getElementById("btnBuscarManual");
    const fechaDevolucion = document.getElementById("fechaDevolucion");
    const estadoDisponible = document.getElementById("estadoDisponible");
    const estadoDanado = document.getElementById("estadoDanado");
    const observaciones = document.getElementById("observacionesDevolucion");
    const btnRegistrarDevolucion = document.getElementById("btnRegistrarDevolucion");

    if (!btnRegistrarDevolucion) return;

    if (!puedeGestionar(["ADMINISTRADOR", "IT"])) {
        btnRegistrarDevolucion.disabled = true;
        btnRegistrarDevolucion.textContent = "Solo un administrador o IT puede registrar devoluciones";
        equipoCodigo.disabled = true;
        if (btnBuscarManual) btnBuscarManual.classList.add("oculto");
    }

    detalleSeleccionado = null;

    const hoy = new Date().toISOString().split("T")[0];
    fechaDevolucion.max = hoy;
    fechaDevolucion.value = hoy;

    function limpiarFormulario() {
        detalleSeleccionado = null;
        equipoCodigo.value = "";
        fechaDevolucion.value = hoy;
        estadoDisponible.checked = true;
        if (observaciones) {
            observaciones.value = "";
            const contador = document.getElementById("c2");
            if (contador) contador.innerText = "0";
        }
    }

    function seleccionarPorCodigo(codigo) {
        const encontrado = resolverPorCodigo(codigo);
        if (encontrado) {
            detalleSeleccionado = encontrado;
            equipoCodigo.value = encontrado.codInv;
        } else {
            detalleSeleccionado = null;
        }
        return encontrado;
    }

    function conectarBusquedaCodigo() {
        equipoCodigo.addEventListener("change", () => {
            seleccionarPorCodigo(equipoCodigo.value);
        });
    }

    function conectarBuscadorManual() {
        if (!btnBuscarManual) return;

        btnBuscarManual.addEventListener("click", async (evento) => {
            evento.preventDefault();

            const opciones = {};
            listaDetalles.forEach((detalle) => {
                const herramienta = listaHerramientas.find((item) => item.idHerramienta === detalle.idHerramienta);
                const nombre = herramienta ? herramienta.nombreHerramienta : "Equipo";
                opciones[detalle.codInv] = `${nombre} - ${detalle.codInv}`;
            });

            const { value: codigoElegido } = await Swal.fire({
                title: "Selecciona un equipo",
                input: "select",
                inputOptions: opciones,
                inputPlaceholder: "Selecciona un equipo",
                confirmButtonColor: "#28a745",
            });

            if (codigoElegido) {
                seleccionarPorCodigo(codigoElegido);
            }
        });
    }

    async function registrarDevolucion() {
        if (!puedeGestionar(["ADMINISTRADOR", "IT"])) {
            Swal.fire({ icon: "warning", title: "Acción no permitida", text: "Tu rol no tiene permiso para registrar devoluciones." });
            return;
        }

        if (!detalleSeleccionado) {
            Swal.fire({ icon: "warning", title: "Selecciona un equipo", text: "Escanea o busca el código del equipo a devolver." });
            return;
        }

        if (!fechaDevolucion.value) {
            Swal.fire({ icon: "warning", title: "Falta la fecha", text: "Selecciona la fecha de devolución." });
            return;
        }

        const nombreEstadoElegido = estadoDanado.checked ? "DAÑADO" : "DISPONIBLE";
        const estadoElegido = listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === nombreEstadoElegido);

        if (!estadoElegido) {
            Swal.fire({ icon: "error", title: "No se pudo registrar la devolución", text: "No se encontró el estado del equipo." });
            return;
        }

        const herramientaSeleccionada = listaHerramientas.find((item) => item.idHerramienta === detalleSeleccionado.idHerramienta);
        const nombreEquipo = herramientaSeleccionada ? herramientaSeleccionada.nombreHerramienta : detalleSeleccionado.codInv;

        const confirmacion = await Swal.fire({
            icon: "question",
            title: "¿Confirmar devolución?",
            html: `Vas a registrar la devolución de <b>${nombreEquipo}</b> (${detalleSeleccionado.codInv}) como <b>${nombreEstadoElegido}</b>.`,
            showCancelButton: true,
            confirmButtonText: "Sí, registrar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#28a745",
        });

        if (!confirmacion.isConfirmed) {
            return;
        }

        try {
            await actualizarDetalleHerramienta(detalleSeleccionado.idDetalle, {
                idHerramienta: detalleSeleccionado.idHerramienta,
                idMarca: detalleSeleccionado.idMarca,
                idEstadoHerramienta: estadoElegido.id,
                codInv: detalleSeleccionado.codInv,
            });

            listaDetalles = await obtenerDetallesHerramienta();

            const estadoDevuelto = listaEstadosPrestamo.find((item) => item.nombreEstado === "DEVUELTO");
            const idEnPrestamo = (listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === "EN PRESTAMO") || {}).id;

            const lineaPrestamo = listaDetallesPrestamo.find((item) => item.detalleHerramienta === detalleSeleccionado.idDetalle
                && listaPrestamos.some((p) => p.id === item.prestamo && !p.fechaDevolucion))
                || listaDetallesPrestamo.find((item) => !item.detalleHerramienta && item.herramienta === detalleSeleccionado.idHerramienta
                    && listaPrestamos.some((p) => p.id === item.prestamo && !p.fechaDevolucion));
            const prestamoAsociado = lineaPrestamo ? listaPrestamos.find((item) => item.id === lineaPrestamo.prestamo) : null;

            let piezasPendientes = 0;
            if (prestamoAsociado) {
                piezasPendientes = listaDetallesPrestamo
                    .filter((item) => item.prestamo === prestamoAsociado.id && item.detalleHerramienta && item.detalleHerramienta !== detalleSeleccionado.idDetalle)
                    .filter((item) => {
                        const pieza = listaDetalles.find((d) => d.idDetalle === item.detalleHerramienta);
                        return pieza && pieza.idEstadoHerramienta === idEnPrestamo;
                    }).length;
            }

            if (prestamoAsociado && estadoDevuelto && piezasPendientes === 0) {
                await actualizarPrestamo(prestamoAsociado.id, {
                    usuario: prestamoAsociado.usuario,
                    fechaInicio: prestamoAsociado.fechaInicio,
                    fechaEsperada: prestamoAsociado.fechaEsperada,
                    fechaDevolucion: fechaDevolucion.value,
                    estado: estadoDevuelto.id,
                });
            }

            Swal.fire({
                icon: "success",
                title: "¡Devolución registrada!",
                text: piezasPendientes > 0 ? `Todavía quedan ${piezasPendientes} pieza(s) de este préstamo por devolver.` : undefined,
                confirmButtonColor: "#28a745",
            });
            limpiarFormulario();

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo registrar la devolución",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    }

    if (observaciones) {
        observaciones.addEventListener("input", () => {
            const contador = document.getElementById("c2");
            if (contador) contador.innerText = observaciones.value.length;
        });
    }

    (async function cargarCatalogos() {
        try {
            listaDetalles = await obtenerDetallesHerramienta();
            listaEstadosHerramienta = await obtenerEstadosHerramienta();
            listaHerramientas = await obtenerHerramientas();
            listaPrestamos = await obtenerPrestamos();
            listaEstadosPrestamo = await obtenerEstadosPrestamo();
            listaDetallesPrestamo = await obtenerDetallePrestamoHerramientas();

            if (equipoCodigo.value) {
                seleccionarPorCodigo(equipoCodigo.value);
            }
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron cargar los catálogos", text: "Revisa tu conexión con el servidor." });
        }
    })();

    conectarBusquedaCodigo();
    conectarBuscadorManual();
    btnRegistrarDevolucion.addEventListener("click", registrarDevolucion);
}
