import { ahoraLocalISO } from "../utils/fechas.js";
import { actualizarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { actualizarPrestamo, obtenerPrestamoActivoPorPieza, subirEvidenciaPrestamo } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerPiezaPorCodigo, obtenerPiezasPagina } from "../services/inventarioService.js";
import { puedeGestionar } from "../utils/rol.js";
import { validarImagen, conectarSelectorFoto } from "../utils/imagenes.js";

let listaEstadosHerramienta = [];
let listaEstadosPrestamo = [];
let detalleSeleccionado = null;

export function initDevolucionController() {
    const equipoCodigo = document.getElementById("equipoCodigo");
    const btnBuscarManual = document.getElementById("btnBuscarManual");
    const fechaDevolucion = document.getElementById("fechaDevolucion");
    const estadoDisponible = document.getElementById("estadoDisponible");
    const estadoDanado = document.getElementById("estadoDanado");
    const observaciones = document.getElementById("observacionesDevolucion");
    const evidencia = document.getElementById("evidenciaDevolucion");
    const cajaEvidencia = document.getElementById("cajaEvidencia");
    const textoEvidencia = document.getElementById("textoEvidencia");
    const btnRegistrarDevolucion = document.getElementById("btnRegistrarDevolucion");

    if (!btnRegistrarDevolucion) return;

    // Caja de la foto de evidencia: vista previa, nombre del archivo y botón para quitarla
    const mostrarEvidencia = conectarSelectorFoto({
        entrada: evidencia,
        caja: cajaEvidencia,
        texto: textoEvidencia,
        vista: document.getElementById("vistaEvidencia"),
        quitar: document.getElementById("quitarEvidencia"),
    });

    if (!puedeGestionar(["ADMINISTRADOR", "IT"])) {
        btnRegistrarDevolucion.disabled = true;
        btnRegistrarDevolucion.textContent = "Solo un administrador o IT puede registrar devoluciones";
        equipoCodigo.disabled = true;
        if (btnBuscarManual) btnBuscarManual.classList.add("oculto");
    }

    detalleSeleccionado = null;

    const ahora = ahoraLocalISO();
    fechaDevolucion.max = ahora;
    fechaDevolucion.value = ahora;

    function limpiarFormulario() {
        detalleSeleccionado = null;
        equipoCodigo.value = "";
        fechaDevolucion.value = ahoraLocalISO();
        if (evidencia) evidencia.value = "";
        mostrarEvidencia();
        estadoDisponible.checked = true;
        if (observaciones) {
            observaciones.value = "";
            const contador = document.getElementById("c2");
            if (contador) contador.innerText = "0";
        }
    }

    async function seleccionarPorCodigo(codigo) {
        const texto = (codigo || "").trim();
        if (!texto) {
            detalleSeleccionado = null;
            return null;
        }

        try {
            const encontrado = await obtenerPiezaPorCodigo(texto);
            detalleSeleccionado = encontrado;
            equipoCodigo.value = encontrado.codInv;
            return encontrado;
        } catch (error) {
            detalleSeleccionado = null;
            return null;
        }
    }

    function conectarBusquedaCodigo() {
        equipoCodigo.addEventListener("change", async () => {
            const encontrado = await seleccionarPorCodigo(equipoCodigo.value);
            if (!encontrado && equipoCodigo.value.trim()) {
                Swal.fire({ icon: "warning", title: "Equipo no encontrado", text: "No existe un equipo con el código " + equipoCodigo.value.trim() + "." });
            }
        });
    }

    function conectarBuscadorManual() {
        if (!btnBuscarManual) return;

        btnBuscarManual.addEventListener("click", async (evento) => {
            evento.preventDefault();

            let piezasPrestadas = [];
            try {
                const pagina = await obtenerPiezasPagina({ page: 0, size: 50, estado: "EN PRESTAMO" });
                piezasPrestadas = pagina.content;
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudieron cargar los equipos", text: "Revisa tu conexión con el servidor." });
                return;
            }

            if (piezasPrestadas.length === 0) {
                Swal.fire({ icon: "info", title: "Nada por devolver", text: "Ahora mismo no hay equipos prestados. Solo se pueden devolver equipos cuyo préstamo ya fue aprobado y entregado." });
                return;
            }

            const opciones = {};
            piezasPrestadas.forEach((pieza) => {
                opciones[pieza.codInv] = `${pieza.nombreHerramienta} - ${pieza.codInv}`;
            });

            const { value: codigoElegido } = await Swal.fire({
                title: "Selecciona un equipo",
                text: "Equipos que están prestados actualmente",
                input: "select",
                inputOptions: opciones,
                inputPlaceholder: "Selecciona un equipo",
                confirmButtonColor: "#28a745",
            });

            if (codigoElegido) {
                await seleccionarPorCodigo(codigoElegido);
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
            Swal.fire({ icon: "warning", title: "Falta la fecha", text: "Selecciona la fecha y la hora de devolución." });
            return;
        }

        const nombreEstadoElegido = estadoDanado.checked ? "DAÑADO" : "DISPONIBLE";
        const estadoElegido = listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === nombreEstadoElegido);

        if (!estadoElegido) {
            Swal.fire({ icon: "error", title: "No se pudo registrar la devolución", text: "No se encontró el estado del equipo." });
            return;
        }

        const fotoEvidencia = evidencia ? evidencia.files[0] : null;
        const problemaFoto = validarImagen(fotoEvidencia);
        if (problemaFoto) {
            Swal.fire({ icon: "warning", title: "Foto inválida", text: problemaFoto });
            return;
        }

        const nombreEquipo = detalleSeleccionado.nombreHerramienta || detalleSeleccionado.codInv;

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

            const estadoDevuelto = listaEstadosPrestamo.find((item) => item.nombreEstado === "DEVUELTO");
            const prestamoAsociado = await obtenerPrestamoActivoPorPieza(detalleSeleccionado.idDetalle);

            let piezasPendientes = 0;
            if (prestamoAsociado) {
                piezasPendientes = prestamoAsociado.piezas
                    .filter((pieza) => pieza.idDetalle !== detalleSeleccionado.idDetalle)
                    .filter((pieza) => pieza.nombreEstadoHerramienta === "EN PRESTAMO").length;
            }

            if (prestamoAsociado && estadoDevuelto && piezasPendientes === 0) {
                await actualizarPrestamo(prestamoAsociado.id, {
                    usuario: prestamoAsociado.idUsuario,
                    fechaInicio: prestamoAsociado.fechaInicio,
                    fechaEsperada: prestamoAsociado.fechaEsperada,
                    fechaDevolucion: fechaDevolucion.value,
                    estado: estadoDevuelto.id,
                });
            }

            // La evidencia se sube aparte: si falla, la devolución ya quedó registrada y solo se avisa
            let evidenciaFallo = false;
            if (fotoEvidencia && prestamoAsociado) {
                try {
                    await subirEvidenciaPrestamo(prestamoAsociado.id, fotoEvidencia);
                } catch (error) {
                    console.error(error);
                    evidenciaFallo = true;
                }
            }

            const textos = [];
            if (piezasPendientes > 0) textos.push(`Todavía quedan ${piezasPendientes} pieza(s) de este préstamo por devolver.`);
            if (evidenciaFallo) textos.push("La foto de evidencia no se pudo subir.");

            Swal.fire({
                icon: evidenciaFallo ? "warning" : "success",
                title: "¡Devolución registrada!",
                text: textos.length > 0 ? textos.join(" ") : undefined,
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
            listaEstadosHerramienta = await obtenerEstadosHerramienta();
            listaEstadosPrestamo = await obtenerEstadosPrestamo();

            if (equipoCodigo.value) {
                await seleccionarPorCodigo(equipoCodigo.value);
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
