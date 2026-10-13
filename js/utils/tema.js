// Tema claro/oscuro: es solo una preferencia visual, no un dato del usuario
const CLAVE = "siptec-tema";

export function temaGuardado() {
    try {
        return localStorage.getItem(CLAVE) === "claro" ? "claro" : "oscuro";
    } catch (error) {
        return "oscuro";
    }
}

export function aplicarTema(tema) {
    if (tema === "claro") document.documentElement.setAttribute("data-tema", "claro");
    else document.documentElement.removeAttribute("data-tema");
    try {
        localStorage.setItem(CLAVE, tema);
    } catch (error) {
        // Sin almacenamiento el tema vale solo para esta sesión
    }
}
