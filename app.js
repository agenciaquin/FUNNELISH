/* ================================================================
   ConfirmaYa — KLIXMANT
   app.js — Lógica completa de la aplicación

   Sin frameworks, sin dependencias externas, sin build.
   Toda la lógica corre en el navegador con JS puro.
   ================================================================ */

/* ----------------------------------------------------------------
   Constante configurable: género por defecto para tallas sin género.
   Cambiar solo esta línea si el negocio decide usar otro valor.
   ---------------------------------------------------------------- */
const GENERO_POR_DEFECTO = "Hombre";

/* ----------------------------------------------------------------
   Indicadores de género reconocidos para la regla de talla.
   Se comparan en minúsculas (case-insensitive).
   ---------------------------------------------------------------- */
const INDICADORES_GENERO = ["dama", "mujer", "femenino", "hombre", "caballero"];

/* ----------------------------------------------------------------
   Valor por defecto cuando el correo no se ingresa
   ---------------------------------------------------------------- */
const CORREO_POR_DEFECTO = "Gerenciaquin7@gmail.com";

/* ----------------------------------------------------------------
   Valor por defecto cuando el valor a pagar no se ingresa
   ---------------------------------------------------------------- */
const VALOR_POR_DEFECTO = "$130.000";

/* ================================================================
   TAREA 07 — Normalización del teléfono
   Produce dos valores separados:
   - telefonoMensaje:   +57XXXXXXXXXX  (para el cuerpo del mensaje)
   - telefonoWhatsApp:  57XXXXXXXXXX   (para la URL wa.me, sin "+")
   ================================================================ */

/**
 * Normaliza un número de teléfono colombiano.
 * @param {string} valorRaw  Valor ingresado por el operador.
 * @returns {{ telefonoMensaje: string, telefonoWhatsApp: string, valido: boolean }}
 */
function normalizarTelefono(valorRaw) {
  // Eliminar todos los caracteres que no sean dígitos
  const soloDigitos = valorRaw.replace(/\D/g, "");

  let digitos10 = "";

  if (soloDigitos.length === 12 && soloDigitos.startsWith("57")) {
    // Ya tiene código de país (ej: 573001234567)
    digitos10 = soloDigitos.slice(2);
  } else if (soloDigitos.length === 10) {
    // Número colombiano sin código de país (ej: 3001234567)
    digitos10 = soloDigitos;
  } else {
    // Mejor esfuerzo: conservar lo que se pueda
    digitos10 = soloDigitos;
  }

  const valido = digitos10.length >= 10;

  return {
    telefonoMensaje:   "+57" + digitos10,   // ej: +573001234567
    telefonoWhatsApp:  "57"  + digitos10,   // ej: 573001234567
    valido
  };
}

/* ================================================================
   TAREA 08 — Reglas de correo y valor por defecto
   ================================================================ */

/**
 * Aplica la regla de correo: si vacío, usa el correo corporativo por defecto.
 * @param {string} correoRaw Valor del campo correo.
 * @returns {string}
 */
function aplicarReglasCorreo(correoRaw) {
  return correoRaw.trim() !== "" ? correoRaw.trim() : CORREO_POR_DEFECTO;
}

/**
 * Aplica la regla de valor: si vacío, usa $130.000 por defecto.
 * @param {string} valorRaw Valor del campo valor a pagar.
 * @returns {string}
 */
function aplicarReglasValor(valorRaw) {
  return valorRaw.trim() !== "" ? valorRaw.trim() : VALOR_POR_DEFECTO;
}

/* ================================================================
   TAREA 09 — Regla de talla / género
   ================================================================ */

/**
 * Aplica la regla de género a la talla ingresada:
 * - Si contiene indicador de género → dejar tal cual.
 * - Si NO está vacía y NO tiene indicador → agregar GENERO_POR_DEFECTO al final.
 * - Si está vacía → dejar en blanco.
 * @param {string} tallaRaw Valor del campo talla.
 * @returns {string}
 */
function aplicarReglasTalla(tallaRaw) {
  const talla = tallaRaw.trim();

  // Caso: campo vacío — no asumir género
  if (talla === "") {
    return "";
  }

  // Comprobar si ya contiene algún indicador de género (sin importar mayúsculas)
  const tallaMin = talla.toLowerCase();
  const tieneGenero = INDICADORES_GENERO.some(indicador => tallaMin.includes(indicador));

  if (tieneGenero) {
    // Ya tiene indicador de género — devolver tal cual
    return talla;
  }

  // No tiene indicador de género → agregar el género por defecto al final
  return talla + " " + GENERO_POR_DEFECTO;
}

/* ================================================================
   TAREA 10 — Generación del mensaje con la plantilla exacta
   Sin líneas en blanco entre campos.
   ================================================================ */

