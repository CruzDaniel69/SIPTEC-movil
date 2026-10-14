import { fechasPrestamoValidas as fechasValidas, ahoraLocalISO } from "../utils/fechas.js";
import { idUsuarioActual } from "../utils/sesion.js";
import { agregarPrestamo } from "../services/prestamoService.js";
import { obtenerAreas, agregarArea } from "../services/areaService.js";
import { obtenerTiposArea } from "../services/tipoAreaService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { agregarDetallePrestamoHerramienta } from "../services/detallePrestamoHerramientaService.js";
import { agregarDetallePrestamoArea } from "../services/detallePrestamoAreaService.js";
import { buscarHerramientas, obtenerPiezaPorCodigo, obtenerPiezasDisponibles } from "../services/inventarioService.js";
import { retrasar } from "../utils/paginacion.js";

let listaSugerencias = [];
let listaAreas = [];
let listaEstados = [];
let listaTiposArea = [];
let unidadesDisponibles = [];

const patronCodigoEquipo = /^[A-Za-z]+-\d+$/;

async function resolverEquipo(texto) {
    const buscado = (texto || "").trim();
    if (!buscado) return null;

    if (patronCodigoEquipo.test(buscado)) {
        try {
            const pieza = await obtenerPiezaPorCodigo(buscado);
            return {
                herramienta: { idHerramienta: pieza.idHerramienta, nombreHerramienta: pieza.nombreHerramienta },
                codigo: pieza.codInv,
            };
        } catch (error) {
            // Si no existe ese código, se intenta buscar por nombre.
        }
    }

    const encontradas = await buscarHerramientas(buscado, 10);
    listaSugerencias = encontradas;
    const coincidencia = encontradas.find((h) => h.nombreHerramienta.toLowerCase() === buscado.toLowerCase()) || encontradas[0];
    return coincidencia ? { herramienta: coincidencia, codigo: null } : null;
}

const patronTexto = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,()\-\s]+$/;

function obtenerIdUsuarioActual() {
    return idUsuarioActual();
}

function resolverPorNombre(texto, lista, campoNombre) {
    if (!texto) return null;
    const textoBusqueda = texto.trim().toLowerCase();
    return lista.find((item) => item[campoNombre].toLowerCase().includes(textoBusqueda));
}


