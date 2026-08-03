function(instance, properties) {
    var host = instance && instance.canvas && instance.canvas[0] ? instance.canvas[0] : null;
    if (!host || typeof document === "undefined") return;

    if (instance.canvas && typeof instance.canvas.empty === "function") {
        instance.canvas.empty();
    } else {
        host.innerHTML = "";
    }

    var preview = document.createElement("div");
    preview.textContent = "Mobile Signature Pad";
    preview.style.boxSizing = "border-box";
    preview.style.width = "100%";
    preview.style.height = "100%";
    preview.style.minHeight = "120px";
    preview.style.display = "flex";
    preview.style.alignItems = "center";
    preview.style.justifyContent = "center";
    preview.style.border = "1px dashed #cbd5e1";
    preview.style.background = "#ffffff";
    preview.style.color = "#64748b";
    preview.style.fontSize = "14px";
    host.appendChild(preview);
}
