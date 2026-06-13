function(instance, properties, context) {
    instance.data = instance.data || {};
    if (typeof instance.data.omniSignatureBootstrap === "function") {
        var runtime = instance.data.omniSignatureBootstrap();
        if (runtime && typeof runtime.update === "function") {
            runtime.update(properties, context);
        }
    }
}