/**
 * Construye el mensaje de confirmación usando la plantilla exacta del proyecto.
 * @param {Object} datos Objeto con los campos procesados del pedido.
 * @returns {string} Mensaje listo para copiar/enviar.
 */
function generarMensaje(datos) {
  /* Plantilla EXACTA definida en CLAUDE.md — no modificar el formato */
  return (
    "Hola 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚✨ Por favor confirma que estos datos estén correctos:\n" +
    "Nombre: "             + datos.nombre    + "\n" +
    "Teléfono: "           + datos.telefono  + "\n" +
    "Dirección: "          + datos.direccion + "\n" +
    "Ciudad: "             + datos.ciudad    + "\n" +
    "Departamento: "       + datos.departamento + "\n" +
    "Correo: "             + datos.correo    + "\n" +
    "Talla: "              + datos.talla     + "\n" +
    "Nombre del Producto: "+ datos.producto  + "\n" +
    "Valor a pagar: "      + datos.valor     + "\n" +
    "✅ Si todo está correcto responde: CONFIRMO\n" +
    "✏️ Si deseas corregir algún dato, escríbelo en este chat.\n" +
    "🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas."
  );
}

/* ================================================================
   TAREA 11 — Búsqueda de foto del producto en el catálogo
   ================================================================ */

/**
 * Busca el producto en el catálogo de forma case-insensitive y trim-safe.
 * @param {string} nombreProducto Nombre ingresado por el operador.
 * @returns {string} Ruta de la imagen (catálogo o placeholder).
 */
function buscarFotoProducto(nombreProducto) {
  // Normalizar la búsqueda: minúsculas y sin espacios sobrantes
  const busqueda = nombreProducto.trim().toLowerCase();

  // Recorrer las claves del catálogo normalizando también cada clave al comparar
  for (const clave of Object.keys(CATALOGO)) {
    if (clave.trim().toLowerCase() === busqueda) {
      return CATALOGO[clave];   // encontrado — devolver ruta real
    }
  }

  // No encontrado — usar imagen placeholder
  return "img/placeholder.png";
}

/* ================================================================
   TAREA 15 — Validación básica del formulario
   ================================================================ */

/**
 * Valida que los campos obligatorios no estén vacíos.
 * Muestra u oculta el mensaje de error según el resultado.
 * @param {Object} campos Objeto con los valores del formulario.
 * @returns {boolean} true si la validación pasa, false si hay errores.
 */
function validarCamposObligatorios(campos) {
  const obligatorios = [
    { clave: "nombre",       etiqueta: "Nombre" },
    { clave: "telefono",     etiqueta: "Teléfono" },
    { clave: "direccion",    etiqueta: "Dirección" },
    { clave: "ciudad",       etiqueta: "Ciudad" },
    { clave: "departamento", etiqueta: "Departamento" },
    { clave: "producto",     etiqueta: "Nombre del Producto" },
  ];

  const faltantes = obligatorios
    .filter(c => campos[c.clave].trim() === "")
    .map(c => c.etiqueta);

  const divError = document.getElementById("error-msg");

  if (faltantes.length > 0) {
    // Mostrar cuáles campos faltan
    divError.textContent = "Por favor completa los siguientes campos: " + faltantes.join(", ") + ".";
    divError.classList.add("visible");
    divError.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return false;
  }

  // Sin errores — ocultar el div de error
  divError.textContent = "";
  divError.classList.remove("visible");
  return true;
}

/* ================================================================
   TAREA 12 — Botón "Copiar mensaje"
   ================================================================ */

/**
 * Inicializa el listener del botón copiar.
 */
function iniciarBotonCopiar() {
  const btnCopiar = document.getElementById("btn-copiar");

  btnCopiar.addEventListener("click", function () {
    const textoMensaje = document.getElementById("texto-mensaje").value;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      // API de portapapeles moderna
      navigator.clipboard.writeText(textoMensaje).then(function () {
        mostrarFeedbackCopiado(btnCopiar);
      }).catch(function () {
        // Fallback si el usuario rechaza el permiso de portapapeles
        copiarConFallback(textoMensaje, btnCopiar);
      });
    } else {
      // Fallback para navegadores sin Clipboard API
      copiarConFallback(textoMensaje, btnCopiar);
    }
  });
}

/**
 * Muestra "¡Copiado! ✓" en el botón por 2 segundos y restaura el texto original.
 * @param {HTMLButtonElement} btn
 */
function mostrarFeedbackCopiado(btn) {
  const textoOriginal = btn.textContent;
  btn.textContent = "¡Copiado! ✓";
  setTimeout(function () {
    btn.textContent = textoOriginal;
  }, 2000);
}

/**
 * Fallback para copiar usando el método execCommand (navegadores antiguos).
 * @param {string} texto
 * @param {HTMLButtonElement} btn
 */
