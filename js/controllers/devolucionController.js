import { ahoraLocalISO, formatearFechaHora, estaVencido } from "../utils/fechas.js";
import { actualizarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { actualizarPrestamo, obtenerPrestamosPagina, obtenerPrestamoActivoPorPieza, subirEvidenciaPrestamo } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerPiezaPorCodigo } from "../services/inventarioService.js";
import { puedeGestionar } from "../utils/rol.js";
import { validarImagen, conectarSelectorFoto } from "../utils/imagenes.js";
import { pintarPaginador } from "../utils/paginacion.js";
import { escaparHtml } from "../utils/texto.js";

const TAMANO_LISTA = 8;

let listaEstadosHerramienta = [];
let listaEstadosPrestamo = [];

export function initDevolucionController() {
    const equipoCodigo = document.getElementById("equipoCodigo");
    const listaDevoluciones = document.getElementById("listaDevoluciones");
    const btnReportarDano = document.getElementById("btnReportarDano");
    const estadoEquipo = document.getElementById("estadoEquipo");
    const textoEstadoEquipo = document.getElementById("textoEstadoEquipo");
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

    const puedeRegistrar = puedeGestionar(["ADMINISTRADOR", "IT"]);
    if (!puedeRegistrar) {
        btnRegistrarDevolucion.disabled = true;
        btnRegistrarDevolucion.textContent = "Solo un administrador o IT puede registrar devoluciones";
        equipoCodigo.disabled = true;
        if (btnReportarDano) btnReportarDano.classList.add("oculto");
    }

    let seleccionado = null;     // préstamo elegido (resumen que devuelve la API)
    let danadas = new Set();     // idDetalle de las piezas que el admin reportó dañadas
    let paginaActual = 0;
    let filas = [];

    function textoPiezas(prestamo) {
        const piezas = prestamo.piezas || [];
        if (prestamo.tipo === "Herramienta" && prestamo.idHerramienta) {
            return piezas.length > 0 ? piezas.map((p) => p.codInv).join(", ") : "x" + prestamo.cantidad;
        }
        return "";
    }

    function etiquetaPrestamo(prestamo) {
        const piezas = textoPiezas(prestamo);
        return `${prestamo.nombreProducto || "Préstamo"}${piezas ? " (" + piezas + ")" : ""}`;
    }

    function codigoPrestamo(id) {
        return "PR-" + String(id).padStart(3, "0");
    }

    function pintarEstadoEquipo() {
        const hayDano = danadas.size > 0;
        estadoEquipo.classList.toggle("con-dano", hayDano);
        estadoEquipo.querySelector("i").className = hayDano ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-check";

        if (hayDano && seleccionado) {
            const codigos = (seleccionado.piezas || []).filter((p) => danadas.has(p.idDetalle)).map((p) => p.codInv);
            textoEstadoEquipo.textContent = "Daño reportado: " + codigos.join(", ");
        } else {
            textoEstadoEquipo.textContent = "Todo vuelve en buen estado";
        }

        if (btnReportarDano) {
            btnReportarDano.innerHTML = hayDano
                ? '<i class="fa-solid fa-rotate-left"></i> Quitar el reporte de daño'
                : '<i class="fa-solid fa-triangle-exclamation"></i> Reportar daño';
        }
    }

    function pintarLista() {
        if (filas.length === 0) {
            listaDevoluciones.innerHTML = '<p class="estado-texto">No hay préstamos por devolver.</p>';
            return;
        }

        listaDevoluciones.innerHTML = filas.map((prestamo) => {
            const retrasado = prestamo.fechaEsperada && estaVencido(prestamo.fechaEsperada);
            const elegido = seleccionado && seleccionado.id === prestamo.id;
            return `
            <button type="button" class="opcion-devolucion ${elegido ? "seleccionada" : ""}" data-prestamo="${prestamo.id}">
                <span class="opcion-devolucion-cabecera">
                    <b>${escaparHtml(etiquetaPrestamo(prestamo))}</b>
                    <small>${codigoPrestamo(prestamo.id)}</small>
                </span>
                <span class="opcion-devolucion-detalle">${escaparHtml(prestamo.nombreUsuario || "Usuario")}</span>
                <span class="opcion-devolucion-detalle ${retrasado ? "retrasado" : ""}">
                    ${retrasado ? "Retrasado · " : "Esperada · "}${formatearFechaHora(prestamo.fechaEsperada)}
                </span>
            </button>`;
        }).join("");
    }

    async function cargarPagina(pagina = paginaActual) {
        const datos = await obtenerPrestamosPagina({
            page: pagina,
            size: TAMANO_LISTA,
            estados: ["APROBADO", "ENTREGADO"],
            sinDevolucion: true,
        });

        if (datos.content.length === 0 && pagina > 0) {
            return cargarPagina(pagina - 1);
        }

        paginaActual = datos.page;
        filas = datos.content;
        pintarLista();
        pintarPaginador(document.getElementById("paginadorDevoluciones"), datos, async (destino) => {
            try {
                await cargarPagina(destino);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo cargar la página", text: "Revisa tu conexión con el servidor." });
            }
        });
    }

    function elegirPrestamo(prestamo) {
        seleccionado = prestamo;
        danadas = new Set();
        pintarEstadoEquipo();
        pintarLista();
    }

    function limpiarFormulario() {
        seleccionado = null;
        danadas = new Set();
        equipoCodigo.value = "";
        if (evidencia) evidencia.value = "";
        mostrarEvidencia();
        if (observaciones) {
            observaciones.value = "";
            const contador = document.getElementById("c2");
            if (contador) contador.innerText = "0";
        }
        pintarEstadoEquipo();
    }

    // Atajo: al escanear el código de un equipo se elige el préstamo que lo tiene
    equipoCodigo.addEventListener("change", async () => {
        const texto = equipoCodigo.value.trim();
        if (!texto) return;

        try {
            const pieza = await obtenerPiezaPorCodigo(texto);
            const prestamo = pieza ? await obtenerPrestamoActivoPorPieza(pieza.idDetalle) : null;

            if (!prestamo) {
                Swal.fire({ icon: "info", title: "Sin préstamo activo", text: "El equipo " + texto + " no está en un préstamo por devolver." });
                return;
            }
            equipoCodigo.value = "";
            elegirPrestamo(prestamo);
        } catch (error) {
            Swal.fire({ icon: "warning", title: "Equipo no encontrado", text: "No existe un equipo con el código " + texto + "." });
        }
    });

    listaDevoluciones.addEventListener("click", (evento) => {
        const opcion = evento.target.closest("[data-prestamo]");
        if (!opcion) return;
        const prestamo = filas.find((p) => p.id === Number(opcion.dataset.prestamo));
        if (prestamo) elegirPrestamo(prestamo);
    });

    // Reportar daño es opcional: por defecto todo vuelve en buen estado
    if (btnReportarDano) {
        btnReportarDano.addEventListener("click", async () => {
            if (danadas.size > 0) {
                danadas = new Set();
                pintarEstadoEquipo();
                return;
            }

            if (!seleccionado) {
                Swal.fire({ icon: "warning", title: "Elige un préstamo", text: "Primero selecciona el préstamo que se devuelve." });
                return;
            }

            const piezas = seleccionado.piezas || [];
            if (piezas.length === 0) {
                Swal.fire({ icon: "info", title: "Sin piezas", text: "Este préstamo no tiene piezas individuales que marcar como dañadas." });
                return;
            }

            const casillas = document.createElement("div");
            casillas.className = "casillas-dano";
            piezas.forEach((pieza) => {
                const etiqueta = document.createElement("label");
                etiqueta.className = "casilla-dano";
                const casilla = document.createElement("input");
                casilla.type = "checkbox";
                casilla.dataset.idDetalle = pieza.idDetalle;
                casilla.checked = piezas.length === 1;
                etiqueta.appendChild(casilla);
                etiqueta.appendChild(document.createTextNode(" " + pieza.codInv));
                casillas.appendChild(etiqueta);
            });

            const respuesta = await Swal.fire({
                title: "¿Qué pieza llegó dañada?",
                html: casillas,
                showCancelButton: true,
                confirmButtonText: "Reportar daño",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#f2a43a",
                preConfirm: () => {
                    const marcadas = Array.from(casillas.querySelectorAll("input:checked")).map((c) => Number(c.dataset.idDetalle));
                    if (marcadas.length === 0) {
                        Swal.showValidationMessage("Marca al menos una pieza.");
                        return false;
                    }
                    return marcadas;
                },
            });

            if (respuesta.isConfirmed) {
                danadas = new Set(respuesta.value);
                pintarEstadoEquipo();
                if (observaciones && !observaciones.value.trim()) observaciones.focus();
            }
        });
    }

    async function registrarDevolucion() {
        if (!puedeGestionar(["ADMINISTRADOR", "IT"])) {
            Swal.fire({ icon: "warning", title: "Acción no permitida", text: "Tu rol no tiene permiso para registrar devoluciones." });
            return;
        }

        if (!seleccionado) {
            Swal.fire({ icon: "warning", title: "Elige un préstamo", text: "Toca el préstamo que se devuelve o escanea el código de un equipo." });
            return;
        }

        const estadoDevuelto = listaEstadosPrestamo.find((item) => item.nombreEstado === "DEVUELTO");
        const idDisponible = (listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === "DISPONIBLE") || {}).id;
        const idDanado = (listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === "DAÑADO") || {}).id;

        if (!estadoDevuelto || !idDisponible || (danadas.size > 0 && !idDanado)) {
            Swal.fire({ icon: "error", title: "No se pudo registrar la devolución", text: "No se encontraron los estados necesarios." });
            return;
        }

        const fotoEvidencia = evidencia ? evidencia.files[0] : null;
        const problemaFoto = validarImagen(fotoEvidencia);
        if (problemaFoto) {
            Swal.fire({ icon: "warning", title: "Foto inválida", text: problemaFoto });
            return;
        }

        const resumenDano = danadas.size > 0 ? ` Con <b>${danadas.size}</b> pieza(s) dañada(s).` : " Todo en buen estado.";
        const confirmacion = await Swal.fire({
            icon: "question",
            title: "¿Confirmar devolución?",
            html: `Vas a registrar la devolución de <b>${escaparHtml(etiquetaPrestamo(seleccionado))}</b> (${codigoPrestamo(seleccionado.id)}).${resumenDano}`,
            showCancelButton: true,
            confirmButtonText: "Sí, registrar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#28a745",
        });

        if (!confirmacion.isConfirmed) {
            return;
        }

        const prestamo = seleccionado;
        const nota = observaciones ? observaciones.value.trim() : "";

        try {
            await actualizarPrestamo(prestamo.id, {
                usuario: prestamo.idUsuario,
                fechaInicio: prestamo.fechaInicio,
                fechaEsperada: prestamo.fechaEsperada,
                fechaDevolucion: ahoraLocalISO(),
                estado: estadoDevuelto.id,
                ...(nota ? { observacionDevolucion: nota } : {}),
            });

            for (const pieza of prestamo.piezas || []) {
                await actualizarDetalleHerramienta(pieza.idDetalle, {
                    idHerramienta: pieza.idHerramienta,
                    idMarca: pieza.idMarca,
                    idEstadoHerramienta: danadas.has(pieza.idDetalle) ? idDanado : idDisponible,
                    codInv: pieza.codInv,
                });
            }

            // La evidencia se sube aparte: si falla, la devolución ya quedó registrada y solo se avisa
            let evidenciaFallo = false;
            if (fotoEvidencia) {
                try {
                    await subirEvidenciaPrestamo(prestamo.id, fotoEvidencia);
                } catch (error) {
                    console.error(error);
                    evidenciaFallo = true;
                }
            }

            Swal.fire({
                icon: evidenciaFallo ? "warning" : "success",
                title: "¡Devolución registrada!",
                text: evidenciaFallo ? "La foto de evidencia no se pudo subir." : undefined,
                confirmButtonColor: "#28a745",
            });
            limpiarFormulario();
            await cargarPagina(paginaActual);

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
            [listaEstadosHerramienta, listaEstadosPrestamo] = await Promise.all([
                obtenerEstadosHerramienta(),
                obtenerEstadosPrestamo(),
            ]);
            await cargarPagina(0);
        } catch (error) {
            console.error(error);
            listaDevoluciones.innerHTML = '<p class="estado-texto">No se pudo cargar la lista. Revisa tu conexión con el servidor.</p>';
        }
    })();

    btnRegistrarDevolucion.addEventListener("click", registrarDevolucion);
}
