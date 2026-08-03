function(instance, context) {
    instance.data = instance.data || {};
    var runtime = instance.data.omniSignatureMobileRuntime || instance.data.omniSignatureRuntime;
    if (runtime && runtime.helpers && typeof runtime.helpers.clearSignature === "function") {
        runtime.helpers.clearSignature(context);
    }
}