function copiarConFallback(texto, btn) {
  try {
    const textarea = document.getElementById("texto-mensaje");
    textarea.select();
    document.execCommand("copy");
    mostrarFeedbackCopiado(btn);
  } catch (e) {
    // Si todo falla, instruir al usuario manualmente
    alert("No se pudo copiar automáticamente. Selecciona el texto del mensaje y presiona Ctrl+C (o Cmd+C en Mac).");
  }
}

/* ================================================================
   TAREA 13 — Botón "Enviar a cliente"
   Descarga la foto Y abre WhatsApp con el mensaje codificado.
   ================================================================ */

/**
 * Inicializa el listener del botón "Enviar a cliente".
 * Las variables de estado (telefonoWhatsApp, mensajeActual) se manejan en el cierre del módulo.
 */
function iniciarBotonEnviar() {
  const btnEnviar = document.getElementById("btn-enviar");

  btnEnviar.addEventListener("click", function () {
    // Leer el estado actual guardado en los elementos del DOM
    const imgProducto  = document.getElementById("img-producto");
    const textoMensaje = document.getElementById("texto-mensaje");

    // Acción 1 — Descargar la foto del producto
    descargarFoto(imgProducto.src);

    // Acción 2 — Abrir WhatsApp con el mensaje codificado
    const telefonoWhatsApp = btnEnviar.dataset.telefono; // guardado al generar el mensaje
    const mensaje          = textoMensaje.value;
    const urlWhatsApp = "https://wa.me/" + telefonoWhatsApp + "?text=" + encodeURIComponent(mensaje);
    window.open(urlWhatsApp, "_blank");
  });
}

/**
 * Descarga la imagen del producto mediante un <a download> temporal.
 * @param {string} srcImagen URL de la imagen a descargar.
 */
function descargarFoto(srcImagen) {
  // Actualizar el enlace de descarga visible (fallback)
  const linkDescarga = document.getElementById("link-descarga");
  linkDescarga.href = srcImagen;

  // Crear elemento <a> temporal para la descarga programática
  const enlace = document.createElement("a");
  enlace.href = srcImagen;
  enlace.download = "";        // el navegador deduce el nombre del archivo
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
}

/* ================================================================
   TAREA 14 — Botón "Nuevo pedido"
   ================================================================ */

/**
 * Inicializa el listener del botón "Nuevo pedido".
 */
function iniciarBotonNuevo() {
  const btnNuevo = document.getElementById("btn-nuevo");

  btnNuevo.addEventListener("click", function () {
    // Limpiar el formulario (todos los campos vuelven a su valor por defecto)
    const formulario = document.getElementById("form-pedido");
    formulario.reset();

    // Ocultar la sección de vista previa
    const seccionPreview = document.getElementById("seccion-preview");
    seccionPreview.style.display = "none";

    // Ocultar posible mensaje de error
    const divError = document.getElementById("error-msg");
    divError.textContent = "";
    divError.classList.remove("visible");

    // Ocultar aviso de mensaje largo
    const avisoLargo = document.getElementById("aviso-largo");
    avisoLargo.textContent = "";
    avisoLargo.classList.remove("visible");

    // Limpiar el textarea y la imagen
    document.getElementById("texto-mensaje").value = "";
    document.getElementById("img-producto").src = "img/placeholder.png";

    // Subir al inicio y enfocar el primer campo
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("input-nombre").focus();
  });
}

/* ================================================================
   TAREA 16 — Poblar el datalist de productos desde el catálogo
   ================================================================ */

/**
 * Llena el datalist #lista-productos con las claves de CATALOGO.
 * Se ejecuta al cargar el DOM para que las sugerencias estén disponibles
 * desde el primer momento.
 */
function poblarDatalist() {
  const datalist = document.getElementById("lista-productos");

  // Limpiar el datalist por si se llama más de una vez
  datalist.innerHTML = "";

  // Agregar una <option> por cada producto del catálogo
  Object.keys(CATALOGO).forEach(function (nombreProducto) {
    const opcion = document.createElement("option");
    opcion.value = nombreProducto;   // capitalización original
    datalist.appendChild(opcion);
  });
}

/* ================================================================
   TAREA 20 — Advertencia de mensaje demasiado largo
   ================================================================ */

/**
 * Verifica la longitud del mensaje y muestra u oculta el aviso correspondiente.
 * El límite de seguridad es 1900 caracteres (margen antes del límite de WhatsApp).
 * @param {string} mensaje Texto del mensaje generado.
 */
function verificarLongitudMensaje(mensaje) {
  const LIMITE = 1900;
  const avisoLargo = document.getElementById("aviso-largo");

  if (mensaje.length > LIMITE) {
    avisoLargo.textContent =
      "⚠️ El mensaje es muy largo (" + mensaje.length + " caracteres). Puede que WhatsApp lo trunque. " +
      "Considera acortar la dirección o el nombre del producto.";
    avisoLargo.classList.add("visible");
  } else {
    avisoLargo.textContent = "";
    avisoLargo.classList.remove("visible");
  }
}

