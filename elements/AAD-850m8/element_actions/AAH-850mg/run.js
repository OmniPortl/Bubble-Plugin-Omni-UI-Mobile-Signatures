function(instance, properties, context) {
    instance.data = instance.data || {};
    if (typeof instance.data.omniSignatureBootstrap === "function") {
        instance.data.omniSignatureBootstrap();
    }

    var enabled = properties && properties.enabled;
    if (typeof enabled === "function") {
        try {
            enabled = enabled();
        } catch (_error) {
            enabled = true;
        }
    }

    var runtime = instance.data.omniSignatureRuntime || instance.data.omniSignatureMobileRuntime;
    if (runtime && runtime.helpers && typeof runtime.helpers.setEnabled === "function") {
        runtime.helpers.setEnabled(enabled, context);
    }
}
