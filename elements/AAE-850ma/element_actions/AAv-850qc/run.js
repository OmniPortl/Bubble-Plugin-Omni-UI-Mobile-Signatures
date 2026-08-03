function(instance, properties, context) {
    instance.data = instance.data || {};
    if (typeof instance.data.omniSignatureBootstrap === "function") {
        instance.data.omniSignatureBootstrap();
    }

    var runtime = instance.data.omniSignatureRuntime || instance.data.omniSignatureMobileRuntime;
    if (runtime && runtime.helpers && typeof runtime.helpers.undoLastStroke === "function") {
        runtime.helpers.undoLastStroke(context);
    }
}
