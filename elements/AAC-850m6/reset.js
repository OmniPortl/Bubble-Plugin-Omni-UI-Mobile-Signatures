function(instance, context) {
    instance.data = instance.data || {};
    if (typeof instance.data.omniSignatureBootstrap === "function") {
        var runtime = instance.data.omniSignatureBootstrap();
        if (runtime && runtime.helpers && typeof runtime.helpers.clearSignature === "function") {
            runtime.helpers.clearSignature(context);
        }
    }
}
