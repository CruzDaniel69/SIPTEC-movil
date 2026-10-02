import { obtenerPrestamos, agregarPrestamo } from "../services/prestamoService.js";
import { obtenerHerramientas } from "../services/herramientaService.js";
import { obtenerAreas, agregarArea } from "../services/areaService.js";
import { obtenerTiposArea } from "../services/tipoAreaService.js";
import { obtenerEstadosPrestamo } from "../services/estadoPrestamoService.js";
import { obtenerDetallePrestamoHerramientas, agregarDetallePrestamoHerramienta } from "../services/detallePrestamoHerramientaService.js";
import { agregarDetallePrestamoArea } from "../services/detallePrestamoAreaService.js";
import { obtenerDetallesHerramienta } from "../services/detalleHerramientaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";

let listaHerramientas = [];
let listaAreas = [];
let listaEstados = [];
let listaTiposArea = [];
let listaDetallesHerramienta = [];
let listaEstadosHerramienta = [];
let listaPrestamos = [];
let listaDetallesPrestamo = [];

function listaUnidadesDisponibles(idHerramienta) {
    const idEstadoDisponible = (listaEstadosHerramienta.find((e) => e.nombreEstadoHerramienta === "DISPONIBLE") || {}).id;
    const idEstadoPendiente = (listaEstados.find((e) => e.nombreEstado === "PENDIENTE") || {}).id;
    const prestamosPendientes = new Set(listaPrestamos.filter((p) => p.estado === idEstadoPendiente).map((p) => p.id));
    const idsYaSolicitados = new Set(listaDetallesPrestamo
        .filter((d) => d.detalleHerramienta && prestamosPendientes.has(d.prestamo))
        .map((d) => d.detalleHerramienta));

    return listaDetallesHerramienta.filter((d) =>
        d.idHerramienta === idHerramienta && d.idEstadoHerramienta === idEstadoDisponible && !idsYaSolicitados.has(d.idDetalle));
}

const patronTexto = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,()\-\s]+$/;

function obtenerIdUsuarioActual() {
    return Number(localStorage.getItem("siptec-usuario-id")) || 1;
}

function resolverPorNombre(texto, lista, campoNombre) {
    if (!texto) return null;
    const textoBusqueda = texto.trim().toLowerCase();
    return lista.find((item) => item[campoNombre].toLowerCase().includes(textoBusqueda));
}

function fechasSonValidas(valorFechaInicio, valorFechaEsperada) {
    const inicio = new Date(valorFechaInicio);
    const esperada = new Date(valorFechaEsperada);

    if (esperada <= inicio) {
        return { valido: false, mensaje: "La fecha esperada debe ser posterior a la fecha de inicio." };
    }

    const unMesDespues = new Date(inicio);
    unMesDespues.setMonth(unMesDespues.getMonth() + 1);

    if (esperada > unMesDespues) {
        return { valido: false, mensaje: "El préstamo no puede exceder 1 mes desde el inicio." };
    }

    return { valido: true };
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

    const hoy = new Date().toISOString().split("T")[0];
    fechaInicio.min = hoy;

    function pintarUnidades(herramienta, codigoPreseleccionado) {
        if (!herramienta) {
            contenedorUnidades.innerHTML = '<small style="font-size:9px; color:var(--ink-soft);">Primero busca y selecciona un equipo.</small>';
            return;
        }

        const unidades = listaUnidadesDisponibles(herramienta.idHerramienta);
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

    function validarFormularioPrestamo() {
        if (!fechaInicio.value || !fechaEsperada.value) {
            return { valido: false, mensaje: "Selecciona la fecha de inicio y la esperada." };
        }

        const validacionFechas = fechasSonValidas(fechaInicio.value, fechaEsperada.value);
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

            const idsPermitidos = new Set(listaUnidadesDisponibles(Number(idHerramientaSeleccionada.value)).map((u) => u.idDetalle));
            if (elegidas.some((id) => !idsPermitidos.has(id))) {
                return { valido: false, mensaje: "Alguna pieza elegida ya no está disponible (prestada, dañada o solicitada)." };
            }
        } else if (!idAreaSeleccionada.value) {
            return { valido: false, mensaje: "Busca y selecciona un área válida de la lista." };
        }

        return { valido: true };
    }

    async function registrarPrestamo() {
        const validacion = validarFormularioPrestamo();
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

    function conectarBuscadorHerramienta() {
        buscarHerramienta.addEventListener("change", () => {
            const texto = buscarHerramienta.value.trim();
            const unidadPorCodigo = listaDetallesHerramienta.find((d) => d.codInv.toLowerCase() === texto.toLowerCase());
            const encontrada = unidadPorCodigo
                ? listaHerramientas.find((h) => h.idHerramienta === unidadPorCodigo.idHerramienta)
                : resolverPorNombre(texto, listaHerramientas, "nombreHerramienta");

            if (encontrada) {
                idHerramientaSeleccionada.value = encontrada.idHerramienta;
                buscarHerramienta.value = encontrada.nombreHerramienta;
                avisoHerramienta.textContent = "Piezas disponibles: " + listaUnidadesDisponibles(encontrada.idHerramienta).length;
                pintarUnidades(encontrada, unidadPorCodigo ? unidadPorCodigo.codInv : null);
            } else {
                idHerramientaSeleccionada.value = "";
                avisoHerramienta.textContent = "No se encontró ese equipo. Revisa el nombre o el código, o agrégalo como nuevo.";
                pintarUnidades(null);
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
                avisoArea.textContent = "El nombre de la ubicación tiene símbolos no permitidos.";
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

        const resultado = fechasSonValidas(fechaInicio.value, fechaEsperada.value);
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
            listaHerramientas = await obtenerHerramientas();
            listaAreas = await obtenerAreas();
            listaEstados = await obtenerEstadosPrestamo();
            listaTiposArea = await obtenerTiposArea();
            listaDetallesHerramienta = await obtenerDetallesHerramienta();
            listaEstadosHerramienta = await obtenerEstadosHerramienta();
            listaPrestamos = await obtenerPrestamos();
            listaDetallesPrestamo = await obtenerDetallePrestamoHerramientas();
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