export function initPrestamoController() {
    const tipoHerramienta = document.getElementById("tipoHerramienta");
    const fechaInicio = document.getElementById("fechaInicio");
    const fechaEsperada = document.getElementById("fechaEsperada");
    const contenedorUnidades = document.getElementById("listaUnidades");
    const buscarHerramienta = document.getElementById("buscarHerramienta");
    const idHerramientaSeleccionada = document.getElementById("idHerramientaSeleccionada");
    const avisoHerramienta = document.getElementById("avisoHerramienta");
    const buscarArea = document.getElementById("buscarArea");
    const idAreaSeleccionada = document.getElementById("idAreaSeleccionada");
    const avisoArea = document.getElementById("avisoArea");
    const btnRegistrarPrestamo = document.getElementById("btnRegistrarPrestamo");
    const observaciones = document.getElementById("observacionesPrestamo");

    if (!btnRegistrarPrestamo) return;

    // Se puede pedir un préstamo para hoy mismo: el mínimo es el momento actual
    fechaInicio.min = ahoraLocalISO();

    function pintarUnidades(herramienta, codigoPreseleccionado) {
        if (!herramienta) {
            contenedorUnidades.innerHTML = '<small style="font-size:9px; color:var(--ink-soft);">Primero busca y selecciona un equipo.</small>';
            return;
        }

        const unidades = unidadesDisponibles;
        if (unidades.length === 0) {
            contenedorUnidades.innerHTML = '<small style="font-size:9px; color:var(--red);">No hay piezas disponibles de este equipo.</small>';
            return;
        }

        contenedorUnidades.innerHTML = unidades.map((u) => `
            <label style="display:inline-flex; align-items:center; gap:4px; border:1px solid var(--line); border-radius:999px; padding:6px 10px; font-size:10px;">
                <input type="checkbox" data-unidad="${u.idDetalle}" ${codigoPreseleccionado && u.codInv.toLowerCase() === codigoPreseleccionado.toLowerCase() ? "checked" : ""}> ${u.codInv}
            </label>`).join("");
    }

    function unidadesElegidas() {
        return Array.from(contenedorUnidades.querySelectorAll("input[data-unidad]:checked")).map((c) => Number(c.dataset.unidad));
    }

    function limpiarFormulario() {
        tipoHerramienta.checked = true;
        buscarHerramienta.value = "";
        idHerramientaSeleccionada.value = "";
        avisoHerramienta.textContent = "";
        unidadesDisponibles = [];
        pintarUnidades(null);
        buscarArea.value = "";
        idAreaSeleccionada.value = "";
        avisoArea.textContent = "";
        fechaInicio.value = "";
        fechaEsperada.value = "";
        fechaEsperada.classList.remove("fecha-invalida");
        if (observaciones) {
            observaciones.value = "";
            const contador = document.getElementById("c1");
            if (contador) contador.innerText = "0";
        }
    }

    async function validarFormularioPrestamo() {
        if (!fechaInicio.value || !fechaEsperada.value) {
            return { valido: false, mensaje: "Selecciona la fecha de inicio y la esperada." };
        }

        const validacionFechas = fechasValidas(fechaInicio.value, fechaEsperada.value);
        if (!validacionFechas.valido) {
            return validacionFechas;
        }

        if (tipoHerramienta.checked) {
            if (!idHerramientaSeleccionada.value) {
                return { valido: false, mensaje: "Busca y selecciona un equipo válido de la lista." };
            }

            const elegidas = unidadesElegidas();
            if (elegidas.length === 0) {
                return { valido: false, mensaje: "Marca al menos una pieza disponible (por ejemplo EQ-21)." };
            }

            const disponiblesAhora = await obtenerPiezasDisponibles(Number(idHerramientaSeleccionada.value));
            const idsPermitidos = new Set(disponiblesAhora.map((u) => u.idDetalle));
            if (elegidas.some((id) => !idsPermitidos.has(id))) {
                unidadesDisponibles = disponiblesAhora;
                return { valido: false, mensaje: "Alguna pieza elegida ya no está disponible (prestada, dañada o solicitada)." };
            }
        } else if (!idAreaSeleccionada.value) {
            return { valido: false, mensaje: "Busca y selecciona un área válida de la lista." };
        }

        return { valido: true };
    }

    async function registrarPrestamo() {
        let validacion;
        try {
            validacion = await validarFormularioPrestamo();
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudo verificar la disponibilidad", text: "Revisa tu conexión con el servidor." });
            return;
        }

        if (!validacion.valido) {
            Swal.fire({ icon: "warning", title: "Datos incompletos", text: validacion.mensaje });
            return;
        }

        const estadoPendiente = listaEstados.find((estado) => estado.nombreEstado === "PENDIENTE");
        if (!estadoPendiente) {
            Swal.fire({ icon: "error", title: "No se pudo registrar el préstamo", text: "No se encontró el estado PENDIENTE." });
            return;
        }

        try {
            const nuevoPrestamo = await agregarPrestamo({
                usuario: obtenerIdUsuarioActual(),
                fechaInicio: fechaInicio.value,
                fechaEsperada: fechaEsperada.value,
                fechaDevolucion: null,
                estado: estadoPendiente.id,
                observaciones: observaciones ? observaciones.value.trim() : "",
            });

            if (tipoHerramienta.checked) {
                for (const idUnidad of unidadesElegidas()) {
                    await agregarDetallePrestamoHerramienta({
                        prestamo: nuevoPrestamo.id,
                        herramienta: Number(idHerramientaSeleccionada.value),
                        detalleHerramienta: idUnidad,
                        cantidad: 1,
                    });
                }
            } else {
                await agregarDetallePrestamoArea({
                    prestamoIdPrestamo: nuevoPrestamo.id,
                    areasIdArea: Number(idAreaSeleccionada.value),
                });
            }

            Swal.fire({ icon: "success", title: "¡Préstamo registrado!", confirmButtonColor: "#001f3d" });
            limpiarFormulario();

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo registrar el préstamo",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    }

    function rellenarSugerenciasEquipos() {
        const datalist = document.getElementById("listaEquiposDatalist");
        if (!datalist) return;
        datalist.innerHTML = listaSugerencias.map((h) => `<option value="${h.nombreHerramienta}"></option>`).join("");
    }

    function conectarBuscadorHerramienta() {
        const sugerir = retrasar(async () => {
            const texto = buscarHerramienta.value.trim();
            if (!texto || patronCodigoEquipo.test(texto)) return;
            try {
                listaSugerencias = await buscarHerramientas(texto, 10);
                rellenarSugerenciasEquipos();
            } catch (error) {
                console.error(error);
            }
        }, 250);
        buscarHerramienta.addEventListener("input", sugerir);

        buscarHerramienta.addEventListener("change", async () => {
            try {
                const resultado = await resolverEquipo(buscarHerramienta.value);

                if (resultado) {
                    const encontrada = resultado.herramienta;
                    unidadesDisponibles = await obtenerPiezasDisponibles(encontrada.idHerramienta);
                    idHerramientaSeleccionada.value = encontrada.idHerramienta;
                    buscarHerramienta.value = encontrada.nombreHerramienta;
                    avisoHerramienta.textContent = "Piezas disponibles: " + unidadesDisponibles.length;
                    pintarUnidades(encontrada, resultado.codigo);
                } else {
                    unidadesDisponibles = [];
                    idHerramientaSeleccionada.value = "";
                    avisoHerramienta.textContent = "No se encontró ese equipo. Revisa el nombre o el código.";
                    pintarUnidades(null);
                }
            } catch (error) {
                console.error(error);
                avisoHerramienta.textContent = "No se pudo consultar el equipo. Revisa tu conexión.";
            }
        });
    }

    function rellenarListaAreas() {
        const datalist = document.getElementById("listaAreasDatalist");
        if (!datalist) return;
        datalist.innerHTML = "";
        listaAreas.forEach((area) => {
            const opcion = document.createElement("option");
            opcion.value = area.nombreArea;
            datalist.appendChild(opcion);
        });
    }

    async function crearAreaNueva(nombre) {
        const opciones = {};
        listaTiposArea.forEach((tipo) => {
            opciones[tipo.id] = tipo.nombreTipoArea;
        });

        const { value: idTipoElegido } = await Swal.fire({
            title: `La ubicación "${nombre}" no existe`,
            text: "¿Qué tipo de lugar es?",
            input: "radio",
            inputOptions: opciones,
            confirmButtonText: "Agregar ubicación",
            confirmButtonColor: "#001f3d",
            inputValidator: (value) => !value && "Selecciona una opción para continuar.",
        });

        if (!idTipoElegido) return null;

        const nuevaArea = await agregarArea({
            nombreArea: nombre,
            tipoArea: Number(idTipoElegido),
        });

        listaAreas.push(nuevaArea);
        rellenarListaAreas();
        return nuevaArea;
    }

    function conectarBuscadorArea() {
        buscarArea.addEventListener("change", async () => {
            const textoBuscado = buscarArea.value.trim();
            const encontrada = resolverPorNombre(textoBuscado, listaAreas, "nombreArea");

            if (encontrada) {
                idAreaSeleccionada.value = encontrada.id;
                buscarArea.value = encontrada.nombreArea;
                avisoArea.textContent = "";
                return;
            }

            if (!textoBuscado) {
                idAreaSeleccionada.value = "";
                avisoArea.textContent = "";
                return;
            }

            if (!patronTexto.test(textoBuscado)) {
                idAreaSeleccionada.value = "";
                avisoArea.textContent = "La ubicación solo admite letras, números, espacios y los signos . , ( ) -";
                return;
            }

            try {
                const areaCreada = await crearAreaNueva(textoBuscado);
                if (areaCreada) {
                    idAreaSeleccionada.value = areaCreada.id;
                    buscarArea.value = areaCreada.nombreArea;
                    avisoArea.textContent = "Ubicación agregada.";
                } else {
                    idAreaSeleccionada.value = "";
                    avisoArea.textContent = "No se encontró esa área.";
                }
            } catch (error) {
                console.error(error);
                idAreaSeleccionada.value = "";
                Swal.fire({ icon: "error", title: "No se pudo agregar la ubicación", text: "Ocurrió un error al conectar con el servidor." });
            }
        });
    }

    function validarFechasEnVivo() {
        if (!fechaInicio.value || !fechaEsperada.value) {
            fechaEsperada.classList.remove("fecha-invalida");
            return;
        }

        const resultado = fechasValidas(fechaInicio.value, fechaEsperada.value);
        fechaEsperada.classList.toggle("fecha-invalida", !resultado.valido);
    }

    function conectarFechas() {
        fechaInicio.addEventListener("change", () => {
            fechaEsperada.min = fechaInicio.value;
            validarFechasEnVivo();
        });
        fechaEsperada.addEventListener("change", validarFechasEnVivo);
    }

    if (observaciones) {
        observaciones.addEventListener("input", () => {
            const contador = document.getElementById("c1");
            if (contador) contador.innerText = observaciones.value.length;
        });
    }

    (async function cargarCatalogos() {
        try {
            listaAreas = await obtenerAreas();
            listaEstados = await obtenerEstadosPrestamo();
            listaTiposArea = await obtenerTiposArea();
            rellenarListaAreas();
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron cargar los catálogos", text: "Revisa tu conexión con el servidor." });
        }
    })();

    conectarBuscadorHerramienta();
    conectarBuscadorArea();
    conectarFechas();
    btnRegistrarPrestamo.addEventListener("click", registrarPrestamo);
}
