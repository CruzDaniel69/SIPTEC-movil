import { obtenerPrestamos, actualizarPrestamo } from "../services/prestamoService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerHerramientas } from "../services/herramientaService.js";
import { obtenerDetallePrestamoHerramientas } from "../services/detallePrestamoHerramientaService.js";
import { obtenerAreas } from "../services/areaService.js";
import { obtenerDetallePrestamoAreas } from "../services/detallePrestamoAreaService.js";
import { obtenerUsuarios } from "../services/usuarioService.js";
import { obtenerDetallesHerramienta, actualizarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";

function formatearFecha(fechaISO) {
    if (!fechaISO) return "-";
    const fecha = new Date(fechaISO + "T00:00:00");
    return fecha.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
}

export async function initAprobarPrestamosController() {
    const lista = document.getElementById("listaSolicitudesPendientes");
    if (!lista) return;

    let prestamos = [];
    let estados = [];
    let pendientes = [];
    let detallesPrestamoHerramienta = [];
    let detallesFisicos = [];
    let estadosHerramienta = [];

    function construirFila(prestamo, herramientas, detallesHerramienta, areas, detallesArea, usuarios) {
        const usuario = usuarios.find((u) => u.id === prestamo.usuario);
        const detalleHerramienta = detallesHerramienta.find((d) => d.prestamo === prestamo.id);
        const detalleArea = detallesArea.find((d) => d.prestamoIdPrestamo === prestamo.id);

        let recurso = "Préstamo #" + prestamo.id;

        if (detalleHerramienta) {
            const herramienta = herramientas.find((h) => h.idHerramienta === detalleHerramienta.herramienta);
            recurso = (herramienta ? herramienta.nombreHerramienta : "Equipo") + ` (x${detalleHerramienta.cantidad})`;
        } else if (detalleArea) {
            const area = areas.find((a) => a.id === detalleArea.areasIdArea);
            recurso = area ? area.nombreArea : "Área";
        }

        return {
            id: prestamo.id,
            recurso,
            nombreUsuario: usuario ? `${usuario.nombreUsuario} ${usuario.apellidoUsuario}` : "Usuario",
            fecha: formatearFecha(prestamo.fechaInicio),
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
                </div>
                <div class="acciones-solicitud">
                    <button class="boton-aprobar" data-aprobar="${fila.id}" title="Aprobar"><i class="fa-solid fa-check"></i></button>
                    <button class="boton-rechazar" data-rechazar="${fila.id}" title="Rechazar"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `).join("");
    }

    async function responderSolicitud(idPrestamo, nombreEstadoNuevo) {
        const estadoNuevo = estados.find((e) => e.nombreEstado === nombreEstadoNuevo);
        const prestamoOriginal = prestamos.find((p) => p.id === idPrestamo);
        if (!estadoNuevo || !prestamoOriginal) return;

        try {
            await actualizarPrestamo(idPrestamo, {
                usuario: prestamoOriginal.usuario,
                fechaInicio: prestamoOriginal.fechaInicio,
                fechaEsperada: prestamoOriginal.fechaEsperada,
                fechaDevolucion: prestamoOriginal.fechaDevolucion,
                estado: estadoNuevo.id,
            });

            if (nombreEstadoNuevo === "APROBADO") {
                const detallePrestamo = detallesPrestamoHerramienta.find((d) => d.prestamo === idPrestamo);
                if (detallePrestamo) {
                    const detalleFisico = detallesFisicos.find((d) => d.idHerramienta === detallePrestamo.herramienta);
                    const idEnPrestamo = (estadosHerramienta.find((e) => e.nombreEstadoHerramienta === "EN PRESTAMO") || {}).id;
                    if (detalleFisico && idEnPrestamo) {
                        await actualizarDetalleHerramienta(detalleFisico.idDetalle, {
                            idHerramienta: detalleFisico.idHerramienta,
                            idMarca: detalleFisico.idMarca,
                            idEstadoHerramienta: idEnPrestamo,
                            codInv: detalleFisico.codInv,
                        });
                    }
                }
            }

            Swal.fire({
                icon: "success",
                title: nombreEstadoNuevo === "APROBADO" ? "¡Préstamo aprobado!" : "Préstamo rechazado",
                confirmButtonColor: nombreEstadoNuevo === "APROBADO" ? "#28a745" : "#dc3545",
            });

            pendientes = pendientes.filter((fila) => fila.id !== idPrestamo);
            pintarLista();
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
        const [prestamosCargados, estadosCargados, herramientas, detallesHerramienta, areas, detallesArea, usuarios, detallesFisicosCargados, estadosHerramientaCargados] = await Promise.all([
            obtenerPrestamos(),
            obtenerEstadosPrestamo(),
            obtenerHerramientas(),
            obtenerDetallePrestamoHerramientas(),
            obtenerAreas().catch(() => []),
            obtenerDetallePrestamoAreas().catch(() => []),
            obtenerUsuarios(),
            obtenerDetallesHerramienta(),
            obtenerEstadosHerramienta(),
        ]);

        prestamos = prestamosCargados;
        estados = estadosCargados;
        detallesPrestamoHerramienta = detallesHerramienta;
        detallesFisicos = detallesFisicosCargados;
        estadosHerramienta = estadosHerramientaCargados;

        const estadoPendiente = estados.find((e) => e.nombreEstado === "PENDIENTE");
        pendientes = prestamos
            .filter((p) => estadoPendiente && p.estado === estadoPendiente.id)
            .map((p) => construirFila(p, herramientas, detallesHerramienta, areas, detallesArea, usuarios));

        pintarLista();
    } catch (error) {
        console.error(error);
        lista.innerHTML = '<p style="font-size:11px;color:var(--red);">No se pudo cargar la lista. Revisa tu conexión con el servidor.</p>';
    }
}
