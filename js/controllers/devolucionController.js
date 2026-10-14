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
import { esqueletoTarjetas } from "../utils/esqueleto.js";

const TAMANO_LISTA = 8;

// Préstamo que se eligió en la lista y que se muestra en la pantalla de detalle
let prestamoElegido = null;

function codigoPrestamo(id) {
    return "PR-" + String(id).padStart(3, "0");
}

function etiquetaPrestamo(prestamo) {
    const piezas = prestamo.piezas || [];
    let sufijo = "";
    if (prestamo.tipo === "Herramienta" && prestamo.idHerramienta) {
        sufijo = piezas.length > 0 ? piezas.map((p) => p.codInv).join(", ") : "x" + prestamo.cantidad;
    } else if (prestamo.tipo === "Área" && piezas.length > 0) {
        sufijo = "+" + piezas.length + " herramientas";
    }
    return `${prestamo.nombreProducto || "Préstamo"}${sufijo ? " (" + sufijo + ")" : ""}`;
}

function abrirDetalle(prestamo) {
    prestamoElegido = prestamo;
    window.loadView("devolucion-detalle");
}

/* ---------------------------------------------------------------------
   Lista de préstamos por devolver
   --------------------------------------------------------------------- */
export function initDevolucionController() {
    const lista = document.getElementById("listaDevoluciones");
    const btnBuscarPorCodigo = document.getElementById("btnBuscarPorCodigo");
    if (!lista) return;

    prestamoElegido = null;

    if (!puedeGestionar(["ADMINISTRADOR", "IT"])) {
        lista.innerHTML = '<p class="estado-texto">Solo un administrador o IT puede registrar devoluciones.</p>';
        if (btnBuscarPorCodigo) btnBuscarPorCodigo.classList.add("oculto");
        return;
    }

    let paginaActual = 0;
    let filas = [];

    lista.innerHTML = esqueletoTarjetas(3);

    function pintarLista() {
        if (filas.length === 0) {
            lista.innerHTML = '<p class="estado-texto">No hay préstamos por devolver.</p>';
            return;
        }

        lista.innerHTML = filas.map((prestamo) => {
            const retrasado = prestamo.fechaEsperada && estaVencido(prestamo.fechaEsperada);
            return `
            <button type="button" class="tarjeta-seleccion-reporte" data-prestamo="${prestamo.id}">
                <div>
                    <div class="title">${escaparHtml(etiquetaPrestamo(prestamo))}</div>
                    <div class="desc">${escaparHtml(prestamo.nombreUsuario || "Usuario")} · ${codigoPrestamo(prestamo.id)}</div>
                    <div class="desc ${retrasado ? "texto-retrasado" : ""}">${retrasado ? "Retrasado · " : "Esperada · "}${formatearFechaHora(prestamo.fechaEsperada)}</div>
                </div>
                <i class="fa-solid fa-arrow-right"></i>
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

    lista.addEventListener("click", (evento) => {
        const tarjeta = evento.target.closest("[data-prestamo]");
        if (!tarjeta) return;
        const prestamo = filas.find((p) => p.id === Number(tarjeta.dataset.prestamo));
        if (prestamo) abrirDetalle(prestamo);
    });

    // Atajo: escribir o escanear el código de un equipo lleva directo a su préstamo
    if (btnBuscarPorCodigo) {
        btnBuscarPorCodigo.addEventListener("click", async () => {
            const { value: codigo } = await Swal.fire({
                title: "Buscar por código",
                input: "text",
                inputPlaceholder: "Código del equipo (ej. EQ-22)",
                inputAttributes: { autocapitalize: "characters", autocomplete: "off", spellcheck: "false" },
                showCancelButton: true,
                confirmButtonText: "Buscar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#28a745",
            });
            const texto = (codigo || "").trim();
            if (!texto) return;

            try {
                const pieza = await obtenerPiezaPorCodigo(texto);
                const prestamo = pieza ? await obtenerPrestamoActivoPorPieza(pieza.idDetalle) : null;
                if (!prestamo) {
                    Swal.fire({ icon: "info", title: "Sin préstamo activo", text: "El equipo " + texto + " no está en un préstamo por devolver." });
                    return;
                }
                abrirDetalle(prestamo);
            } catch (error) {
                Swal.fire({ icon: "warning", title: "Equipo no encontrado", text: "No existe un equipo con el código " + texto + "." });
            }
        });
    }

    (async function cargarInicial() {
        try {
            await cargarPagina(0);
        } catch (error) {
            console.error(error);
            lista.innerHTML = '<p class="estado-texto">No se pudo cargar la lista. Revisa tu conexión con el servidor.</p>';
        }
    })();
}

/* ---------------------------------------------------------------------
   Detalle: estado del equipo, observaciones, foto y registro de la devolución
   --------------------------------------------------------------------- */
export function initDevolucionDetalleController() {
    const btnRegistrarDevolucion = document.getElementById("btnRegistrarDevolucion");
    if (!btnRegistrarDevolucion) return;

    const prestamo = prestamoElegido;
    if (!prestamo || !puedeGestionar(["ADMINISTRADOR", "IT"])) {
        window.loadView("devolucion");
        return;
    }

    const btnVolver = document.getElementById("btnVolverDevoluciones");
    const btnReportarDano = document.getElementById("btnReportarDano");
    const estadoEquipo = document.getElementById("estadoEquipo");
    const textoEstadoEquipo = document.getElementById("textoEstadoEquipo");
    const observaciones = document.getElementById("observacionesDevolucion");
    const evidencia = document.getElementById("evidenciaDevolucion");

    const mostrarEvidencia = conectarSelectorFoto({
        entrada: evidencia,
        caja: document.getElementById("cajaEvidencia"),
        texto: document.getElementById("textoEvidencia"),
        vista: document.getElementById("vistaEvidencia"),
        quitar: document.getElementById("quitarEvidencia"),
    });

    let listaEstadosHerramienta = [];
    let listaEstadosPrestamo = [];
    let danadas = new Set();     // idDetalle de las piezas que se reportaron dañadas

    if (btnVolver) btnVolver.addEventListener("click", () => window.loadView("devolucion"));

    // Resumen del préstamo elegido
    document.getElementById("tituloPrestamoDevolucion").textContent = etiquetaPrestamo(prestamo);
    const retrasado = prestamo.fechaEsperada && estaVencido(prestamo.fechaEsperada);
    document.getElementById("datosPrestamoDevolucion").innerHTML = `
        <div class="dato-prestamo"><span>Préstamo</span><b>${codigoPrestamo(prestamo.id)}</b></div>
        <div class="dato-prestamo"><span>Solicitante</span><b>${escaparHtml(prestamo.nombreUsuario || "Usuario")}</b></div>
        <div class="dato-prestamo"><span>Devolución esperada</span><b class="${retrasado ? "texto-retrasado" : ""}">${formatearFechaHora(prestamo.fechaEsperada)}</b></div>
        ${prestamo.observaciones ? `<div class="dato-prestamo"><span>Nota del solicitante</span><b>${escaparHtml(prestamo.observaciones)}</b></div>` : ""}`;

    function pintarEstadoEquipo() {
        const hayDano = danadas.size > 0;
        estadoEquipo.classList.toggle("con-dano", hayDano);
        estadoEquipo.querySelector("i").className = hayDano ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-check";

        if (hayDano) {
            const codigos = (prestamo.piezas || []).filter((p) => danadas.has(p.idDetalle)).map((p) => p.codInv);
            textoEstadoEquipo.textContent = "Daño reportado: " + codigos.join(", ");
        } else {
            textoEstadoEquipo.textContent = "Todo vuelve en buen estado";
        }

        btnReportarDano.innerHTML = hayDano
            ? '<i class="fa-solid fa-rotate-left"></i> Quitar el reporte de daño'
            : '<i class="fa-solid fa-triangle-exclamation"></i> Reportar daño';
    }

    // Reportar daño es opcional: por defecto todo vuelve en buen estado
    btnReportarDano.addEventListener("click", async () => {
        if (danadas.size > 0) {
            danadas = new Set();
            pintarEstadoEquipo();
            return;
        }

        const piezas = prestamo.piezas || [];
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
            if (!observaciones.value.trim()) observaciones.focus();
        }
    });

    async function registrarDevolucion() {
        const estadoDevuelto = listaEstadosPrestamo.find((item) => item.nombreEstado === "DEVUELTO");
        const idDisponible = (listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === "DISPONIBLE") || {}).id;
        const idDanado = (listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === "DAÑADO") || {}).id;

        if (!estadoDevuelto || !idDisponible || (danadas.size > 0 && !idDanado)) {
            Swal.fire({ icon: "error", title: "No se pudo registrar la devolución", text: "No se encontraron los estados necesarios. Intenta de nuevo." });
            return;
        }

        const fotoEvidencia = evidencia.files[0] || null;
        const problemaFoto = validarImagen(fotoEvidencia);
        if (problemaFoto) {
            Swal.fire({ icon: "warning", title: "Foto inválida", text: problemaFoto });
            return;
        }

        const resumenDano = danadas.size > 0 ? ` Con <b>${danadas.size}</b> pieza(s) dañada(s).` : " Todo en buen estado.";
        const confirmacion = await Swal.fire({
            icon: "question",
            title: "¿Confirmar devolución?",
            html: `Vas a registrar la devolución de <b>${escaparHtml(etiquetaPrestamo(prestamo))}</b> (${codigoPrestamo(prestamo.id)}).${resumenDano}`,
            showCancelButton: true,
            confirmButtonText: "Sí, registrar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#28a745",
        });

        if (!confirmacion.isConfirmed) return;

        const nota = observaciones.value.trim();

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

            await Swal.fire({
                icon: evidenciaFallo ? "warning" : "success",
                title: "¡Devolución registrada!",
                text: evidenciaFallo ? "La foto de evidencia no se pudo subir." : undefined,
                confirmButtonColor: "#28a745",
            });
            prestamoElegido = null;
            window.loadView("devolucion");

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

    observaciones.addEventListener("input", () => {
        const contador = document.getElementById("c2");
        if (contador) contador.innerText = observaciones.value.length;
    });

    (async function cargarCatalogos() {
        try {
            [listaEstadosHerramienta, listaEstadosPrestamo] = await Promise.all([
                obtenerEstadosHerramienta(),
                obtenerEstadosPrestamo(),
            ]);
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron cargar los catálogos", text: "Revisa tu conexión con el servidor." });
        }
    })();

    pintarEstadoEquipo();
    btnRegistrarDevolucion.addEventListener("click", registrarDevolucion);
}
