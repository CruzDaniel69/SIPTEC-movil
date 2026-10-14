import { formatearFechaHora as formatearFecha } from "../utils/fechas.js";
import { obtenerPrestamosPagina, actualizarPrestamo } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { actualizarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { pintarPaginador } from "../utils/paginacion.js";
import { escaparHtml } from "../utils/texto.js";

const TAMANO_LISTA = 10;


export async function initAprobarPrestamosController() {
    const lista = document.getElementById("listaSolicitudesPendientes");
    if (!lista) return;

    let estados = [];
    let estadosHerramienta = [];
    let pendientes = [];
    let paginaActual = 0;

    function construirFila(prestamo) {
        let recurso = prestamo.nombreProducto;

        if (prestamo.tipo === "Herramienta" && prestamo.idHerramienta) {
            const sufijo = prestamo.piezasAsignadas && prestamo.piezas.length > 0
                ? prestamo.piezas.map((p) => p.codInv).join(", ")
                : "x" + prestamo.cantidad;
            recurso = `${prestamo.nombreProducto} (${sufijo})`;
        }

        return {
            id: prestamo.id,
            recurso,
            nombreUsuario: prestamo.nombreUsuario || "Usuario",
            fecha: formatearFecha(prestamo.fechaInicio),
            datos: prestamo,
        };
    }

    function pintarLista() {
        if (pendientes.length === 0) {
            lista.innerHTML = '<p style="font-size:11px;color:var(--ink-soft);">No hay solicitudes pendientes.</p>';
            return;
        }

        lista.innerHTML = pendientes.map((fila) => `
            <div class="tarjeta-solicitud">
                <div class="info-elemento">
                    <div class="titulo-elemento">${fila.recurso}</div>
                    <div class="subtitulo-elemento">${fila.nombreUsuario} · ${fila.fecha}</div>
                    ${fila.datos.observaciones ? `<div class="nota-solicitud"><i class="fa-regular fa-comment"></i> ${escaparHtml(fila.datos.observaciones)}</div>` : ""}
                </div>
                <div class="acciones-solicitud">
                    <button class="boton-aprobar" data-aprobar="${fila.id}" title="Aprobar"><i class="fa-solid fa-check"></i></button>
                    <button class="boton-rechazar" data-rechazar="${fila.id}" title="Rechazar"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `).join("");
    }

    async function cargarPagina(pagina = paginaActual) {
        const datos = await obtenerPrestamosPagina({ page: pagina, size: TAMANO_LISTA, estados: ["PENDIENTE"] });

        if (datos.content.length === 0 && pagina > 0) {
            return cargarPagina(pagina - 1);
        }

        paginaActual = datos.page;
        pendientes = datos.content.map(construirFila);
        pintarLista();
        pintarPaginador(document.getElementById("paginadorSolicitudes"), datos, async (destino) => {
            try {
                await cargarPagina(destino);
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: "error", title: "No se pudo cargar la página", text: "Revisa tu conexión con el servidor." });
            }
        });
    }

    async function responderSolicitud(idPrestamo, nombreEstadoNuevo) {
        const estadoNuevo = estados.find((e) => e.nombreEstado === nombreEstadoNuevo);
        const fila = pendientes.find((p) => p.id === idPrestamo);
        if (!estadoNuevo || !fila) return;

        const prestamoOriginal = fila.datos;

        // Al rechazar se puede dejar un motivo: el solicitante lo verá en su aviso
        let motivoRechazo;
        if (nombreEstadoNuevo === "RECHAZADO") {
            const respuesta = await Swal.fire({
                title: "Rechazar préstamo",
                text: "Puedes explicarle al solicitante por qué (opcional).",
                input: "textarea",
                inputPlaceholder: "Motivo del rechazo",
                inputAttributes: { maxlength: 150 },
                showCancelButton: true,
                confirmButtonText: "Rechazar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#dc3545",
            });
            if (!respuesta.isConfirmed) return;
            motivoRechazo = (respuesta.value || "").trim();
        }

        try {
            await actualizarPrestamo(idPrestamo, {
                usuario: prestamoOriginal.idUsuario,
                fechaInicio: prestamoOriginal.fechaInicio,
                fechaEsperada: prestamoOriginal.fechaEsperada,
                fechaDevolucion: prestamoOriginal.fechaDevolucion,
                estado: estadoNuevo.id,
                ...(motivoRechazo !== undefined ? { motivoRechazo } : {}),
            });

            if (nombreEstadoNuevo === "APROBADO") {
                const idEnPrestamo = (estadosHerramienta.find((e) => e.nombreEstadoHerramienta === "EN PRESTAMO") || {}).id;

                if (idEnPrestamo) {
                    for (const pieza of prestamoOriginal.piezas) {
                        await actualizarDetalleHerramienta(pieza.idDetalle, {
                            idHerramienta: pieza.idHerramienta,
                            idMarca: pieza.idMarca,
                            idEstadoHerramienta: idEnPrestamo,
                            codInv: pieza.codInv,
                        });
                    }
                }
            }

            Swal.fire({
                icon: "success",
                title: nombreEstadoNuevo === "APROBADO" ? "¡Préstamo aprobado!" : "Préstamo rechazado",
                confirmButtonColor: nombreEstadoNuevo === "APROBADO" ? "#28a745" : "#dc3545",
            });

            await cargarPagina(paginaActual);
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo procesar la solicitud",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    }

    lista.addEventListener("click", (evento) => {
        const botonAprobar = evento.target.closest("[data-aprobar]");
        const botonRechazar = evento.target.closest("[data-rechazar]");

        if (botonAprobar) responderSolicitud(Number(botonAprobar.dataset.aprobar), "APROBADO");
        if (botonRechazar) responderSolicitud(Number(botonRechazar.dataset.rechazar), "RECHAZADO");
    });

    try {
        [estados, estadosHerramienta] = await Promise.all([
            obtenerEstadosPrestamo(),
            obtenerEstadosHerramienta(),
        ]);

        await cargarPagina(0);
    } catch (error) {
        console.error(error);
        lista.innerHTML = '<p style="font-size:11px;color:var(--red);">No se pudo cargar la lista. Revisa tu conexión con el servidor.</p>';
    }
}
