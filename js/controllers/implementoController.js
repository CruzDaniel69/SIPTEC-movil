import { agregarHerramienta, subirImagenHerramienta } from "../services/herramientaService.js";
import { obtenerMarcas, agregarMarca } from "../services/marcaService.js";
import { obtenerCategorias, agregarCategoria } from "../services/categoriaService.js";
import { obtenerEstadosHerramienta } from "../services/estadoHerramientaService.js";
import { agregarDetalleHerramienta } from "../services/detalleHerramientaService.js";
import { agregarHerramientaCategoria } from "../services/herramientaCategoriaService.js";
import { obtenerCodigosExistentes } from "../services/inventarioService.js";
import { retrasar } from "../utils/paginacion.js";
import { validarImagen, conectarSelectorFoto } from "../utils/imagenes.js";

let listaEstadosHerramienta = [];
let listaMarcas = [];
let listaCategorias = [];

export function initImplementoController() {
    const nombreEquipo = document.getElementById("nombreEquipo");
    const prefijoCodigo = document.getElementById("prefijoCodigo");
    const numeroCodigo = document.getElementById("numeroCodigo");
    const cantidadPiezas = document.getElementById("cantidadPiezas");
    const vistaPreviaCodigos = document.getElementById("vistaPreviaCodigos");
    const marcaSelect = document.getElementById("marcaTexto");
    const categoriaSelect = document.getElementById("categoriaTexto");
    const descripcionEquipo = document.getElementById("descripcionEquipo");
    const fotoEquipo = document.getElementById("fotoEquipo");
    const cajaFotoEquipo = document.getElementById("cajaFotoEquipo");
    const textoFotoEquipo = document.getElementById("textoFotoEquipo");
    const btnGuardarImplemento = document.getElementById("btnGuardarImplemento");

    if (!btnGuardarImplemento) return;

    // Caja de la foto del implemento: vista previa, nombre del archivo y botón para quitarla
    const mostrarFotoEquipo = conectarSelectorFoto({
        entrada: fotoEquipo,
        caja: cajaFotoEquipo,
        texto: textoFotoEquipo,
        vista: document.getElementById("vistaFotoEquipo"),
        quitar: document.getElementById("quitarFotoEquipo"),
    });

    const patronTexto = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,()\-\s]+$/;

    function generarCodigos() {
        const numeroInicial = Number(numeroCodigo.value);
        const piezas = Number(cantidadPiezas.value);
        if (!Number.isInteger(numeroInicial) || numeroInicial < 1 || !Number.isInteger(piezas) || piezas < 1) return [];
        return Array.from({ length: piezas }, (_, i) => `${prefijoCodigo.value}-${numeroInicial + i}`);
    }

    async function codigosRepetidos(codigos) {
        return obtenerCodigosExistentes(codigos);
    }

    let versionVistaPrevia = 0;

    async function actualizarVistaPrevia() {
        const version = ++versionVistaPrevia;
        const codigos = generarCodigos();
        if (codigos.length === 0) {
            vistaPreviaCodigos.style.color = "var(--ink-soft)";
            vistaPreviaCodigos.textContent = "Ej. EQ-21, EQ-22…";
            return;
        }

        vistaPreviaCodigos.style.color = "var(--ink-soft)";
        vistaPreviaCodigos.textContent = codigos.length === 1
            ? codigos[0]
            : `${codigos.length} piezas: ${codigos[0]} al ${codigos[codigos.length - 1]}`;

        try {
            const repetidos = await codigosRepetidos(codigos);
            if (version !== versionVistaPrevia) return;

            if (repetidos.length > 0) {
                vistaPreviaCodigos.style.color = "var(--red)";
                vistaPreviaCodigos.textContent = "Ya existe: " + repetidos.join(", ");
            }
        } catch (error) {
            console.error(error);
        }
    }

    const vistaPreviaRetrasada = retrasar(actualizarVistaPrevia, 350);
    [prefijoCodigo, numeroCodigo, cantidadPiezas].forEach((campo) => campo.addEventListener("input", vistaPreviaRetrasada));

    function limpiarFormulario() {
        nombreEquipo.value = "";
        if (fotoEquipo) fotoEquipo.value = "";
        mostrarFotoEquipo();
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
                if (!patronTexto.test(texto)) return "Solo se permiten letras, números, espacios y los signos . , ( ) -";
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

    async function validarFormulario() {
        if (!nombreEquipo.value.trim()) {
            return { valido: false, mensaje: "Escribe el nombre del equipo." };
        }
        if (!patronTexto.test(nombreEquipo.value.trim())) {
            return { valido: false, mensaje: "El nombre del equipo solo admite letras, números, espacios y los signos . , ( ) -" };
        }
        const numeroInicial = Number(numeroCodigo.value);
        if (!Number.isInteger(numeroInicial) || numeroInicial < 1) {
            return { valido: false, mensaje: "El número del código debe ser un entero mayor a 0." };
        }
        const piezas = Number(cantidadPiezas.value);
        if (!Number.isInteger(piezas) || piezas < 1 || piezas > 50) {
            return { valido: false, mensaje: "Indica entre 1 y 50 piezas." };
        }
        const repetidos = await codigosRepetidos(generarCodigos());
        if (repetidos.length > 0) {
            return { valido: false, mensaje: "Estos códigos ya existen: " + repetidos.join(", ") + ". Cambia el número inicial." };
        }
        if (!marcaSelect.value || marcaSelect.value === "__nuevo__") {
            return { valido: false, mensaje: "Selecciona una marca." };
        }
        if (!categoriaSelect.value || categoriaSelect.value === "__nuevo__") {
            return { valido: false, mensaje: "Selecciona una categoría." };
        }
        const problemaFoto = validarImagen(fotoEquipo ? fotoEquipo.files[0] : null);
        if (problemaFoto) {
            return { valido: false, mensaje: problemaFoto };
        }
        if (descripcionEquipo && descripcionEquipo.value.trim() && !patronTexto.test(descripcionEquipo.value.trim())) {
            return { valido: false, mensaje: "La descripción solo admite letras, números, espacios y los signos . , ( ) -" };
        }
        return { valido: true };
    }

    async function guardarImplemento() {
        let validacion;
        try {
            validacion = await validarFormulario();
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: "error", title: "No se pudieron verificar los códigos", text: "Revisa tu conexión con el servidor." });
            return;
        }

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

            // La foto se sube aparte: si falla, el implemento ya quedó guardado y solo se avisa
            let fotoFallo = false;
            const foto = fotoEquipo ? fotoEquipo.files[0] : null;
            if (foto) {
                try {
                    await subirImagenHerramienta(nuevaHerramienta.idHerramienta, foto);
                } catch (error) {
                    console.error(error);
                    fotoFallo = true;
                }
            }

            Swal.fire({
                icon: fotoFallo ? "warning" : "success",
                title: "¡Implemento guardado!",
                text: fotoFallo
                    ? "Se agregó al inventario, pero la foto no se pudo subir. Agrégala después desde la web."
                    : "Se agregó correctamente al inventario.",
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
            const [marcas, categorias, estadosHerramienta] = await Promise.all([
                obtenerMarcas(),
                obtenerCategorias(),
                obtenerEstadosHerramienta(),
            ]);

            listaEstadosHerramienta = estadosHerramienta;
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