/* ================================================================
   PUNTO DE ENTRADA — Listener al botón "Generar mensaje"
   Orquesta todas las reglas de negocio (TAREAS 07–11, 15, 20)
   ================================================================ */

/**
 * Inicializa el listener principal del botón "Generar mensaje".
 */
function iniciarBotonGenerar() {
  const btnGenerar = document.getElementById("btn-generar");

  btnGenerar.addEventListener("click", function () {
    // ── Paso 1: Recolectar valores del formulario ──────────────────
    const campos = {
      nombre:      document.getElementById("input-nombre").value,
      telefono:    document.getElementById("input-telefono").value,
      direccion:   document.getElementById("input-direccion").value,
      ciudad:      document.getElementById("input-ciudad").value,
      departamento:document.getElementById("input-departamento").value,
      correo:      document.getElementById("input-correo").value,
      talla:       document.getElementById("input-talla").value,
      producto:    document.getElementById("input-producto").value,
      valor:       document.getElementById("input-valor").value,
    };

    // ── Paso 2 (TAREA 15): Validar campos obligatorios ────────────
    const esValido = validarCamposObligatorios(campos);
    if (!esValido) {
      // Ocultar preview si había un mensaje previo
      document.getElementById("seccion-preview").style.display = "none";
      return;   // detener si faltan campos obligatorios
    }

    // ── Paso 2a (TAREA 07): Normalizar teléfono ───────────────────
    const { telefonoMensaje, telefonoWhatsApp, valido: telefonoValido } = normalizarTelefono(campos.telefono);

    if (!telefonoValido) {
      // Teléfono con menos de 10 dígitos útiles — mostrar aviso y deshabilitar envío
      const divError = document.getElementById("error-msg");
      divError.textContent = "El teléfono ingresado no es válido. Debe tener al menos 10 dígitos.";
      divError.classList.add("visible");
      document.getElementById("seccion-preview").style.display = "none";
      return;
    }

    // ── Paso 2b (TAREA 08): Reglas de correo y valor ──────────────
    const correo  = aplicarReglasCorreo(campos.correo);
    const valor   = aplicarReglasValor(campos.valor);

    // ── Paso 2c (TAREA 09): Regla de talla / género ───────────────
    const talla = aplicarReglasTalla(campos.talla);

    // ── Paso 3 (TAREA 11): Buscar foto del producto ───────────────
    const rutaFoto = buscarFotoProducto(campos.producto);
    const imgProducto = document.getElementById("img-producto");
    imgProducto.src = rutaFoto;

    // Actualizar también el enlace de descarga fallback
    const linkDescarga = document.getElementById("link-descarga");
    linkDescarga.href = rutaFoto;

    // ── Paso 4 (TAREA 10): Generar el mensaje con la plantilla ────
    const datosProcessados = {
      nombre:      campos.nombre.trim(),
      telefono:    telefonoMensaje,          // con +57 para el cuerpo del mensaje
      direccion:   campos.direccion.trim(),
      ciudad:      campos.ciudad.trim(),
      departamento:campos.departamento.trim(),
      correo:      correo,
      talla:       talla,
      producto:    campos.producto.trim(),
      valor:       valor,
    };

    const mensaje = generarMensaje(datosProcessados);

    // ── Paso 5: Mostrar el mensaje en el textarea ─────────────────
    const textoMensaje = document.getElementById("texto-mensaje");
    textoMensaje.value = mensaje;

    // ── Paso 6 (TAREA 20): Verificar longitud del mensaje ─────────
    verificarLongitudMensaje(mensaje);

    // ── Paso 7: Guardar teléfono para el botón "Enviar a cliente" ─
    // Se almacena como dataset en el botón enviar para acceso posterior
    document.getElementById("btn-enviar").dataset.telefono = telefonoWhatsApp;

    // ── Paso 8: Mostrar la sección de preview ─────────────────────
    const seccionPreview = document.getElementById("seccion-preview");
    seccionPreview.style.display = "block";
    seccionPreview.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ================================================================
   INICIALIZACIÓN — se ejecuta cuando el DOM está completamente cargado
   (TAREA 16: poblar datalist; TAREAS 12–14: iniciar botones)
   ================================================================ */
document.addEventListener("DOMContentLoaded", function () {
  // Poblar el datalist con los productos del catálogo (TAREA 16)
  poblarDatalist();

  // Iniciar los listeners de los botones de acción
  iniciarBotonGenerar();   // TAREAS 07–11, 15, 20
  iniciarBotonCopiar();    // TAREA 12
  iniciarBotonEnviar();    // TAREA 13
  iniciarBotonNuevo();     // TAREA 14
});
