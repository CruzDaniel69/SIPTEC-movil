import { agregarHerramienta } from "../services/herramientaService.js";
import { obtenerMarcas, agregarMarca } from "../services/marcaService.js";
import { obtenerCategorias, agregarCategoria } from "../services/categoriaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { obtenerDetallesHerramienta, agregarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { agregarHerramientaCategoria } from "../services/herramientaCategoriaService.js";

let listaEstadosHerramienta = [];
let listaMarcas = [];
let listaCategorias = [];
let listaDetalles = [];

export function initImplementoController() {
    const nombreEquipo = document.getElementById("nombreEquipo");
    const prefijoCodigo = document.getElementById("prefijoCodigo");
    const numeroCodigo = document.getElementById("numeroCodigo");
    const cantidadPiezas = document.getElementById("cantidadPiezas");
    const vistaPreviaCodigos = document.getElementById("vistaPreviaCodigos");
    const marcaSelect = document.getElementById("marcaTexto");
    const categoriaSelect = document.getElementById("categoriaTexto");
    const descripcionEquipo = document.getElementById("descripcionEquipo");
    const btnGuardarImplemento = document.getElementById("btnGuardarImplemento");

    if (!btnGuardarImplemento) return;

    const patronTexto = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,()\-\s]+$/;

    function generarCodigos() {
        const numeroInicial = Number(numeroCodigo.value);
        const piezas = Number(cantidadPiezas.value);
        if (!Number.isInteger(numeroInicial) || numeroInicial < 1 || !Number.isInteger(piezas) || piezas < 1) return [];
        return Array.from({ length: piezas }, (_, i) => `${prefijoCodigo.value}-${numeroInicial + i}`);
    }

    function codigosRepetidos(codigos) {
        return codigos.filter((c) => listaDetalles.some((d) => (d.codInv || "").toUpperCase() === c.toUpperCase()));
    }

    function actualizarVistaPrevia() {
        const codigos = generarCodigos();
        if (codigos.length === 0) {
            vistaPreviaCodigos.style.color = "var(--ink-soft)";
            vistaPreviaCodigos.textContent = "Se creará un código por cada pieza (ej. EQ-21, EQ-22…).";
            return;
        }

        const repetidos = codigosRepetidos(codigos);
        if (repetidos.length > 0) {
            vistaPreviaCodigos.style.color = "var(--red)";
            vistaPreviaCodigos.textContent = "Ya existe: " + repetidos.join(", ");
            return;
        }

        vistaPreviaCodigos.style.color = "var(--ink-soft)";
        vistaPreviaCodigos.textContent = codigos.length === 1
            ? "Se creará: " + codigos[0]
            : `Se crearán ${codigos.length} piezas: ${codigos[0]} al ${codigos[codigos.length - 1]}`;
    }

    [prefijoCodigo, numeroCodigo, cantidadPiezas].forEach((campo) => campo.addEventListener("input", actualizarVistaPrevia));

    function limpiarFormulario() {
        nombreEquipo.value = "";
        numeroCodigo.value = "";
        cantidadPiezas.value = 1;
        actualizarVistaPrevia();
        poblarSelect(marcaSelect, listaMarcas, "nombreMarca", "");
        poblarSelect(categoriaSelect, listaCategorias, "nombreCategoria", "");
        if (descripcionEquipo) {
            descripcionEquipo.value = "";
            const contador = document.getElementById("c3");
            if (contador) contador.innerText = "0";
        }
    }

    function poblarSelect(select, lista, campoNombre, valorSeleccionado) {
        if (!select) return;
        const opciones = lista.map((item) =>
            `<option value="${item.id}" ${String(item.id) === String(valorSeleccionado) ? "selected" : ""}>${item[campoNombre]}</option>`
        ).join("");
        select.innerHTML = '<option value="" disabled' + (valorSeleccionado ? "" : " selected") + '>Selecciona una opción</option>' +
            opciones +
            '<option value="__nuevo__">+ Agregar nueva opción</option>';
    }

    async function manejarAgregarNuevaOpcion(titulo, placeholder, crear) {
        const { value: nombre } = await Swal.fire({
            title: titulo,
            input: "text",
            inputPlaceholder: placeholder,
            showCancelButton: true,
            confirmButtonText: "Agregar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#8a4fd6",
            inputValidator: (value) => {
                const texto = (value || "").trim();
                if (!texto) return "Escribe un nombre.";
                if (!patronTexto.test(texto)) return "Ese nombre tiene símbolos no permitidos.";
                return null;
            },
        });

        if (!nombre) return null;

        try {
            return await crear(nombre.trim());
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudo agregar", text: "Ocurrió un error al conectar con el servidor." });
            return null;
        }
    }

    marcaSelect.addEventListener("change", async () => {
        if (marcaSelect.value !== "__nuevo__") return;
        const creada = await manejarAgregarNuevaOpcion("Nueva marca", "Nombre de la marca", async (nombre) => {
            const creada = await agregarMarca({ nombreMarca: nombre });
            listaMarcas.push(creada);
            return creada;
        });
        poblarSelect(marcaSelect, listaMarcas, "nombreMarca", creada ? creada.id : "");
    });

    categoriaSelect.addEventListener("change", async () => {
        if (categoriaSelect.value !== "__nuevo__") return;
        const creada = await manejarAgregarNuevaOpcion("Nueva categoría", "Nombre de la categoría", async (nombre) => {
            const creada = await agregarCategoria({ nombreCategoria: nombre });
            listaCategorias.push(creada);
            return creada;
        });
        poblarSelect(categoriaSelect, listaCategorias, "nombreCategoria", creada ? creada.id : "");
    });

    function validarFormulario() {
        if (!nombreEquipo.value.trim()) {
            return { valido: false, mensaje: "Escribe el nombre del equipo." };
        }
        if (!patronTexto.test(nombreEquipo.value.trim())) {
            return { valido: false, mensaje: "El nombre del equipo tiene símbolos no permitidos." };
        }
        const numeroInicial = Number(numeroCodigo.value);
        if (!Number.isInteger(numeroInicial) || numeroInicial < 1) {
            return { valido: false, mensaje: "El número del código debe ser un entero mayor a 0." };
        }
        const piezas = Number(cantidadPiezas.value);
        if (!Number.isInteger(piezas) || piezas < 1 || piezas > 50) {
            return { valido: false, mensaje: "Indica entre 1 y 50 piezas." };
        }
        const repetidos = codigosRepetidos(generarCodigos());
        if (repetidos.length > 0) {
            return { valido: false, mensaje: "Estos códigos ya existen: " + repetidos.join(", ") + ". Cambia el número inicial." };
        }
        if (!marcaSelect.value || marcaSelect.value === "__nuevo__") {
            return { valido: false, mensaje: "Selecciona una marca." };
        }
        if (!categoriaSelect.value || categoriaSelect.value === "__nuevo__") {
            return { valido: false, mensaje: "Selecciona una categoría." };
        }
        if (descripcionEquipo && descripcionEquipo.value.trim() && !patronTexto.test(descripcionEquipo.value.trim())) {
            return { valido: false, mensaje: "La descripción tiene símbolos no permitidos." };
        }
        return { valido: true };
    }

    async function guardarImplemento() {
        const validacion = validarFormulario();
        if (!validacion.valido) {
            Swal.fire({ icon: "warning", title: "Datos incompletos", text: validacion.mensaje });
            return;
        }

        const estadoDisponible = listaEstadosHerramienta.find((item) => item.nombreEstadoHerramienta === "DISPONIBLE");
        if (!estadoDisponible) {
            Swal.fire({ icon: "error", title: "No se pudo guardar", text: "No se encontró el estado DISPONIBLE." });
            return;
        }

        try {
            const nuevaHerramienta = await agregarHerramienta({
                nombreHerramienta: nombreEquipo.value.trim(),
                descripcionHerramienta: descripcionEquipo.value.trim(),
                stock: Number(cantidadPiezas.value),
            });

            for (const codigo of generarCodigos()) {
                await agregarDetalleHerramienta({
                    idHerramienta: nuevaHerramienta.idHerramienta,
                    idMarca: Number(marcaSelect.value),
                    idEstadoHerramienta: estadoDisponible.id,
                    codInv: codigo,
                });
            }

            await agregarHerramientaCategoria({
                idCategoria: Number(categoriaSelect.value),
                idHerramienta: nuevaHerramienta.idHerramienta,
            });

            Swal.fire({
                icon: "success",
                title: "¡Implemento guardado!",
                text: "Se agregó correctamente al inventario.",
                confirmButtonColor: "#8a4fd6",
            });
            limpiarFormulario();

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo guardar el implemento",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    }

    if (descripcionEquipo) {
        descripcionEquipo.addEventListener("input", () => {
            const contador = document.getElementById("c3");
            if (contador) contador.innerText = descripcionEquipo.value.length;
        });
    }

    (async function cargarCatalogos() {
        try {
            const [marcas, categorias, estadosHerramienta, detalles] = await Promise.all([
                obtenerMarcas(),
                obtenerCategorias(),
                obtenerEstadosHerramienta(),
                obtenerDetallesHerramienta(),
            ]);

            listaEstadosHerramienta = estadosHerramienta;
            listaDetalles = detalles || [];
            listaMarcas = marcas;
            listaCategorias = categorias;

            poblarSelect(marcaSelect, listaMarcas, "nombreMarca", "");
            poblarSelect(categoriaSelect, listaCategorias, "nombreCategoria", "");

        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron cargar los catálogos", text: "Revisa tu conexión con el servidor." });
        }
    })();

    btnGuardarImplemento.addEventListener("click", guardarImplemento);
}
