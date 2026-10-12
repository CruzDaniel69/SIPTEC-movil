import { iniciarSesion, haySesionActiva } from "../services/authService.js";

const RUTA_APP = "pages/loadViews.html";

async function redirigirSiYaHaySesion() {
    if (await haySesionActiva()) window.location.replace(RUTA_APP);
}

export function initLoginController() {
    const formLogin = document.getElementById("login-form");
    const email = document.getElementById("email");
    const password = document.getElementById("password");

    if (!formLogin) return;

    redirigirSiYaHaySesion();
    window.addEventListener("pageshow", (evento) => {
        if (evento.persisted) redirigirSiYaHaySesion();
    });

    formLogin.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const correo = email.value.trim();
        const clave = password.value;

        if (!correo || !clave) {
            Swal.fire({ icon: "warning", title: "Datos incompletos", text: "Ingresa tu correo y tu contraseña." });
            return;
        }

        try {
            const usuario = await iniciarSesion(correo, clave);

            if (!usuario) {
                Swal.fire({ icon: "error", title: "Credenciales inválidas", text: "Correo o contraseña incorrectos." });
                return;
            }


            window.location.replace(RUTA_APP);

        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "No se pudo iniciar sesión",
                text: "Ocurrió un error al conectar con el servidor. Intenta de nuevo.",
                confirmButtonColor: "#dc3545",
            });
        }
    });
}

initLoginController();
