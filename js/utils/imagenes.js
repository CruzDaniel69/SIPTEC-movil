// Utilidades para las fotos que se suben a Cloudinary (fotos de equipos y evidencias de préstamos).

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/** Revisa el archivo antes de enviarlo. Devuelve el texto del problema, o null si está bien. La API vuelve a validarlo. */
export function validarImagen(archivo) {
    if (!archivo) return null;
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) return "La foto debe ser una imagen JPG, PNG o WEBP.";
    if (archivo.size > MAX_BYTES) return "La foto es demasiado grande (máximo 5 MB).";
    return null;
}

/** Solo se dibujan imágenes que vienen de Cloudinary: así un dato raro en la base no inyecta una dirección cualquiera. */
export function urlDeImagenSegura(url) {
    return typeof url === "string" && url.startsWith("https://res.cloudinary.com/") ? url : "";
}

/** Versión reducida de la imagen (Cloudinary la recorta al pedirla), para miniaturas de tabla. */
export function miniatura(url, lado = 80) {
    const segura = urlDeImagenSegura(url);
    return segura ? segura.replace("/upload/", `/upload/c_fill,w_${lado},h_${lado},q_auto,f_auto/`) : "";
}

/**
 * Conecta una caja de foto (vista previa, nombre del archivo y botón de quitar) con su campo de archivo oculto.
 * Devuelve la función que repinta la caja, para llamarla después de limpiar el formulario.
 */
export function conectarSelectorFoto({ entrada, caja, texto, vista, quitar, textoVacio = "Tomar o elegir una foto" }) {
    let urlVista = "";

    function repintar() {
        const archivo = entrada ? entrada.files[0] : null;

        if (urlVista) {
            URL.revokeObjectURL(urlVista);
            urlVista = "";
        }
        if (archivo) urlVista = URL.createObjectURL(archivo);

        if (caja) caja.classList.toggle("con-archivo", Boolean(archivo));
        if (texto) texto.textContent = archivo ? archivo.name : textoVacio;
        if (vista) {
            if (urlVista) vista.src = urlVista;
            else vista.removeAttribute("src");
        }
    }

    if (entrada) entrada.addEventListener("change", repintar);

    // El botón está dentro de la caja (un label): se evita que el toque abra el selector de archivos
    if (quitar) {
        quitar.addEventListener("click", (evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            if (entrada) entrada.value = "";
            repintar();
        });
    }

    return repintar;
}
